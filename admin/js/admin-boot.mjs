// Temporary authentication diagnostic bootstrap.
// This version intentionally stops after Firebase Authentication so we can
// verify Auth independently from Firestore permissions and ShopEazy access.
import { initFirebase } from '../../js/firebase.mjs';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const { auth } = initFirebase();
const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const errorEl = document.getElementById('loginError');

loginBtn?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!email || !password) {
    errorEl.textContent = 'Enter your email and password.';
    errorEl.classList.remove('hidden');
    return;
  }

  errorEl.classList.add('hidden');
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Firebase Authentication failed:', error);
    errorEl.textContent = 'Firebase login failed — check the email/password.';
    errorEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';
  }
});

logoutBtn?.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (!user) {
    dashboard?.classList.add('hidden');
    loginScreen?.classList.remove('hidden');
    return;
  }

  // TEMPORARY: deliberately do not load Firestore, ShopEazy access checks,
  // or the full admin dashboard. This confirms Firebase Auth by itself.
  loginScreen?.classList.add('hidden');
  dashboard?.classList.remove('hidden');
  const badge = document.getElementById('shopEazyAccessBadge');
  if (badge) {
    badge.textContent = 'Firebase Auth OK · ' + (user.email || 'authenticated user');
    badge.classList.remove('hidden');
  }
});
