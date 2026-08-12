// js/firebase.mjs
// Central Firebase init — imported by shop.html and admin pages.
// Uses the CDN modular SDK (no npm/build step needed for GitHub Pages).

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// This module only injects markup on Admin pages. It is safe to load from the
// shared Firebase module and, importantly, runs before admin-app.mjs starts.
import "../admin/js/settings-ui.mjs";

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

  // Admin-only modules are loaded after Firebase is initialized so they can
  // safely use the same Firestore instance without affecting the public shop.
  if (typeof location !== 'undefined' && location.pathname.includes('/admin/')) {
    import('../admin/js/purchases.mjs').catch(err => console.warn('Purchase module could not load:', err));
    import('../admin/js/payments-ui.mjs')
      .then(({ initPaymentsUI }) => initPaymentsUI(db))
      .catch(err => console.warn('Payment UI could not load:', err));
  }

  return cached;
}