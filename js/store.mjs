// js/store.mjs
// Firestore data layer shared by shop.html and the admin dashboard.
// Collections used:
//   products/{id}   -> { name, price, promoPrice, category, image, inStock, desc }
//   orders/{id}     -> { items[], customerName, phone, address, total, status, createdAt }
//   settings/site   -> { whatsapp, tagline, aboutText, ... }
//   heroes/{id}     -> { title, subtitle, image, ctaText, linkType, linkValue, order }
//   reviews/{id}    -> { name, title, stars, text, approved }

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

export async function placeOrder(order) {
  return addDoc(collection(db, 'orders'), {
    ...order,
    status: 'new',
    createdAt: serverTimestamp()
  });
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
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(r => r.approved === true);
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

/* ---------------- SETTINGS ---------------- */

export async function getSettings() {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  return snap.exists() ? snap.data() : {};
}

export async function saveSettings(settings) {
  return setDoc(doc(db, 'settings', 'site'), settings, { merge: true });
}
