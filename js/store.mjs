// js/store.mjs
// Firestore data layer shared by shop.html and the admin dashboard.
// Collections used:
//   products/{id}   -> { name, price, promoPrice, category, image, inStock, desc }
//   orders/{id}     -> { items[], customerName, phone, address, total, status, createdAt }
//   settings/site   -> { whatsapp, tagline, aboutText, ... }

import { initFirebase } from './firebase.mjs';
import {
  collection, doc, getDocs, getDoc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
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

export async function placeOrder(order) {
  const trackingCode = generateTrackingCode();
  await setDoc(doc(db, 'orders', trackingCode), {
    ...order,
    trackingCode,
    status: 'new',
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

export async function updateOrderStatus(id, status) {
  return updateDoc(doc(db, 'orders', id), { status });
}

export async function cancelOrder(id, { reason = null, customerNote = null, internalNote = null } = {}) {
  return updateDoc(doc(db, 'orders', id), {
    status: 'cancelled',
    cancelReason: reason,
    cancelCustomerNote: customerNote,
    cancelInternalNote: internalNote,
    cancelledAt: serverTimestamp()
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
