// Admin bootstrap.
// Keep the login screen independent from the full dashboard module so a
// dashboard import/cache problem cannot make the login page disappear.
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
    console.error('Admin login failed:', error);
    errorEl.textContent = 'Login failed — check email and password.';
    errorEl.classList.remove('hidden');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';
  }
});

logoutBtn?.addEventListener('click', () => signOut(auth));

let dashboardStarted = false;
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    dashboardStarted = false;
    dashboard?.classList.add('hidden');
    loginScreen?.classList.remove('hidden');
    return;
  }

  loginScreen?.classList.add('hidden');
  dashboard?.classList.remove('hidden');

  if (dashboardStarted) return;
  dashboardStarted = true;

  try {
    // Cache-bust the dashboard module so GitHack cannot keep serving an old
    // failed response for the same module URL.
    await import('./admin-app.mjs?v=shopeazy-1790299553562');
  } catch (error) {
    console.error('Admin dashboard failed to start:', error);
    dashboardStarted = false;
    if (errorEl) {
      errorEl.textContent = 'Dashboard could not start: ' + (error?.message || String(error));
      errorEl.classList.remove('hidden');
    }
    loginScreen?.classList.remove('hidden');
    dashboard?.classList.add('hidden');
  }
});
