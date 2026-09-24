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
  watchProducts, watchHeroes, watchReviews, watchRequests, watchOrders
} from '../../js/store.mjs';

import { initTabs, initImagePicker } from './admin-shared.mjs';
import { getShopEazyAccess, describeShopEazyRole } from './shopeazy-access.mjs';
import { initShopEazyPartners } from './shopeazy-partners.mjs';
import { initProducts, renderProducts } from './admin-products.mjs';
import { initHeroes, renderHeroes, setProductsForHeroLinks } from './admin-heroes.mjs';
import { initReviews, renderReviews } from './admin-reviews.mjs';
import { renderRequestList } from './admin-requests.mjs';
import { renderOrderList } from './admin-orders.mjs';
import { initSettings, loadSettingsForm } from './admin-settings.mjs';

const { auth } = initFirebase();

initTabs();
initImagePicker();
initProducts();
initHeroes();
initReviews();
initSettings();

let unsubProducts = null;
let unsubHeroes = null;
let unsubReviews = null;
let unsubRequests = null;
let unsubOrders = null;

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

onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    const access = await initializeShopEazyAccess(user);
    window.shopEazyAccess = access;
    if (access?.role === 'ADMIN') {
      initShopEazyPartners(access);
      startDashboard();
    } else if (['PARTNER_MANAGER'].includes(access?.role)) {
      showShopEazyRoleShell(access);
      initShopEazyPartners(access);
    } else {
      showShopEazyRoleShell(access);
    }
  } else {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    if (unsubProducts) unsubProducts();
    if (unsubHeroes) unsubHeroes();
    if (unsubReviews) unsubReviews();
    if (unsubRequests) unsubRequests();
    if (unsubOrders) unsubOrders();
  }
});

async function initializeShopEazyAccess(user) {
  const badge = document.getElementById('shopEazyAccessBadge');
  if (!badge) return;

  try {
    const access = await getShopEazyAccess(user);
    badge.textContent = access.role
      ? 'ShopEazy · ' + describeShopEazyRole(access.role)
      : 'ShopEazy · Unassigned';

    badge.classList.remove('hidden');
    return access;
  } catch (error) {
    console.error('ShopEazy access check failed:', error);
    badge.textContent = 'ShopEazy · Access check failed';
    badge.classList.remove('hidden');
    return null;
  }
}

function showShopEazyRoleShell(access) {
  const dashboard = document.getElementById('dashboard');
  const accessPanel = document.getElementById('shopEazyAccessPanel');
  const message = document.getElementById('shopEazyAccessMessage');

  // The existing legacy admin tabs are deliberately kept admin-only until
  // their Firestore permissions and ShopEazy operational equivalents are
  // connected to each role.
  dashboard.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.add('hidden');
  });

  dashboard.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.add('hidden');
  });

  accessPanel?.classList.remove('hidden');

  if (access?.role === 'PARTNER_MANAGER') {
    document.getElementById('partnersTabBtn')?.classList.remove('hidden');
    document.getElementById('panel-partners')?.classList.remove('hidden');
    document.getElementById('inventoryTabBtn')?.classList.remove('hidden');
  }

  if (!access?.role) {
    message.textContent = 'No ShopEazy role is assigned to this account. Ask an administrator to assign a role.';
    return;
  }

  const scope = access.partnerId
    ? `Partner: ${access.partnerId}`
    : access.outletId
      ? `Outlet: ${access.outletId}`
      : 'No partner/outlet scope assigned';

  message.textContent = `${describeShopEazyRole(access.role)} · ${scope}`;
}

function startDashboard() {
  unsubProducts = watchProducts((products) => {
    renderProducts(products);
    // The hero form's "link to category"/"link to product" dropdowns are
    // built from the product list, so heroes needs to hear about it too.
    setProductsForHeroLinks(products);
  });
  unsubHeroes = watchHeroes(renderHeroes);
  unsubReviews = watchReviews(renderReviews);
  unsubRequests = watchRequests(renderRequestList);
  unsubOrders = watchOrders(renderOrderList);
  loadSettingsForm();
}
