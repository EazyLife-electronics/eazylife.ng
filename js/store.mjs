// js/store.mjs
// Firestore data layer shared by shop.html and the admin dashboard.
// Inventory-aware order status changes are performed transactionally.

import { initFirebase } from './firebase.mjs';
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const { db } = initFirebase();

/* ---------------- ADMIN ERROR FEEDBACK ---------------- */
// Many Admin buttons intentionally use fire-and-forget async handlers. If an async
// action rejects without a local catch, the browser otherwise only shows a console
// error, making the button look like it did nothing. Surface the real error to the
// logged-in Admin while keeping the underlying rejection visible in the console.
if (typeof window !== 'undefined' &&
    (location.pathname.endsWith('/admin/') || location.pathname.endsWith('/admin/index.html'))) {
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || 'Unknown error');
    console.error('Admin action failed:', reason);

    if (typeof window.alert === 'function') {
      window.alert(`Action failed: ${message}`);
    }

    event.preventDefault();
  });
}

/* ---------------- PRODUCTS ---------------- */

export async function getProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function watchProducts(callback) {
  return onSnapshot(collection(db, 'products'), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addProduct(product) {
  return addDoc(collection(db, 'products'), product);
}

export async function updateProduct(id, updates) {
  return updateDoc(doc(db, 'products', id), updates);
}

export async function deleteProduct(id) {
  return deleteDoc(doc(db, 'products', id));
}

/* ---------------- ORDERS ---------------- */

function generateTrackingCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = 'EZ-';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function variantLabelForOrder(v, index) {
  const bits = [v?.processor, v?.ram, v?.rom, v?.color].filter(Boolean);
  return bits.length ? bits.join(' / ') : `Variant ${index + 1}`;
}

async function resolveOrderItems(items) {
  const productsSnap = await getDocs(collection(db, 'products'));
  const products = new Map(productsSnap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));

  return (items || []).map(item => {
    if (!item?.productId || item.variantId) return item;

    const product = products.get(item.productId);
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const wanted = String(item.variant || '').trim().toLowerCase();
    const matches = variants.map((v, index) => ({ v, index }))
      .filter(({ v, index }) => variantLabelForOrder(v, index).trim().toLowerCase() === wanted);

    if (matches.length !== 1) {
      throw new Error(`This order item could not be matched to a unique product variant: ${item.name || item.productId} (${item.variant || 'variant not specified'}). Please refresh the catalog and try again.`);
    }

    const { v } = matches[0];
    if (!v.id) {
      throw new Error(`The selected variant for ${item.name || item.productId} has no variant ID. Please edit and save that product before ordering.`);
    }

    return { ...item, variantId: v.id, sku: v.sku || '' };
  });
}

export async function placeOrder(order) {
  const trackingCode = generateTrackingCode();
  const items = await resolveOrderItems(order.items || []);
  await setDoc(doc(db, 'orders', trackingCode), {
    ...order,
    items,
    trackingCode,
    status: 'new',
    inventoryApplied: false,
    inventoryReturned: false,
    createdAt: serverTimestamp()
  });
  return trackingCode;
}

export async function getOrderByTrackingCode(code) {
  const snap = await getDoc(doc(db, 'orders', code.trim().toUpperCase()));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Links an order to the delivery record created for it, so the public
// tracking page can fetch that one delivery directly by ID (a plain `get`,
// same trust model as order lookup) instead of needing broader read access
// to the deliveries collection.
export async function linkOrderToDelivery(orderId, deliveryId) {
  await updateDoc(doc(db, 'orders', orderId), { deliveryId });
}

// Public read: anyone with an order's tracking code can already see that
// order's full details (see the `orders` Firestore rule), so exposing the
// one delivery record it links to is the same trust boundary, not a new one.
export async function getDelivery(deliveryId) {
  if (!deliveryId) return null;
  const snap = await getDoc(doc(db, 'deliveries', deliveryId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchOrders(callback) {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

function isConfirmedStatus(status) {
  return ['confirmed', 'shipped', 'delivered'].includes(String(status || '').toLowerCase());
}

function isReversalStatus(status) {
  return ['cancelled', 'returned'].includes(String(status || '').toLowerCase());
}

/*
 * Firestore transactions require all reads to happen before any writes.
 * Read and validate every affected product first, then perform the writes.
 * This also guarantees that a multi-item order cannot partially change stock.
 */
async function applyOrderInventory(tx, order, direction) {
  const items = Array.isArray(order.items) ? order.items : [];
  const grouped = new Map();

  for (const item of items) {
    if (!item?.productId || !item?.variantId) {
      throw new Error(`Order ${order.id || order.trackingCode || ''} contains an item without a variant ID. Inventory cannot be changed safely.`.trim());
    }
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    if (!qty) continue;
    const key = `${item.productId}::${item.variantId}`;
    const current = grouped.get(key) || { productId: item.productId, variantId: item.variantId, quantity: 0, item };
    current.quantity += qty;
    grouped.set(key, current);
  }

  const changes = [];

  // READ PHASE — no transaction writes before all product reads finish.
  for (const entry of grouped.values()) {
    const productRef = doc(db, 'products', entry.productId);
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error(`Product ${entry.item.name || entry.productId} no longer exists.`);

    const product = productSnap.data();
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    const index = variants.findIndex(v => v.id === entry.variantId);
    if (index < 0) throw new Error(`Variant for ${entry.item.name || entry.productId} no longer exists.`);

    const current = Math.max(0, Number(variants[index].stockQty || 0));
    const delta = direction > 0 ? -entry.quantity : entry.quantity;
    const next = current + delta;
    if (next < 0) {
      throw new Error(`Insufficient stock for ${entry.item.name || product.name || 'product'} (${entry.item.variant || entry.variantId}). Current stock: ${current}, requested: ${entry.quantity}.`);
    }

    variants[index] = { ...variants[index], stockQty: next, inStock: next > 0 };
    changes.push({
      productRef,
      product,
      variants,
      index,
      current,
      next,
      delta,
      item: entry.item,
      productId: entry.productId,
      variantId: entry.variantId
    });
  }

  // WRITE PHASE — only after every read and stock check succeeded.
  for (const change of changes) {
    tx.update(change.productRef, {
      variants: change.variants,
      inStock: change.variants.some(v => Number(v.stockQty || 0) > 0)
    });

    const movementRef = doc(collection(db, 'inventoryMovements'));
    tx.set(movementRef, {
      productId: change.productId,
      variantId: change.variantId,
      sku: change.variants[change.index].sku || change.item.sku || '',
      productName: change.product.name || change.item.name || '',
      variantLabel: change.item.variant || variantLabelForOrder(change.variants[change.index], change.index),
      type: direction > 0 ? 'sale' : 'return',
      quantity: change.delta,
      previousQty: change.current,
      newQty: change.next,
      reason: direction > 0 ? 'Customer order confirmed' : 'Order cancelled/returned',
      reference: order.trackingCode || order.id || '',
      orderId: order.id || order.trackingCode || '',
      createdAt: serverTimestamp()
    });
  }
}

export async function updateOrderStatus(id, status) {
  const orderRef = doc(db, 'orders', id);

  return runTransaction(db, async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('Order no longer exists.');

    const order = { id, ...snap.data() };
    const oldStatus = String(order.status || '').toLowerCase();
    const newStatus = String(status || '').toLowerCase();

    if (!newStatus) throw new Error('Order status is required.');
    if (oldStatus === newStatus) return;

    const shouldDeduct = isConfirmedStatus(newStatus) && !isConfirmedStatus(oldStatus) && order.inventoryApplied !== true;
    const shouldRestore = isReversalStatus(newStatus) && order.inventoryApplied === true && order.inventoryReturned !== true;

    if (shouldDeduct) {
      await applyOrderInventory(tx, order, 1);
      tx.update(orderRef, { status: newStatus, inventoryApplied: true, inventoryReturned: false, inventoryAppliedAt: serverTimestamp() });
      return;
    }

    if (shouldRestore) {
      await applyOrderInventory(tx, order, -1);
      tx.update(orderRef, { status: newStatus, inventoryReturned: true, inventoryReturnedAt: serverTimestamp() });
      return;
    }

    tx.update(orderRef, { status: newStatus });
  });
}

export async function cancelOrder(id, { reason = null, customerNote = null, internalNote = null } = {}) {
  const orderRef = doc(db, 'orders', id);
  return runTransaction(db, async tx => {
    const snap = await tx.get(orderRef);
    if (!snap.exists()) throw new Error('Order no longer exists.');
    const order = { id, ...snap.data() };
    const alreadyCancelled = String(order.status || '').toLowerCase() === 'cancelled';
    if (!alreadyCancelled && order.inventoryApplied === true && order.inventoryReturned !== true) {
      await applyOrderInventory(tx, order, -1);
    }
    tx.update(orderRef, {
      status: 'cancelled',
      cancelReason: reason,
      cancelCustomerNote: customerNote,
      cancelInternalNote: internalNote,
      cancelledAt: serverTimestamp(),
      ...(order.inventoryApplied === true && order.inventoryReturned !== true ? { inventoryReturned: true, inventoryReturnedAt: serverTimestamp() } : {})
    });
  });
}

/* ---------------- HEROES ---------------- */

export async function getHeroes() {
  const q = query(collection(db, 'heroes'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function watchHeroes(callback) {
  const q = query(collection(db, 'heroes'), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addHero(hero) {
  return addDoc(collection(db, 'heroes'), hero);
}

export async function updateHero(id, updates) {
  return updateDoc(doc(db, 'heroes', id), updates);
}

export async function deleteHero(id) {
  return deleteDoc(doc(db, 'heroes', id));
}

/* ---------------- REVIEWS ---------------- */

export async function getApprovedReviews() {
  const snap = await getDocs(collection(db, 'reviews'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.approved === true);
}

export function watchReviews(callback) {
  return onSnapshot(collection(db, 'reviews'), (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addReview(review) {
  return addDoc(collection(db, 'reviews'), review);
}

export async function updateReview(id, updates) {
  return updateDoc(doc(db, 'reviews', id), updates);
}

export async function deleteReview(id) {
  return deleteDoc(doc(db, 'reviews', id));
}

/* ---------------- SOURCING REQUESTS ---------------- */

export async function placeRequest(request) {
  return addDoc(collection(db, 'requests'), {
    ...request,
    status: 'new',
    createdAt: serverTimestamp()
  });
}

export function watchRequests(callback) {
  const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function updateRequestStatus(id, status) {
  return updateDoc(doc(db, 'requests', id), { status });
}

/* ---------------- SETTINGS ---------------- */

export async function getSettings() {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  return snap.exists() ? snap.data() : {};
}

export async function saveSettings(settings) {
  return setDoc(doc(db, 'settings', 'site'), settings, { merge: true });
}

/* ---------------- INVENTORY ADMIN TAB ---------------- */
if (location.pathname.endsWith('/admin/') || location.pathname.endsWith('/admin/index.html')) {
  const setupInventoryTab = async () => {
    const tabs = document.querySelector('.tab-btn')?.parentElement;
    if (!tabs || document.getElementById('inventoryTabBtn')) return;
    const button = document.createElement('button');
    button.id = 'inventoryTabBtn';
    button.dataset.tab = 'inventory';
    button.className = 'tab-btn px-5 py-2 rounded-full text-xs font-bold bg-gray-100';
    button.textContent = 'Inventory';
    tabs.insertBefore(button, tabs.children[1] || null);
    const panel = document.createElement('div');
    panel.id = 'panel-inventory';
    panel.className = 'tab-panel hidden';
    panel.innerHTML = '<div id="inventoryContent"></div>';
    const anchor = document.getElementById('panel-heroes');
    if (anchor) anchor.parentElement.insertBefore(panel, anchor);
    const { initInventory } = await import('../admin/js/inventory.mjs');
    let stop = null;
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      button.classList.add('tab-active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      panel.classList.remove('hidden');
      if (!stop) stop = initInventory();
    });
    document.querySelectorAll('.tab-btn:not(#inventoryTabBtn)').forEach(other => other.addEventListener('click', () => {
      if (stop) { stop(); stop = null; }
    }));
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupInventoryTab, { once: true });
  else setupInventoryTab();
}

/* ---------------- SHOP-EAZY: PARTNERS & OUTLETS ---------------- */
// These helpers define the ShopEazy managed-retail data layer without
// changing the existing EazyLife product/order/inventory behavior.
// They are intentionally opt-in: no ShopEazy documents are created until
// an admin workflow calls the create functions below.

const SHOP_EAZY_PARTNER_STATUSES = ['ACTIVE', 'INACTIVE'];
const SHOP_EAZY_OUTLET_STATUSES = ['ACTIVE', 'INACTIVE'];

function cleanRequiredString(value, fieldName) {
  const valueText = String(value ?? '').trim();
  if (!valueText) throw new Error(`${fieldName} is required.`);
  return valueText;
}

function cleanStatus(value, allowed, fieldName) {
  const normalized = String(value || 'ACTIVE').trim().toUpperCase();
  if (!allowed.includes(normalized)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}.`);
  }
  return normalized;
}

function nowAuditFields() {
  return { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
}

/**
 * Create a ShopEazy partner. Partners provide inventory/outlets but are not
 * independent marketplace sellers.
 */
export async function createShopEazyPartner({ name, status = 'ACTIVE', contact = null, notes = null } = {}) {
  const partner = {
    name: cleanRequiredString(name, 'Partner name'),
    status: cleanStatus(status, SHOP_EAZY_PARTNER_STATUSES, 'Partner status'),
    contact: contact ?? null,
    notes: notes ?? null,
    ...nowAuditFields()
  };
  return addDoc(collection(db, 'partners'), partner);
}

export async function getShopEazyPartner(partnerId) {
  if (!partnerId) return null;
  const snap = await getDoc(doc(db, 'partners', partnerId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getShopEazyPartners() {
  const snap = await getDocs(collection(db, 'partners'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateShopEazyPartner(partnerId, updates = {}) {
  if (!partnerId) throw new Error('Partner ID is required.');
  const next = { ...updates };
  if ('name' in next) next.name = cleanRequiredString(next.name, 'Partner name');
  if ('status' in next) next.status = cleanStatus(next.status, SHOP_EAZY_PARTNER_STATUSES, 'Partner status');
  next.updatedAt = serverTimestamp();
  return updateDoc(doc(db, 'partners', partnerId), next);
}

/**
 * Create an outlet belonging to a partner. The partner relationship is stored
 * on the outlet itself so authorization can later be based on Firestore data.
 */
export async function createShopEazyOutlet({
  partnerId,
  name,
  status = 'ACTIVE',
  address = null,
  serviceAreas = [],
  fulfillmentEnabled = true,
  operatingHours = null
} = {}) {
  const partnerRef = doc(db, 'partners', cleanRequiredString(partnerId, 'Partner ID'));
  const partnerSnap = await getDoc(partnerRef);
  if (!partnerSnap.exists()) throw new Error('Cannot create outlet: partner does not exist.');

  const outlet = {
    partnerId,
    name: cleanRequiredString(name, 'Outlet name'),
    status: cleanStatus(status, SHOP_EAZY_OUTLET_STATUSES, 'Outlet status'),
    address: address ?? null,
    serviceAreas: Array.isArray(serviceAreas) ? serviceAreas : [],
    fulfillmentEnabled: Boolean(fulfillmentEnabled),
    operatingHours: operatingHours ?? null,
    ...nowAuditFields()
  };
  return addDoc(collection(db, 'outlets'), outlet);
}

export async function getShopEazyOutlet(outletId) {
  if (!outletId) return null;
  const snap = await getDoc(doc(db, 'outlets', outletId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getShopEazyOutlets({ partnerId = null, activeOnly = false } = {}) {
  const snap = await getDocs(collection(db, 'outlets'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(outlet => !partnerId || outlet.partnerId === partnerId)
    .filter(outlet => !activeOnly || (outlet.status === 'ACTIVE' && outlet.fulfillmentEnabled === true));
}

export async function updateShopEazyOutlet(outletId, updates = {}) {
  if (!outletId) throw new Error('Outlet ID is required.');
  const next = { ...updates };
  if ('name' in next) next.name = cleanRequiredString(next.name, 'Outlet name');
  if ('partnerId' in next) next.partnerId = cleanRequiredString(next.partnerId, 'Partner ID');
  if ('status' in next) next.status = cleanStatus(next.status, SHOP_EAZY_OUTLET_STATUSES, 'Outlet status');
  if ('serviceAreas' in next && !Array.isArray(next.serviceAreas)) {
    throw new Error('Outlet serviceAreas must be an array.');
  }
  if ('fulfillmentEnabled' in next) next.fulfillmentEnabled = Boolean(next.fulfillmentEnabled);
  next.updatedAt = serverTimestamp();
  return updateDoc(doc(db, 'outlets', outletId), next);
}
\n

/* ---------------- SHOP-EAZY: OUTLET INVENTORY ---------------- */
// Outlet inventory is a separate stock ledger for ShopEazy. The legacy
// products.variants[].stockQty field is deliberately left untouched here.
// Inventory IDs are deterministic: outletId__variantId.

function shopEazyInventoryId(outletId, variantId) {
  const outlet = cleanRequiredString(outletId, 'Outlet ID');
  const variant = cleanRequiredString(variantId, 'Variant ID');
  return `${outlet}__${variant}`;
}

async function validateShopEazyOutletForInventory(outletId) {
  const outlet = await getShopEazyOutlet(outletId);
  if (!outlet) throw new Error('Outlet does not exist.');
  if (outlet.status !== 'ACTIVE' || outlet.fulfillmentEnabled !== true) {
    throw new Error('Outlet is not active for fulfillment.');
  }
  return outlet;
}

async function validateShopEazyVariant(productId, variantId) {
  const productRef = doc(db, 'products', cleanRequiredString(productId, 'Product ID'));
  const snap = await getDoc(productRef);
  if (!snap.exists()) throw new Error('Product does not exist.');
  const product = snap.data();
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const index = variants.findIndex(v => v?.id === variantId);
  if (index < 0) throw new Error('Product variant does not exist.');
  return { product, variant: variants[index] };
}

/**
 * Create or update an outlet inventory record without touching legacy stock.
 * This is intended for controlled setup/reconciliation, not order approval.
 */
export async function setShopEazyOutletInventory({
  outletId,
  partnerId,
  productId,
  variantId,
  quantityOnHand = 0,
  reorderLevel = 0,
  costPrice = null,
  active = true
} = {}) {
  const outlet = await validateShopEazyOutletForInventory(outletId);
  const { variant } = await validateShopEazyVariant(productId, variantId);
  if (partnerId && partnerId !== outlet.partnerId) throw new Error('Partner does not own the selected outlet.');

  const quantity = Number(quantityOnHand);
  const reorder = Number(reorderLevel);
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('quantityOnHand must be a non-negative integer.');
  if (!Number.isInteger(reorder) || reorder < 0) throw new Error('reorderLevel must be a non-negative integer.');

  const inventoryId = shopEazyInventoryId(outletId, variantId);
  const inventoryRef = doc(db, 'outletInventory', inventoryId);
  const snap = await getDoc(inventoryRef);
  const data = {
    productId,
    variantId,
    outletId,
    partnerId: outlet.partnerId,
    quantityOnHand: quantity,
    reorderLevel: reorder,
    costPrice: costPrice ?? null,
    active: Boolean(active),
    sku: variant.sku || '',
    updatedAt: serverTimestamp()
  };
  if (!snap.exists()) data.createdAt = serverTimestamp();
  return setDoc(inventoryRef, data, { merge: true });
}

export async function getShopEazyOutletInventory(outletId, variantId) {
  if (!outletId || !variantId) return null;
  const snap = await getDoc(doc(db, 'outletInventory', shopEazyInventoryId(outletId, variantId)));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getShopEazyOutletInventoryForOutlet(outletId, { activeOnly = false } = {}) {
  const snap = await getDocs(collection(db, 'outletInventory'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => item.outletId === outletId)
    .filter(item => !activeOnly || item.active === true);
}

export async function getShopEazyOutletInventoryForVariant(variantId, { activeOnly = true } = {}) {
  const snap = await getDocs(collection(db, 'outletInventory'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(item => item.variantId === variantId)
    .filter(item => !activeOnly || item.active === true);
}

/**
 * Record a controlled stock adjustment. All quantity and movement writes are
 * in one Firestore transaction so the ledger cannot record a value different
 * from the inventory document it describes.
 */
export async function adjustShopEazyOutletInventory({
  outletId,
  variantId,
  quantityChange,
  movementType = 'correction',
  reason = null,
  actorUid = null,
  referenceType = null,
  referenceId = null
} = {}) {
  const change = Number(quantityChange);
  if (!Number.isInteger(change) || change === 0) throw new Error('quantityChange must be a non-zero integer.');
  if (!['receipt', 'correction', 'transferIn', 'transferOut', 'return'].includes(movementType)) {
    throw new Error('Invalid ShopEazy inventory movement type.');
  }

  const outlet = await validateShopEazyOutletForInventory(outletId);
  const inventoryRef = doc(db, 'outletInventory', shopEazyInventoryId(outletId, variantId));
  const movementRef = doc(collection(db, 'inventoryMovements'));

  return runTransaction(db, async tx => {
    const inventorySnap = await tx.get(inventoryRef);
    if (!inventorySnap.exists()) throw new Error('Outlet inventory record does not exist. Initialize it before adjusting stock.');
    const current = Number(inventorySnap.data().quantityOnHand);
    if (!Number.isInteger(current) || current < 0) throw new Error('Outlet inventory contains an invalid quantity.');
    const next = current + change;
    if (next < 0) throw new Error(`Insufficient outlet stock. Current stock: ${current}, requested change: ${change}.`);

    tx.update(inventoryRef, { quantityOnHand: next, updatedAt: serverTimestamp() });
    tx.set(movementRef, {
      productId: inventorySnap.data().productId,
      variantId,
      outletId,
      partnerId: outlet.partnerId,
      movementType,
      quantityChange: change,
      previousQuantity: current,
      newQuantity: next,
      referenceType: referenceType ?? 'manualAdjustment',
      referenceId: referenceId ?? null,
      reason: reason ?? null,
      actorUid: actorUid ?? null,
      createdAt: serverTimestamp()
    });
  });
}
\n

/* ---------------- SHOP-EAZY: ORDER ALLOCATION / FULFILLMENT GROUPS ---------------- */
// Allocation is planning data only. It does NOT deduct or reserve stock.
// Stock is committed later by the atomic approval transaction.

const SHOP_EAZY_GROUP_STATUSES = ['UNALLOCATED', 'ALLOCATED', 'APPROVED', 'PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'];

function shopEazyOrderItemId(index) {
  return `item-${Number(index)}`;
}

function validateNonNegativeInteger(value, fieldName) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${fieldName} must be a non-negative integer.`);
  return number;
}

function validateAllocationStatus(status) {
  const normalized = String(status || 'UNALLOCATED').trim().toUpperCase();
  if (!SHOP_EAZY_GROUP_STATUSES.includes(normalized)) {
    throw new Error(`Invalid fulfillment group status: ${normalized}.`);
  }
  return normalized;
}

export async function getShopEazyFulfillmentGroups(orderId) {
  if (!orderId) return [];
  const snap = await getDocs(collection(db, 'orders', orderId, 'fulfillmentGroups'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Creates an empty fulfillment group for an active fulfillment-enabled outlet.
 * No inventory is changed and no quantity is reserved.
 */
export async function createShopEazyFulfillmentGroup({
  orderId,
  outletId,
  groupId = null,
  delivery = null,
  status = 'UNALLOCATED'
} = {}) {
  const order = await getOrderByTrackingCode(orderId);
  if (!order) throw new Error('Order does not exist.');
  const outlet = await validateShopEazyOutletForInventory(outletId);
  const normalizedStatus = validateAllocationStatus(status);
  if (['APPROVED', 'PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'].includes(normalizedStatus)) {
    throw new Error('A newly created fulfillment group cannot start in a completed or committed state.');
  }

  const groupRef = groupId
    ? doc(db, 'orders', orderId, 'fulfillmentGroups', groupId)
    : doc(collection(db, 'orders', orderId, 'fulfillmentGroups'));
  const groupIdValue = groupRef.id;
  await setDoc(groupRef, {
    outletId,
    partnerId: outlet.partnerId,
    status: normalizedStatus,
    items: [],
    delivery: delivery ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return groupIdValue;
}

/**
 * Allocate or reallocate an order item to an existing fulfillment group.
 * The transaction validates the entire order allocation invariant:
 * ordered = allocated + unallocated, and no group can allocate more than
 * the order item quantity. This function intentionally never changes stock.
 */
export async function allocateShopEazyOrderItem({
  orderId,
  groupId,
  orderItemIndex,
  quantityAllocated,
  actorUid = null,
  note = null
} = {}) {
  const itemIndex = Number(orderItemIndex);
  if (!Number.isInteger(itemIndex) || itemIndex < 0) throw new Error('orderItemIndex must be a non-negative integer.');
  const requestedAllocation = validateNonNegativeInteger(quantityAllocated, 'quantityAllocated');
  const orderRef = doc(db, 'orders', cleanRequiredString(orderId, 'Order ID'));
  const groupRef = doc(db, 'orders', orderId, 'fulfillmentGroups', cleanRequiredString(groupId, 'Group ID'));

  return runTransaction(db, async tx => {
    const [orderSnap, groupSnap] = await Promise.all([tx.get(orderRef), tx.get(groupRef)]);
    if (!orderSnap.exists()) throw new Error('Order does not exist.');
    if (!groupSnap.exists()) throw new Error('Fulfillment group does not exist.');

    const order = orderSnap.data();
    const group = groupSnap.data();
    const groupsSnap = await tx.get(collection(db, 'orders', orderId, 'fulfillmentGroups'));
    const items = Array.isArray(order.items) ? order.items : [];
    const orderItem = items[itemIndex];
    if (!orderItem) throw new Error('Order item does not exist.');
    if (!orderItem.variantId) throw new Error('Order item has no variant ID. Allocation cannot be made safely.');
    if (['APPROVED', 'PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'].includes(String(group.status || '').toUpperCase())) {
      throw new Error('This fulfillment group can no longer be allocated or changed.');
    }

    const orderedQuantity = validateNonNegativeInteger(orderItem.quantity, 'Order quantity');
    let totalAllocated = 0;
    const allGroups = [];
    groupsSnap.forEach(groupDoc => {
      const data = groupDoc.data();
      const groupItems = Array.isArray(data.items) ? data.items : [];
      const match = groupItems.find(i => i?.orderItemId === shopEazyOrderItemId(itemIndex));
      const qty = match ? validateNonNegativeInteger(match.quantityAllocated || 0, 'Existing allocated quantity') : 0;
      if (qty) totalAllocated += qty;
      allGroups.push({ ref: groupDoc.ref, data, items: groupItems });
    });

    const target = allGroups.find(g => g.ref.path === groupRef.path);
    if (!target) throw new Error('Fulfillment group could not be read consistently.');
    const targetExisting = target.items.find(i => i?.orderItemId === shopEazyOrderItemId(itemIndex));
    const oldTargetQuantity = targetExisting ? validateNonNegativeInteger(targetExisting.quantityAllocated || 0, 'Existing target allocation') : 0;
    const otherAllocated = totalAllocated - oldTargetQuantity;
    if (otherAllocated + requestedAllocation > orderedQuantity) {
      throw new Error(`Allocation exceeds ordered quantity. Ordered: ${orderedQuantity}, other outlets: ${otherAllocated}, requested here: ${requestedAllocation}.`);
    }

    // Allocation changes are planning-only. Once any quantity for this item
    // has been approved/fulfilled, it must be moved through the dedicated
    // reassignment transaction so committed stock is restored/deducted safely.
    for (const entry of allGroups) {
      const existing = entry.items.find(i => i?.orderItemId === shopEazyOrderItemId(itemIndex));
      const existingApproved = existing ? validateNonNegativeInteger(existing.quantityApproved || 0, 'Approved quantity') : 0;
      const existingFulfilled = existing ? validateNonNegativeInteger(existing.quantityFulfilled || 0, 'Fulfilled quantity') : 0;
      if (existingApproved > 0 || existingFulfilled > 0 || ['APPROVED', 'PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'].includes(String(entry.data.status || '').toUpperCase())) {
        throw new Error('This order item has already entered committed fulfillment and cannot be changed with allocation planning. Use controlled reassignment instead.');
      }
    }

    for (const entry of allGroups) {
      let nextItems = entry.items.filter(i => i?.orderItemId !== shopEazyOrderItemId(itemIndex));
      const existing = entry.items.find(i => i?.orderItemId === shopEazyOrderItemId(itemIndex));
      if (entry.ref.path === groupRef.path && requestedAllocation > 0) {
        nextItems.push({
          orderItemId: shopEazyOrderItemId(itemIndex),
          orderItemIndex: itemIndex,
          productId: orderItem.productId,
          variantId: orderItem.variantId,
          sku: orderItem.sku || '',
          nameSnapshot: orderItem.name || '',
          variantSnapshot: orderItem.variant || '',
          quantityAllocated: requestedAllocation,
          quantityApproved: validateNonNegativeInteger(existing?.quantityApproved || 0, 'Approved quantity'),
          quantityFulfilled: validateNonNegativeInteger(existing?.quantityFulfilled || 0, 'Fulfilled quantity')
        });
      }

      const groupAllocated = nextItems.reduce((sum, i) => sum + validateNonNegativeInteger(i.quantityAllocated || 0, 'Group allocation'), 0);
      const nextStatus = groupAllocated > 0 ? 'ALLOCATED' : 'UNALLOCATED';
      tx.update(entry.ref, {
        items: nextItems,
        status: nextStatus,
        updatedAt: serverTimestamp(),
        ...(entry.ref.path === groupRef.path && note ? { allocationNote: note, allocationActorUid: actorUid } : {})
      });
    }

    const newTotalAllocated = otherAllocated + requestedAllocation;
    const unallocatedQuantity = orderedQuantity - newTotalAllocated;
    tx.update(orderRef, {
      updatedAt: serverTimestamp(),
      shopEazyAllocationSummary: {
        ...(order.shopEazyAllocationSummary || {}),
        lastChangedBy: actorUid ?? null,
        lastChangedAt: serverTimestamp(),
        lastChangedItemId: shopEazyOrderItemId(itemIndex),
        lastOrderedQuantity: orderedQuantity,
        lastAllocatedQuantity: newTotalAllocated,
        lastUnallocatedQuantity: unallocatedQuantity
      }
    });

    return { orderedQuantity, allocatedQuantity: newTotalAllocated, unallocatedQuantity };
  });
}

/**
 * Rebuilds a complete allocation summary from Firestore. This is useful for
 * the admin review screen and deliberately reads the authoritative groups.
 */
export async function getShopEazyOrderAllocationSummary(orderId) {
  const order = await getOrderByTrackingCode(orderId);
  if (!order) throw new Error('Order does not exist.');
  const groups = await getShopEazyFulfillmentGroups(orderId);
  const items = Array.isArray(order.items) ? order.items : [];

  return items.map((item, index) => {
    const orderItemId = shopEazyOrderItemId(index);
    const orderedQuantity = validateNonNegativeInteger(item.quantity, 'Order quantity');
    const allocations = groups.map(group => {
      const groupItem = (Array.isArray(group.items) ? group.items : []).find(i => i?.orderItemId === orderItemId);
      return {
        groupId: group.id,
        outletId: group.outletId,
        partnerId: group.partnerId,
        quantityAllocated: validateNonNegativeInteger(groupItem?.quantityAllocated || 0, 'Allocated quantity'),
        quantityApproved: validateNonNegativeInteger(groupItem?.quantityApproved || 0, 'Approved quantity'),
        quantityFulfilled: validateNonNegativeInteger(groupItem?.quantityFulfilled || 0, 'Fulfilled quantity')
      };
    }).filter(a => a.quantityAllocated > 0 || a.quantityApproved > 0 || a.quantityFulfilled > 0);
    const allocatedQuantity = allocations.reduce((sum, a) => sum + a.quantityAllocated, 0);
    const approvedQuantity = allocations.reduce((sum, a) => sum + a.quantityApproved, 0);
    if (allocatedQuantity > orderedQuantity) throw new Error(`Invalid allocation: item ${index} allocates more than ordered.`);
    if (approvedQuantity > allocatedQuantity) throw new Error(`Invalid approval allocation: item ${index} approves more than allocated.`);
    return {
      orderItemId,
      orderItemIndex: index,
      productId: item.productId,
      variantId: item.variantId,
      orderedQuantity,
      allocatedQuantity,
      unallocatedQuantity: orderedQuantity - allocatedQuantity,
      approvedQuantity,
      allocations
    };
  });
}
\n

/* ---------------- SHOP-EAZY: ATOMIC ORDER APPROVAL ---------------- */
// Approval is the point at which ShopEazy commits outlet stock.
// Every affected inventory, fulfillment-group, movement, audit, and order
// write is part of one Firestore transaction. No external side effects belong
// inside the transaction callback because Firestore may retry it.

const SHOP_EAZY_PARTIAL_RESOLUTIONS = [
  'WAIT_FOR_STOCK',
  'CUSTOMER_ACCEPTED',
  'SUBSTITUTION',
  'CANCEL_REMAINDER'
];

const SHOP_EAZY_APPROVAL_ELIGIBLE = ['NEW', 'PROCESSING'];
const SHOP_EAZY_NON_APPROVAL_GROUP_STATUSES = [
  'PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'
];

function shopEazyApprovalError(message) {
  const error = new Error(message);
  error.code = 'SHOP_EAZY_APPROVAL_FAILED';
  return error;
}

function shopEazyNormalizeResolution(path) {
  const normalized = String(path || '').trim().toUpperCase();
  if (!SHOP_EAZY_PARTIAL_RESOLUTIONS.includes(normalized)) {
    throw shopEazyApprovalError('A valid partial approval resolution path is required.');
  }
  return normalized;
}

/**
 * Atomically approves a ShopEazy order allocation.
 *
 * FULL:
 *   every ordered unit must already be allocated; all allocated quantities
 *   are approved and deducted.
 *
 * PARTIAL:
 *   only currently allocated quantities are approved/deducted; unallocated
 *   quantities remain explicit and must have a resolution path.
 *
 * Allocation data is re-read from Firestore. The browser cannot supply or
 * override the authoritative approved quantities.
 */
export async function approveShopEazyOrder({
  orderId,
  actorUid,
  approvalMode = 'FULL',
  resolutionPath = null,
  resolutionNote = null
} = {}) {
  const normalizedOrderId = cleanRequiredString(orderId, 'Order ID');
  const actor = cleanRequiredString(actorUid, 'Actor UID');
  const mode = String(approvalMode || 'FULL').trim().toUpperCase();
  if (!['FULL', 'PARTIAL'].includes(mode)) {
    throw shopEazyApprovalError('approvalMode must be FULL or PARTIAL.');
  }
  const normalizedResolution = mode === 'PARTIAL'
    ? shopEazyNormalizeResolution(resolutionPath)
    : null;

  const orderRef = doc(db, 'orders', normalizedOrderId);

  return runTransaction(db, async tx => {
    // ---------------- READ PHASE ----------------
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists()) throw shopEazyApprovalError('Order does not exist.');

    const order = orderSnap.data();
    const orderStatus = String(order.status || '').trim().toUpperCase();
    const approvalStatus = String(order.approvalStatus || 'NOT_REVIEWED').trim().toUpperCase();

    if (order.inventoryApplied === true) {
      throw shopEazyApprovalError('This order has already had inventory applied.');
    }
    if (!SHOP_EAZY_APPROVAL_ELIGIBLE.includes(orderStatus)) {
      throw shopEazyApprovalError(`Order is not approval-eligible in status ${orderStatus || 'UNKNOWN'}.`);
    }
    if (['APPROVED', 'REJECTED'].includes(approvalStatus)) {
      throw shopEazyApprovalError(`Order approval status ${approvalStatus} cannot be approved again.`);
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];
    if (!orderItems.length) throw shopEazyApprovalError('Order has no items to approve.');

    const groupsSnap = await tx.get(collection(db, 'orders', normalizedOrderId, 'fulfillmentGroups'));
    const groups = groupsSnap.docs.map(groupDoc => ({
      ref: groupDoc.ref,
      id: groupDoc.id,
      data: groupDoc.data(),
      items: Array.isArray(groupDoc.data().items) ? groupDoc.data().items : []
    }));

    if (!groups.length) throw shopEazyApprovalError('No fulfillment groups exist for this order.');

    // Build authoritative allocation totals from Firestore.
    const itemPlans = orderItems.map((item, index) => ({
      index,
      orderItemId: shopEazyOrderItemId(index),
      productId: item.productId || null,
      variantId: item.variantId || null,
      sku: item.sku || '',
      orderedQuantity: validateNonNegativeInteger(item.quantity, 'Order quantity'),
      allocatedQuantity: 0,
      approvedQuantity: 0,
      unallocatedQuantity: 0,
      groupPlans: []
    }));

    for (const group of groups) {
      const groupStatus = String(group.data.status || 'UNALLOCATED').trim().toUpperCase();
      if (SHOP_EAZY_NON_APPROVAL_GROUP_STATUSES.includes(groupStatus)) {
        throw shopEazyApprovalError(`Fulfillment group ${group.id} is already in status ${groupStatus} and cannot be approved.`);
      }

      const outletRef = doc(db, 'outlets', group.data.outletId || '__missing__');
      const outletSnap = await tx.get(outletRef);
      if (!outletSnap.exists()) throw shopEazyApprovalError(`Outlet for fulfillment group ${group.id} does not exist.`);
      const outlet = outletSnap.data();
      if (String(outlet.status || '').trim().toUpperCase() !== 'ACTIVE' || outlet.fulfillmentEnabled !== true) {
        throw shopEazyApprovalError(`Outlet ${group.data.outletId || group.id} is not active and fulfillment-enabled.`);
      }

      for (const groupItem of group.items) {
        const index = Number(groupItem.orderItemIndex);
        const plan = itemPlans[index];
        if (!plan || groupItem.orderItemId !== shopEazyOrderItemId(index)) {
          throw shopEazyApprovalError(`Invalid order-item reference in fulfillment group ${group.id}.`);
        }
        if (groupItem.productId !== plan.productId || groupItem.variantId !== plan.variantId) {
          throw shopEazyApprovalError(`Product/variant mismatch in fulfillment group ${group.id}.`);
        }

        const allocated = validateNonNegativeInteger(groupItem.quantityAllocated || 0, 'Allocated quantity');
        const existingApproved = validateNonNegativeInteger(groupItem.quantityApproved || 0, 'Approved quantity');
        const fulfilled = validateNonNegativeInteger(groupItem.quantityFulfilled || 0, 'Fulfilled quantity');
        if (existingApproved > allocated) throw shopEazyApprovalError(`Approved quantity exceeds allocation in group ${group.id}.`);
        if (fulfilled > existingApproved) throw shopEazyApprovalError(`Fulfilled quantity exceeds approved quantity in group ${group.id}.`);
        if (existingApproved > 0 || fulfilled > 0) {
          throw shopEazyApprovalError(`Fulfillment group ${group.id} already contains committed quantity.`);
        }

        plan.allocatedQuantity += allocated;
        plan.groupPlans.push({ group, groupItem, allocated });
      }
    }

    // Validate allocation totals before deciding what gets committed.
    for (const plan of itemPlans) {
      if (!plan.variantId) throw shopEazyApprovalError(`Order item ${plan.index} has no variant ID.`);
      if (plan.allocatedQuantity > plan.orderedQuantity) {
        throw shopEazyApprovalError(`Item ${plan.index} allocates more than ordered.`);
      }
      plan.unallocatedQuantity = plan.orderedQuantity - plan.allocatedQuantity;
      if (mode === 'FULL' && plan.unallocatedQuantity > 0) {
        throw shopEazyApprovalError(`Full approval requires complete allocation for item ${plan.index}; ${plan.unallocatedQuantity} unit(s) remain unallocated.`);
      }
      plan.approvedQuantity = plan.allocatedQuantity;
      if (mode === 'PARTIAL' && plan.approvedQuantity === 0 && plan.unallocatedQuantity === 0) {
        throw shopEazyApprovalError(`Item ${plan.index} has no approvable quantity.`);
      }
    }

    // Inventory reads are all performed inside the transaction.
    const inventoryPlans = [];
    for (const plan of itemPlans) {
      for (const gp of plan.groupPlans) {
        if (gp.allocated === 0) continue;
        const inventoryId = shopEazyInventoryId(gp.group.data.outletId, plan.variantId);
        const inventoryRef = doc(db, 'outletInventory', inventoryId);
        const inventorySnap = await tx.get(inventoryRef);
        if (!inventorySnap.exists()) {
          throw shopEazyApprovalError(`Outlet inventory record is missing for outlet ${gp.group.data.outletId}, variant ${plan.variantId}.`);
        }
        const inventory = inventorySnap.data();
        if (inventory.active === false) {
          throw shopEazyApprovalError(`Outlet inventory is inactive for outlet ${gp.group.data.outletId}, variant ${plan.variantId}.`);
        }
        if (inventory.productId !== plan.productId || inventory.variantId !== plan.variantId) {
          throw shopEazyApprovalError(`Outlet inventory does not match the order item for outlet ${gp.group.data.outletId}.`);
        }
        const current = validateNonNegativeInteger(inventory.quantityOnHand, 'Outlet quantityOnHand');
        if (current < gp.allocated) {
          throw shopEazyApprovalError(`Insufficient stock at outlet ${gp.group.data.outletId}. Available: ${current}, required: ${gp.allocated}.`);
        }
        inventoryPlans.push({ plan, gp, inventoryRef, inventorySnap, inventory, current });
      }
    }

    // ---------------- WRITE PHASE ----------------
    const nowFields = { updatedAt: serverTimestamp() };

    for (const entry of inventoryPlans) {
      const next = entry.current - entry.gp.allocated;
      tx.update(entry.inventoryRef, {
        quantityOnHand: next,
        updatedAt: serverTimestamp()
      });

      const movementRef = doc(collection(db, 'inventoryMovements'));
      tx.set(movementRef, {
        productId: entry.plan.productId,
        variantId: entry.plan.variantId,
        sku: entry.plan.sku,
        outletId: entry.gp.group.data.outletId,
        partnerId: entry.gp.group.data.partnerId || entry.inventory.partnerId || null,
        movementType: 'sale',
        quantityChange: -entry.gp.allocated,
        previousQuantity: entry.current,
        newQuantity: next,
        referenceType: 'orderApproval',
        referenceId: normalizedOrderId,
        fulfillmentGroupId: entry.gp.group.id,
        actorUid: actor,
        createdAt: serverTimestamp()
      });
    }

    for (const group of groups) {
      const nextItems = group.items.map(groupItem => {
        const index = Number(groupItem.orderItemIndex);
        const plan = itemPlans[index];
        if (!plan) return groupItem;
        const allocated = validateNonNegativeInteger(groupItem.quantityAllocated || 0, 'Allocated quantity');
        return {
          ...groupItem,
          quantityApproved: allocated,
          quantityFulfilled: 0
        };
      });
      const hasApproved = nextItems.some(item => Number(item.quantityApproved || 0) > 0);
      tx.update(group.ref, {
        items: nextItems,
        status: hasApproved ? 'APPROVED' : 'UNALLOCATED',
        updatedAt: serverTimestamp()
      });
    }

    const totalOrdered = itemPlans.reduce((sum, p) => sum + p.orderedQuantity, 0);
    const totalApproved = itemPlans.reduce((sum, p) => sum + p.approvedQuantity, 0);
    const totalUnallocated = itemPlans.reduce((sum, p) => sum + p.unallocatedQuantity, 0);

    const auditRef = doc(collection(db, 'shopEazyAudit'));
    tx.set(auditRef, {
      action: 'ORDER_APPROVED',
      orderId: normalizedOrderId,
      approvalMode: mode,
      approvalStatus: mode === 'FULL' ? 'APPROVED' : 'PARTIAL',
      orderedQuantity: totalOrdered,
      approvedQuantity: totalApproved,
      unallocatedQuantity: totalUnallocated,
      resolutionPath: normalizedResolution,
      resolutionNote: resolutionNote ?? null,
      actorUid: actor,
      createdAt: serverTimestamp()
    });

    tx.update(orderRef, {
      status: 'APPROVED',
      approvalStatus: mode === 'FULL' ? 'APPROVED' : 'PARTIAL',
      inventoryApplied: true,
      fulfillmentSummary: {
        orderedQuantity: totalOrdered,
        approvedQuantity: totalApproved,
        unallocatedQuantity: totalUnallocated
      },
      partialResolution: mode === 'PARTIAL'
        ? { path: normalizedResolution, note: resolutionNote ?? null }
        : null,
      approvedAt: serverTimestamp(),
      approvedBy: actor,
      updatedAt: serverTimestamp()
    });

    return {
      orderId: normalizedOrderId,
      approvalStatus: mode === 'FULL' ? 'APPROVED' : 'PARTIAL',
      orderedQuantity: totalOrdered,
      approvedQuantity: totalApproved,
      unallocatedQuantity: totalUnallocated
    };
  });
}

/* ---------------- SHOP-EAZY: CONTROLLED REASSIGNMENT ---------------- */
// Moves an already-approved, still-unfulfilled quantity between outlets.
// Approval committed the sale at the source outlet; reassignment therefore
// restores source stock and commits the same quantity at the destination.
// This is one transaction, so the physical stock and fulfillment allocation
// change together.

const SHOP_EAZY_REASSIGNMENT_BLOCKED_GROUP_STATUSES = [
  'PICKING', 'READY', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'RETURNED'
];

export async function reassignShopEazyOrderQuantity({
  orderId,
  sourceGroupId,
  destinationGroupId = null,
  destinationOutletId = null,
  orderItemId,
  quantity,
  actorUid,
  reason
} = {}) {
  const normalizedOrderId = cleanRequiredString(orderId, 'Order ID');
  const sourceId = cleanRequiredString(sourceGroupId, 'Source group ID');
  const itemId = cleanRequiredString(orderItemId, 'Order item ID');
  const actor = cleanRequiredString(actorUid, 'Actor UID');
  const moveQuantity = validateNonNegativeInteger(quantity, 'Reassignment quantity');
  if (moveQuantity <= 0) throw shopEazyApprovalError('Reassignment quantity must be greater than zero.');
  const moveReason = cleanRequiredString(reason, 'Reassignment reason');

  if (!destinationGroupId && !destinationOutletId) {
    throw shopEazyApprovalError('Provide a destination group ID or destination outlet ID.');
  }

  const sourceGroupRef = doc(db, 'orders', normalizedOrderId, 'fulfillmentGroups', sourceId);
  const destinationGroupRef = destinationGroupId
    ? doc(db, 'orders', normalizedOrderId, 'fulfillmentGroups', cleanRequiredString(destinationGroupId, 'Destination group ID'))
    : doc(collection(db, 'orders', normalizedOrderId, 'fulfillmentGroups'));

  const orderRef = doc(db, 'orders', normalizedOrderId);

  return runTransaction(db, async tx => {
    // ---------------- READ PHASE ----------------
    const orderSnap = await tx.get(orderRef);
    const sourceSnap = await tx.get(sourceGroupRef);
    if (!orderSnap.exists()) throw shopEazyApprovalError('Order does not exist.');
    if (!sourceSnap.exists()) throw shopEazyApprovalError('Source fulfillment group does not exist.');

    const order = orderSnap.data();
    if (order.inventoryApplied !== true) {
      throw shopEazyApprovalError('Order inventory has not been committed; ordinary allocation should be used instead.');
    }
    if (['CANCELLED', 'RETURNED'].includes(String(order.status || '').trim().toUpperCase())) {
      throw shopEazyApprovalError('Cancelled or returned orders cannot be reassigned.');
    }

    const source = sourceSnap.data();
    const sourceStatus = String(source.status || 'UNALLOCATED').trim().toUpperCase();
    if (SHOP_EAZY_REASSIGNMENT_BLOCKED_GROUP_STATUSES.includes(sourceStatus)) {
      throw shopEazyApprovalError(`Source fulfillment group is already in status ${sourceStatus}.`);
    }

    const sourceItem = (Array.isArray(source.items) ? source.items : [])
      .find(item => item?.orderItemId === itemId);
    if (!sourceItem) throw shopEazyApprovalError('Order item is not present in the source fulfillment group.');

    const sourceApproved = validateNonNegativeInteger(sourceItem.quantityApproved || 0, 'Source approved quantity');
    const sourceFulfilled = validateNonNegativeInteger(sourceItem.quantityFulfilled || 0, 'Source fulfilled quantity');
    const sourceAllocated = validateNonNegativeInteger(sourceItem.quantityAllocated || 0, 'Source allocated quantity');

    if (sourceApproved < moveQuantity) {
      throw shopEazyApprovalError(`Cannot reassign ${moveQuantity} unit(s); source has only ${sourceApproved} approved.`);
    }
    if (sourceFulfilled > sourceApproved) {
      throw shopEazyApprovalError('Source fulfillment data is invalid.');
    }
    const availableToMove = sourceApproved - sourceFulfilled;
    if (moveQuantity > availableToMove) {
      throw shopEazyApprovalError(`Only ${availableToMove} approved but unfulfilled unit(s) can be reassigned.`);
    }
    if (moveQuantity > sourceAllocated) {
      throw shopEazyApprovalError('Reassignment quantity cannot exceed the source allocation.');
    }

    const sourceOutletId = cleanRequiredString(source.outletId, 'Source outlet ID');
    const sourceVariantId = cleanRequiredString(sourceItem.variantId, 'Source variant ID');
    const sourceProductId = cleanRequiredString(sourceItem.productId, 'Source product ID');

    // Resolve destination group. A new group may be created atomically when
    // only destinationOutletId is supplied.
    let destinationSnap = null;
    let destination = null;
    if (destinationGroupId) {
      destinationSnap = await tx.get(destinationGroupRef);
      if (!destinationSnap.exists()) throw shopEazyApprovalError('Destination fulfillment group does not exist.');
      destination = destinationSnap.data();
    } else {
      const outletRef = doc(db, 'outlets', cleanRequiredString(destinationOutletId, 'Destination outlet ID'));
      const outletSnap = await tx.get(outletRef);
      if (!outletSnap.exists()) throw shopEazyApprovalError('Destination outlet does not exist.');
      destination = {
        outletId: cleanRequiredString(destinationOutletId, 'Destination outlet ID'),
        partnerId: outletSnap.data().partnerId || null,
        status: 'APPROVED',
        items: [],
        delivery: null
      };
    }

    const destinationOutletIdValue = cleanRequiredString(destination.outletId, 'Destination outlet ID');
    if (destinationOutletIdValue === sourceOutletId) {
      throw shopEazyApprovalError('Source and destination outlets are the same.');
    }

    const destinationOutletRef = doc(db, 'outlets', destinationOutletIdValue);
    const destinationOutletSnap = await tx.get(destinationOutletRef);
    if (!destinationOutletSnap.exists()) throw shopEazyApprovalError('Destination outlet does not exist.');
    const destinationOutlet = destinationOutletSnap.data();
    if (String(destinationOutlet.status || '').trim().toUpperCase() !== 'ACTIVE' || destinationOutlet.fulfillmentEnabled !== true) {
      throw shopEazyApprovalError(`Destination outlet ${destinationOutletIdValue} is not active and fulfillment-enabled.`);
    }

    if (destinationGroupId) {
      const destinationStatus = String(destination.status || 'UNALLOCATED').trim().toUpperCase();
      if (SHOP_EAZY_REASSIGNMENT_BLOCKED_GROUP_STATUSES.includes(destinationStatus)) {
        throw shopEazyApprovalError(`Destination fulfillment group is already in status ${destinationStatus}.`);
      }
    }

    const destinationItems = Array.isArray(destination.items) ? destination.items : [];
    const destinationExisting = destinationItems.find(item => item?.orderItemId === itemId);
    if (destinationExisting) {
      if (destinationExisting.productId !== sourceProductId || destinationExisting.variantId !== sourceVariantId) {
        throw shopEazyApprovalError('Destination order-item product/variant does not match the source.');
      }
      if (validateNonNegativeInteger(destinationExisting.quantityFulfilled || 0, 'Destination fulfilled quantity') > 0) {
        throw shopEazyApprovalError('Destination order item has already begun fulfillment.');
      }
    }

    const orderItemIndex = Number(String(itemId).replace(/^item-/, ''));
    if (!Number.isInteger(orderItemIndex) || orderItemIndex < 0 || !order.items?.[orderItemIndex]) {
      throw shopEazyApprovalError('Order item ID does not map to a valid order item.');
    }
    const orderItem = order.items[orderItemIndex];
    const orderedQuantity = validateNonNegativeInteger(orderItem.quantity, 'Order quantity');

    // Destination inventory is the stock being newly committed. Source and
    // destination inventory must both be read before any write.
    const sourceInventoryRef = doc(db, 'outletInventory', shopEazyInventoryId(sourceOutletId, sourceVariantId));
    const destinationInventoryRef = doc(db, 'outletInventory', shopEazyInventoryId(destinationOutletIdValue, sourceVariantId));
    if (sourceInventoryRef.path === destinationInventoryRef.path) {
      throw shopEazyApprovalError('Source and destination inventory records are identical.');
    }

    const sourceInventorySnap = await tx.get(sourceInventoryRef);
    const destinationInventorySnap = await tx.get(destinationInventoryRef);
    if (!sourceInventorySnap.exists()) throw shopEazyApprovalError('Source outlet inventory record does not exist.');
    if (!destinationInventorySnap.exists()) throw shopEazyApprovalError('Destination outlet inventory record does not exist.');

    const sourceInventory = sourceInventorySnap.data();
    const destinationInventory = destinationInventorySnap.data();
    const sourceCurrent = validateNonNegativeInteger(sourceInventory.quantityOnHand, 'Source quantityOnHand');
    const destinationCurrent = validateNonNegativeInteger(destinationInventory.quantityOnHand, 'Destination quantityOnHand');

    if (sourceInventory.productId !== sourceProductId || sourceInventory.variantId !== sourceVariantId) {
      throw shopEazyApprovalError('Source inventory does not match the approved order item.');
    }
    if (destinationInventory.productId !== sourceProductId || destinationInventory.variantId !== sourceVariantId) {
      throw shopEazyApprovalError('Destination inventory does not match the approved order item.');
    }
    if (destinationInventory.active === false) {
      throw shopEazyApprovalError('Destination outlet inventory is inactive.');
    }
    if (destinationCurrent < moveQuantity) {
      throw shopEazyApprovalError(`Insufficient destination stock. Available: ${destinationCurrent}, required: ${moveQuantity}.`);
    }

    // Verify the order-level approved quantity remains invariant after the move.
    const groupsSnap = await tx.get(collection(db, 'orders', normalizedOrderId, 'fulfillmentGroups'));
    let totalApproved = 0;
    for (const groupDoc of groupsSnap.docs) {
      for (const item of (Array.isArray(groupDoc.data().items) ? groupDoc.data().items : [])) {
        if (item?.orderItemId === itemId) {
          totalApproved += validateNonNegativeInteger(item.quantityApproved || 0, 'Approved quantity');
        }
      }
    }
    if (totalApproved > orderedQuantity) {
      throw shopEazyApprovalError('Existing approved quantity exceeds ordered quantity.');
    }

    // ---------------- WRITE PHASE ----------------
    const sourceNext = sourceCurrent + moveQuantity;
    const destinationNext = destinationCurrent - moveQuantity;

    tx.update(sourceInventoryRef, {
      quantityOnHand: sourceNext,
      updatedAt: serverTimestamp()
    });
    tx.update(destinationInventoryRef, {
      quantityOnHand: destinationNext,
      updatedAt: serverTimestamp()
    });

    const sourceMovementRef = doc(collection(db, 'inventoryMovements'));
    tx.set(sourceMovementRef, {
      productId: sourceProductId,
      variantId: sourceVariantId,
      sku: sourceItem.sku || orderItem.sku || '',
      outletId: sourceOutletId,
      partnerId: source.partnerId || sourceInventory.partnerId || null,
      movementType: 'transferIn',
      quantityChange: moveQuantity,
      previousQuantity: sourceCurrent,
      newQuantity: sourceNext,
      referenceType: 'orderReassignment',
      referenceId: normalizedOrderId,
      sourceOutletId,
      destinationOutletId: destinationOutletIdValue,
      actorUid: actor,
      reason: moveReason,
      createdAt: serverTimestamp()
    });

    const destinationMovementRef = doc(collection(db, 'inventoryMovements'));
    tx.set(destinationMovementRef, {
      productId: sourceProductId,
      variantId: sourceVariantId,
      sku: sourceItem.sku || orderItem.sku || '',
      outletId: destinationOutletIdValue,
      partnerId: destination.partnerId || destinationInventory.partnerId || null,
      movementType: 'transferOut',
      quantityChange: -moveQuantity,
      previousQuantity: destinationCurrent,
      newQuantity: destinationNext,
      referenceType: 'orderReassignment',
      referenceId: normalizedOrderId,
      sourceOutletId,
      destinationOutletId: destinationOutletIdValue,
      actorUid: actor,
      reason: moveReason,
      createdAt: serverTimestamp()
    });

    const nextSourceItems = (Array.isArray(source.items) ? source.items : []).map(item =>
      item?.orderItemId === itemId
        ? {
            ...item,
            quantityAllocated: validateNonNegativeInteger(item.quantityAllocated || 0, 'Source allocated quantity') - moveQuantity,
            quantityApproved: sourceApproved - moveQuantity,
            quantityFulfilled: sourceFulfilled
          }
        : item
    ).filter(item => item.quantityAllocated > 0 || item.quantityApproved > 0 || item.quantityFulfilled > 0);

    const nextDestinationItems = destinationItems.some(item => item?.orderItemId === itemId)
      ? destinationItems.map(item =>
          item?.orderItemId === itemId
            ? {
                ...item,
                productId: sourceProductId,
                variantId: sourceVariantId,
                sku: sourceItem.sku || item.sku || '',
                nameSnapshot: sourceItem.nameSnapshot || item.nameSnapshot || orderItem.name || '',
                variantSnapshot: sourceItem.variantSnapshot || item.variantSnapshot || orderItem.variant || '',
                quantityAllocated: validateNonNegativeInteger(item.quantityAllocated || 0, 'Destination allocated quantity') + moveQuantity,
                quantityApproved: validateNonNegativeInteger(item.quantityApproved || 0, 'Destination approved quantity') + moveQuantity,
                quantityFulfilled: validateNonNegativeInteger(item.quantityFulfilled || 0, 'Destination fulfilled quantity')
              }
            : item
        )
      : [
          ...destinationItems,
          {
            orderItemId: itemId,
            orderItemIndex,
            productId: sourceProductId,
            variantId: sourceVariantId,
            sku: sourceItem.sku || orderItem.sku || '',
            nameSnapshot: sourceItem.nameSnapshot || orderItem.name || '',
            variantSnapshot: sourceItem.variantSnapshot || orderItem.variant || '',
            quantityAllocated: moveQuantity,
            quantityApproved: moveQuantity,
            quantityFulfilled: 0
          }
        ];

    tx.update(sourceGroupRef, {
      items: nextSourceItems,
      status: nextSourceItems.length ? 'APPROVED' : 'UNALLOCATED',
      updatedAt: serverTimestamp()
    });

    if (destinationGroupId) {
      tx.update(destinationGroupRef, {
        items: nextDestinationItems,
        status: 'APPROVED',
        updatedAt: serverTimestamp()
      });
    } else {
      tx.set(destinationGroupRef, {
        outletId: destinationOutletIdValue,
        partnerId: destination.partnerId || destinationOutlet.partnerId || null,
        status: 'APPROVED',
        items: nextDestinationItems,
        delivery: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    const auditRef = doc(collection(db, 'shopEazyAudit'));
    tx.set(auditRef, {
      action: 'ORDER_ALLOCATION_REASSIGNED',
      orderId: normalizedOrderId,
      orderItemId: itemId,
      sourceGroupId: sourceId,
      destinationGroupId: destinationGroupRef.id,
      sourceOutletId,
      destinationOutletId: destinationOutletIdValue,
      quantity: moveQuantity,
      reason: moveReason,
      actorUid: actor,
      createdAt: serverTimestamp()
    });

    tx.update(orderRef, {
      updatedAt: serverTimestamp(),
      shopEazyAllocationSummary: {
        ...(order.shopEazyAllocationSummary || {}),
        lastChangedBy: actor,
        lastChangedAt: serverTimestamp(),
        lastChangedItemId: itemId,
        lastChangeType: 'REASSIGNMENT'
      }
    });

    return {
      orderId: normalizedOrderId,
      orderItemId: itemId,
      quantityReassigned: moveQuantity,
      sourceOutletId,
      destinationOutletId: destinationOutletIdValue,
      destinationGroupId: destinationGroupRef.id
    };
  });
}

/* ---------------- SHOP-EAZY: FULFILLMENT OPERATIONS ---------------- */
// Fulfillment is deliberately separate from approval. Approval commits stock;
// these transitions record the physical handling of that committed quantity.
// A group may only move through the defined operational sequence.

const SHOP_EAZY_FULFILLMENT_TRANSITIONS = {
  APPROVED: ['PICKING'],
  PICKING: ['READY'],
  READY: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED']
};

const SHOP_EAZY_FULFILLMENT_STATUSES = [
  'APPROVED', 'PICKING', 'READY', 'DISPATCHED', 'DELIVERED'
];

function shopEazyNormalizeFulfillmentStatus(status) {
  const normalized = String(status || '').trim().toUpperCase();
  if (!SHOP_EAZY_FULFILLMENT_STATUSES.includes(normalized)) {
    throw shopEazyApprovalError(`Invalid fulfillment status: ${normalized || 'UNKNOWN'}.`);
  }
  return normalized;
}

function shopEazyDeriveOverallFulfillmentStatus(groups) {
  const active = groups.filter(group =>
    !['CANCELLED', 'RETURNED', 'UNALLOCATED'].includes(
      String(group.status || '').trim().toUpperCase()
    )
  );
  if (!active.length) return 'APPROVED';

  const statuses = active.map(group => String(group.status || '').trim().toUpperCase());
  if (statuses.every(status => status === 'DELIVERED')) return 'DELIVERED';
  if (statuses.some(status => status === 'DISPATCHED')) return 'OUT_FOR_DELIVERY';
  if (statuses.some(status => ['PICKING', 'READY'].includes(status))) return 'FULFILLING';
  return 'APPROVED';
}

/**
 * Advances one fulfillment group by exactly one allowed state.
 *
 * APPROVED → PICKING → READY → DISPATCHED → DELIVERED
 *
 * The transition is transactional so the group cannot be advanced from stale
 * state. At DELIVERED, quantityFulfilled is set to quantityApproved for every
 * group item. No inventory is deducted here because approval already did that.
 */
export async function advanceShopEazyFulfillmentGroup({
  orderId,
  groupId,
  nextStatus,
  actorUid,
  note = null
} = {}) {
  const normalizedOrderId = cleanRequiredString(orderId, 'Order ID');
  const normalizedGroupId = cleanRequiredString(groupId, 'Group ID');
  const actor = cleanRequiredString(actorUid, 'Actor UID');
  const requestedStatus = shopEazyNormalizeFulfillmentStatus(nextStatus);

  const orderRef = doc(db, 'orders', normalizedOrderId);
  const groupRef = doc(
    db,
    'orders',
    normalizedOrderId,
    'fulfillmentGroups',
    normalizedGroupId
  );

  return runTransaction(db, async tx => {
    const orderSnap = await tx.get(orderRef);
    const groupSnap = await tx.get(groupRef);

    if (!orderSnap.exists()) throw shopEazyApprovalError('Order does not exist.');
    if (!groupSnap.exists()) throw shopEazyApprovalError('Fulfillment group does not exist.');

    const order = orderSnap.data();
    const group = groupSnap.data();
    const currentStatus = shopEazyNormalizeFulfillmentStatus(group.status);

    if (order.inventoryApplied !== true) {
      throw shopEazyApprovalError('Fulfillment cannot begin before inventory has been committed.');
    }
    if (['CANCELLED', 'RETURNED'].includes(String(order.status || '').trim().toUpperCase())) {
      throw shopEazyApprovalError('Cancelled or returned orders cannot enter fulfillment.');
    }

    const allowed = SHOP_EAZY_FULFILLMENT_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(requestedStatus)) {
      throw shopEazyApprovalError(
        `Invalid fulfillment transition: ${currentStatus} → ${requestedStatus}.`
      );
    }

    const items = Array.isArray(group.items) ? group.items : [];
    if (!items.length) throw shopEazyApprovalError('Fulfillment group has no items.');

    let approvedTotal = 0;
    let fulfilledTotal = 0;

    const nextItems = items.map(item => {
      const approved = validateNonNegativeInteger(
        item.quantityApproved || 0,
        'Approved quantity'
      );
      const fulfilled = validateNonNegativeInteger(
        item.quantityFulfilled || 0,
        'Fulfilled quantity'
      );
      const allocated = validateNonNegativeInteger(
        item.quantityAllocated || 0,
        'Allocated quantity'
      );

      if (approved > allocated) {
        throw shopEazyApprovalError('Approved quantity exceeds allocated quantity.');
      }
      if (fulfilled > approved) {
        throw shopEazyApprovalError('Fulfilled quantity exceeds approved quantity.');
      }
      if (approved <= 0) {
        throw shopEazyApprovalError('A fulfillment group must contain approved quantity.');
      }

      approvedTotal += approved;
      fulfilledTotal += fulfilled;

      return requestedStatus === 'DELIVERED'
        ? { ...item, quantityFulfilled: approved }
        : { ...item };
    });

    // A group cannot be delivered with an internally incomplete quantity
    // record. The delivered transition closes the physical fulfillment.
    if (requestedStatus === 'DELIVERED' && approvedTotal <= 0) {
      throw shopEazyApprovalError('Cannot deliver an empty fulfillment group.');
    }

    const nextGroupsSnap = await tx.get(
      collection(db, 'orders', normalizedOrderId, 'fulfillmentGroups')
    );
    const nextGroups = nextGroupsSnap.docs.map(docSnap => ({
      id: docSnap.id,
      ref: docSnap.ref,
      data: docSnap.data()
    }));

    // Use the requested next status for this group while deriving the overall
    // order status from the authoritative group states.
    const statusForOrder = nextGroups.map(entry =>
      entry.id === normalizedGroupId
        ? requestedStatus
        : String(entry.data.status || 'UNALLOCATED').trim().toUpperCase()
    );

    let overallStatus = shopEazyDeriveOverallFulfillmentStatus(
      statusForOrder.map(status => ({ status }))
    );

    // A partially approved order with unresolved remainder cannot become
    // customer-complete merely because its currently approved groups are
    // delivered. The remainder must first be resolved through the partial
    // resolution workflow.
    const unresolvedRemainder = Number(
      order.fulfillmentSummary?.unallocatedQuantity || 0
    );
    if (
      overallStatus === 'DELIVERED' &&
      String(order.approvalStatus || '').trim().toUpperCase() === 'PARTIAL' &&
      Number.isInteger(unresolvedRemainder) &&
      unresolvedRemainder > 0
    ) {
      overallStatus = 'FULFILLING';
    }

    tx.update(groupRef, {
      items: nextItems,
      status: requestedStatus,
      updatedAt: serverTimestamp(),
      ...(note ? { fulfillmentNote: note } : {}),
      lastActionBy: actor,
      lastActionAt: serverTimestamp()
    });

    const auditRef = doc(collection(db, 'shopEazyAudit'));
    tx.set(auditRef, {
      action: 'FULFILLMENT_GROUP_STATUS_CHANGED',
      orderId: normalizedOrderId,
      groupId: normalizedGroupId,
      outletId: group.outletId || null,
      previousStatus: currentStatus,
      newStatus: requestedStatus,
      approvedQuantity: approvedTotal,
      previouslyFulfilledQuantity: fulfilledTotal,
      actorUid: actor,
      note: note ?? null,
      createdAt: serverTimestamp()
    });

    tx.update(orderRef, {
      status: overallStatus,
      updatedAt: serverTimestamp(),
      ...(requestedStatus === 'DELIVERED' && overallStatus === 'DELIVERED'
        ? { deliveredAt: serverTimestamp(), deliveredBy: actor }
        : {})
    });

    return {
      orderId: normalizedOrderId,
      groupId: normalizedGroupId,
      previousStatus: currentStatus,
      status: requestedStatus,
      orderStatus: overallStatus
    };
  });
}

/**
 * Returns the current fulfillment state for an order, including group-level
 * progress. This is read-only and derives the aggregate from Firestore.
 */
export async function getShopEazyFulfillmentSummary(orderId) {
  const normalizedOrderId = cleanRequiredString(orderId, 'Order ID');
  const orderSnap = await getDoc(doc(db, 'orders', normalizedOrderId));
  if (!orderSnap.exists()) throw shopEazyApprovalError('Order does not exist.');

  const groupsSnap = await getDocs(
    collection(db, 'orders', normalizedOrderId, 'fulfillmentGroups')
  );

  const groups = groupsSnap.docs.map(groupDoc => {
    const group = groupDoc.data();
    const items = Array.isArray(group.items) ? group.items : [];
    const approvedQuantity = items.reduce(
      (sum, item) => sum + validateNonNegativeInteger(item.quantityApproved || 0, 'Approved quantity'),
      0
    );
    const fulfilledQuantity = items.reduce(
      (sum, item) => sum + validateNonNegativeInteger(item.quantityFulfilled || 0, 'Fulfilled quantity'),
      0
    );
    if (fulfilledQuantity > approvedQuantity) {
      throw shopEazyApprovalError(`Fulfilled quantity exceeds approved quantity in group ${groupDoc.id}.`);
    }

    return {
      groupId: groupDoc.id,
      outletId: group.outletId || null,
      partnerId: group.partnerId || null,
      status: String(group.status || 'UNALLOCATED').trim().toUpperCase(),
      approvedQuantity,
      fulfilledQuantity,
      remainingQuantity: approvedQuantity - fulfilledQuantity
    };
  });

  return {
    orderId: normalizedOrderId,
    orderStatus: orderSnap.data().status || null,
    groups,
    totalApprovedQuantity: groups.reduce((sum, group) => sum + group.approvedQuantity, 0),
    totalFulfilledQuantity: groups.reduce((sum, group) => sum + group.fulfilledQuantity, 0)
  };
}
