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