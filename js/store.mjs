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

// One-time fetch (used by shop.html on load)
export async function getProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Live subscription (used by admin dashboard so edits reflect instantly)
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

// Short, friendly tracking code — avoids ambiguous characters (0/O, 1/I/l) so it's easy
// to read aloud or type back in. Used as the actual Firestore document ID (not just a field)
// so a customer can fetch their one order directly without needing any "list" permission —
// see firestore.rules: get is public, list (browsing all orders) stays admin-only.
function generateTrackingCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = 'EZ-';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

// Customer submits an order from the cart. No login required to write —
// see firestore.rules: orders can be created by anyone, but only read/edited by admin
// (except fetching a single order by its exact tracking code, which is public).
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

// Public: fetch one order by its tracking code (also its doc ID). Returns null if not found.
export async function getOrderByTrackingCode(code) {
  const snap = await getDoc(doc(db, 'orders', code.trim().toUpperCase()));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Admin-only: live list of orders, newest first
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

// Admin-only: reject/cancel an order.
// reason: 'out_of_stock' | 'payment_failed' | 'other' | null — null means no reason is shown to the customer.
// customerNote: extra sentence shown to the customer, only really meaningful when reason === 'other'.
// internalNote: for the shop's own records only (e.g. "price changed with supplier") — never surfaced on track.html.
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
// heroes/{id} -> { title, subtitle, image, ctaText, linkType: 'category'|'product'|'url', linkValue, order }

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
// reviews/{id} -> { name, title, stars, text, approved }

// Public: only approved reviews, for the homepage testimonials section
export async function getApprovedReviews() {
  const snap = await getDocs(collection(db, 'reviews'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.approved === true);
}

// Admin: all reviews regardless of approval state, live
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
// requests/{id} -> { name, phone, need, budget, category, status, createdAt }
// Customer service flow: "can't find what you want" from the shop, or budget-based custom sourcing.

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
