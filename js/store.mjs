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
