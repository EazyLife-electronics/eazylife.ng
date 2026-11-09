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

/* ---------------- AUTH ---------------- */

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('hidden');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errorEl.textContent = 'Login failed — check email and password.';
    errorEl.classList.remove('hidden');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    checkMediaService(user);
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    startDashboard();
    if (projectPublishTimer) clearInterval(projectPublishTimer);
    projectPublishTimer = setInterval(checkDueProjectPublications, 60000);
  } else {
    document.getElementById('dashboard').classList.add('hidden');
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
  unsubProducts = watchProducts((products) => {
    renderProducts(products);
    setProjectKitProducts(products);
    // The hero form's "link to category"/"link to product" dropdowns are
    // built from the product list, so heroes needs to hear about it too.
    setProductsForHeroLinks(products);
  });
  unsubHeroes = watchHeroes(renderHeroes);
  unsubReviews = watchReviews(renderReviews);
  unsubRequests = watchRequests(renderRequestList);
  unsubOrders = watchOrders(renderOrderList);
  unsubProjects = watchProjects(renderProjects);
  loadSettingsForm();
}
