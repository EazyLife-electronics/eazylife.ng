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

// Customer submits an order from the cart. No login required to write —
// see firestore.rules: orders can be created by anyone, but only read/edited by admin.
export async function placeOrder(order) {
  return addDoc(collection(db, 'orders'), {
    ...order,
    status: 'new',
    createdAt: serverTimestamp()
  });
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

/* ---------------- SETTINGS ---------------- */

export async function getSettings() {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  return snap.exists() ? snap.data() : {};
}

export async function saveSettings(settings) {
  return setDoc(doc(db, 'settings', 'site'), settings, { merge: true });
}
