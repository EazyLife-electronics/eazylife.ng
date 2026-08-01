// js/firebase.mjs
// Central Firebase init — imported by shop.html and admin pages.
// Uses the CDN modular SDK (no npm/build step needed for GitHub Pages).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmF_InIyNfcDMeX4VE_EkSdIipz0nWz6g",
  authDomain: "eazylife-ng.firebaseapp.com",
  projectId: "eazylife-ng",
  storageBucket: "eazylife-ng.firebasestorage.app",
  messagingSenderId: "310295030883",
  appId: "1:310295030883:web:f6bb12e70d856309995c56",
  measurementId: "G-07CCF0NFEQ"
};

let cached = null;

export function initFirebase() {
  if (cached) return cached;
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const auth = getAuth(app);
  cached = { app, db, auth };
  return cached;
}
