// js/store.mjs
// Firestore data layer shared by shop.html and the admin dashboard.
// Collections used:
//   products/{id}   -> { name, variants[], inStock, desc }
//   orders/{id}     -> { items[], customerName, phone, address, total, status, createdAt }
//   settings/site   -> { whatsapp, tagline, aboutText, ... }
//   inventoryMovements/{id} -> stock movement ledger

import { initFirebase } from './firebase.mjs';
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const { db } = initFirebase();

/* ---------------- PRODUCTS ---------------- */

export async function getProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function watchProducts(callback) {
  return onSnapshot(collection(db, 'products'), (snap) => {
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(products);
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

/*
 * Older orders stored only a human-readable variant label. New inventory-aware orders
 * must carry variantId so a sale can never accidentally deduct stock from the wrong
 * variant. We resolve the legacy cart shape here at write time, without changing the
 * customer's checkout UI.
 */
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

export function watchOrders(callback) {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(orders);
  });
}

function isConfirmedStatus(status) {
  return ['confirmed', 'shipped', 'delivered'].includes(String(status || '').toLowerCase());
}

function isReversalStatus(status) {
  return ['cancelled', 'returned'].includes(String(status || '').toLowerCase());
}

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

  for (const { productId, variantId, quantity, item } of grouped.values()) {
    const productRef = doc(db, 'products', productId);
    const productSnap = await tx.get(productRef);
    if (!productSnap.exists()) throw new Error(`Product ${item.name || productId} no longer exists.`);

    const product = productSnap.data();
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    const index = variants.findIndex(v => v.id === variantId);
    if (index < 0) throw new Error(`Variant for ${item.name || productId} no longer exists.`);

    const current = Math.max(0, Number(variants[index].stockQty || 0));
    const delta = direction > 0 ? -quantity : quantity;
    const next = current + delta;
    if (next < 0) {
      throw new Error(`Insufficient stock for ${item.name || product.name || 'product'} (${item.variant || variantId}). Current stock: ${current}, requested: ${quantity}.`);
    }

    variants[index] = { ...variants[index], stockQty: next, inStock: next > 0 };
    tx.update(productRef, {
      variants,
      inStock: variants.some(v => Number(v.stockQty || 0) > 0)
    });

    const movementRef = doc(collection(db, 'inventoryMovements'));
    tx.set(movementRef, {
      productId,
      variantId,
      sku: variants[index].sku || item.sku || '',
      productName: product.name || item.name || '',
      variantLabel: item.variant || variantLabelForOrder(variants[index], index),
      type: direction > 0 ? 'sale' : 'return',
      quantity: delta,
      previousQty: current,
      newQty: next,
      reason: direction > 0 ? 'Customer order confirmed' : 'Order cancelled/returned',
      reference: order.trackingCode || order.id || '',
      orderId: order.id || order.trackingCode || '',
      createdAt: serverTimestamp()
    });
  }
}

/*
 * Inventory policy:
 *   new/pending -> no stock change
 *   confirmed   -> deduct once
 *   shipped/delivered -> no additional change
 *   cancelled/returned -> restore once if the order was previously deducted
 *
 * The entire order status change + all stock changes + movement records happen in one
 * Firestore transaction. If any item lacks stock, nothing is partially deducted.
 */
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
  // Use the same transactional status path so cancellation restores stock only when
  // the order previously consumed stock.
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