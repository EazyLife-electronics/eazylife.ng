// admin/js/admin-app.mjs
// Orchestrates the admin dashboard: handles login/logout and, once
// authenticated, subscribes to each Firestore collection and hands the data
// to the matching section module. Each tab's own form handling, rendering,
// and DOM wiring lives in its own file (admin-products.mjs, admin-heroes.mjs,
// etc.) — this file just wires them together.
import { initFirebase } from '../../js/firebase.mjs';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  watchProducts, watchHeroes, watchReviews, watchRequests, watchOrders, watchProjects
} from '../../js/store.mjs';

import { initTabs, initImagePicker } from './admin-shared.mjs';
import { initProducts, renderProducts } from './admin-products.mjs';
import { initHeroes, renderHeroes, setProductsForHeroLinks } from './admin-heroes.mjs';
import { initReviews, renderReviews } from './admin-reviews.mjs';
import { renderRequestList } from './admin-requests.mjs';
import { renderOrderList } from './admin-orders.mjs';
import { initProjects, renderProjects, checkDueProjectPublications, setProjectKitProducts } from './admin-projects.mjs';
import { initSettings, loadSettingsForm } from './admin-settings.mjs';
import { setQuotationProducts } from './admin-quotations.mjs';
import { initSchoolStem, resetSchoolStem } from './admin-school-stem.mjs';
import { initTechnicalTraining, resetTechnicalTraining } from './admin-technical-training.mjs';
import { isAdminUser, consumeAdminReturnTo } from './admin-auth.mjs';

const { auth } = initFirebase();

const MEDIA_WORKER_URL = 'https://eazylife-media.damzyeazy.workers.dev';

async function checkMediaService(user) {
  const statusEl = document.getElementById('mediaServiceStatus');
  if (!statusEl) return;

  statusEl.textContent = 'Checking media service…';
  statusEl.className = 'text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500';

  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${MEDIA_WORKER_URL}/auth`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Admin verification failed' : `Worker returned ${response.status}`);
    }

    const data = await response.json();
    if (!data.token || !data.signature || !data.expire || !data.publicKey) {
      throw new Error('Worker returned incomplete upload credentials');
    }

    const filesResponse = await fetch(`${MEDIA_WORKER_URL}/files?path=${encodeURIComponent('/eazylife/projects')}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!filesResponse.ok) {
      throw new Error(filesResponse.status === 401 ? 'Admin verification failed while listing media' : `Media listing returned ${filesResponse.status}`);
    }
    await filesResponse.json();

    statusEl.textContent = 'Media service connected · library access OK';
    statusEl.className = 'text-[10px] px-2 py-1 rounded-full bg-green-50 text-green-700';
  } catch (error) {
    console.error('EazyLife media service check failed:', error);
    statusEl.textContent = 'Media service unavailable';
    statusEl.className = 'text-[10px] px-2 py-1 rounded-full bg-red-50 text-red-700';
  }
}

initTabs();
initImagePicker();
initProducts();
initHeroes();
initReviews();
initProjects();
initSettings();

let unsubProducts = null;
let unsubHeroes = null;
let unsubReviews = null;
let unsubRequests = null;
let unsubOrders = null;
let unsubProjects = null;
let projectPublishTimer = null;

let currentAdminReviews = [];
let currentAdminRequests = [];
let currentAdminOrders = [];
let upcomingSchoolAppointment = null;

function updateAdminAttention() {
  const pendingOrders = currentAdminOrders.filter(order => String(order.status || 'new').toLowerCase() === 'new').length;
  const pendingRequests = currentAdminRequests.filter(request => String(request.status || 'new').toLowerCase() === 'new').length;
  const pendingReviews = currentAdminReviews.filter(review => review.approved !== true && review.adminReviewed !== true).length;
  const total = pendingOrders + pendingRequests + pendingReviews + (upcomingSchoolAppointment ? 1 : 0);
  const panel = document.getElementById('adminAttentionPanel');
  if (panel) panel.classList.toggle('hidden', total === 0);
  const totalEl = document.getElementById('adminAttentionTotal');
  if (totalEl) totalEl.textContent = String(total);
  const values = {
    orders: pendingOrders,
    requests: pendingRequests,
    reviews: pendingReviews,
    schoolStem: upcomingSchoolAppointment ? 1 : 0
  };
  Object.entries(values).forEach(([key, count]) => {
    const summary = document.getElementById('attention' + key[0].toUpperCase() + key.slice(1) + 'Count');
    const badge = document.getElementById(key + 'NotificationBadge');
    if (summary) summary.textContent = String(count);
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('hidden', count === 0);
    }
  });
}


window.addEventListener('school-stem-appointments-updated', (event) => {
  upcomingSchoolAppointment = event.detail || null;
  const card = document.getElementById('attentionSchoolStem');
  const text = document.getElementById('attentionSchoolStemText');
  if (card) card.classList.toggle('hidden', !upcomingSchoolAppointment);
  if (text && upcomingSchoolAppointment) {
    const d = new Date(upcomingSchoolAppointment.date + 'T' + (upcomingSchoolAppointment.time || '09:00') + ':00');
    const when = d.toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' });
    text.textContent = upcomingSchoolAppointment.schoolName + ' · ' + when + ' · ' + (upcomingSchoolAppointment.purpose || 'School STEM meeting');
  }
  updateAdminAttention();
});

document.querySelectorAll('[data-notification-tab]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelector('[data-tab="' + button.dataset.notificationTab + '"]')?.click();
  });
});

/* ---------------- AUTH ---------------- */

const loginButton = document.getElementById('loginBtn');
loginButton.dataset.authHandlerReady = 'yes';
loginButton.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.style.color = '#087f70';
  errorEl.textContent = 'Connecting to Firebase…';
  errorEl.classList.remove('hidden');
  loginButton.disabled = true;
  loginButton.textContent = 'Signing in…';
  try {
    if (!email || !password) throw new Error('Enter both your admin email and password.');
    await signInWithEmailAndPassword(auth, email, password);
    errorEl.textContent = 'Sign-in successful. Opening dashboard…';
  } catch (err) {
    console.error('EazyLife admin sign-in failed:', err);
    const messages = {
      'auth/unauthorized-domain': 'This preview domain is not authorized in Firebase Authentication. Add raw.githack.com under Authentication → Settings → Authorized domains.',
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/invalid-email': 'The email address is not valid.',
      'auth/too-many-requests': 'Too many attempts. Wait a while before trying again.',
      'auth/network-request-failed': 'Network request failed. Check your connection or browser extensions.'
    };
    errorEl.style.color = '#c22';
    errorEl.textContent = messages[err.code] || ('Login failed: ' + (err.code || err.message || 'Unknown Firebase error'));
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Log In';
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    if (!isAdminUser(user)) {
      const errorEl = document.getElementById('loginError');
      if (errorEl) {
        errorEl.style.color = '#c22';
        errorEl.textContent = 'This account is not authorized for the EazyLife admin dashboard.';
        errorEl.classList.remove('hidden');
      }
      signOut(auth);
      return;
    }
    if (consumeAdminReturnTo(user)) return;
    checkMediaService(user);
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    startDashboard();
    if (projectPublishTimer) clearInterval(projectPublishTimer);
    projectPublishTimer = setInterval(checkDueProjectPublications, 60000);
  } else {
    document.getElementById('dashboard').classList.add('hidden');
    resetSchoolStem();
    resetTechnicalTraining();
    document.getElementById('loginScreen').classList.remove('hidden');
    if (unsubProducts) unsubProducts();
    if (unsubHeroes) unsubHeroes();
    if (unsubReviews) unsubReviews();
    if (unsubRequests) unsubRequests();
    if (unsubOrders) unsubOrders();
    if (unsubProjects) unsubProjects();
    if (projectPublishTimer) { clearInterval(projectPublishTimer); projectPublishTimer = null; }
  }
});

function startDashboard() {
  if (isAdminUser(auth.currentUser)) {
    initSchoolStem();
    initTechnicalTraining();
  } else {
    resetSchoolStem();
    resetTechnicalTraining();
  }
  unsubProducts = watchProducts((products) => {
    renderProducts(products);
    setQuotationProducts(products);
    setProjectKitProducts(products);
    // The hero form's "link to category"/"link to product" dropdowns are
    // built from the product list, so heroes needs to hear about it too.
    setProductsForHeroLinks(products);
  });
  unsubHeroes = watchHeroes(renderHeroes);
  unsubReviews = watchReviews((reviews) => {
    currentAdminReviews = reviews;
    renderReviews(reviews);
    updateAdminAttention();
  });
  unsubRequests = watchRequests((requests) => {
    currentAdminRequests = requests;
    renderRequestList(requests);
    updateAdminAttention();
  });
  unsubOrders = watchOrders((orders) => {
    currentAdminOrders = orders;
    renderOrderList(orders);
    updateAdminAttention();
  });
  unsubProjects = watchProjects(renderProjects);
  loadSettingsForm();
}
