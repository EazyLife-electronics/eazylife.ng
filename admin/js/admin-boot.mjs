// Diagnostic bootstrap for the admin entry module.
// Loads dependencies one at a time so the exact module causing a parse/import failure is visible.
const checks = [
  '../../js/firebase.mjs',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
  '../../js/store.mjs',
  './admin-shared.mjs',
  './shopeazy-access.mjs',
  './shopeazy-partners.mjs',
  './shopeazy-orders.mjs',
  './admin-products.mjs',
  './admin-heroes.mjs',
  './admin-reviews.mjs',
  './admin-requests.mjs',
  './admin-orders.mjs',
  './admin-settings.mjs'
];

(async () => {
  for (const path of checks) {
    try {
      await import(path);
    } catch (error) {
      console.error('Admin dependency failed:', path, error);
      const errorEl = document.getElementById('loginError');
      if (errorEl) {
        errorEl.textContent = 'Admin dependency failed: ' + path + ' — ' + (error?.message || String(error));
        errorEl.classList.remove('hidden');
      }
      return;
    }
  }

  try {
    await import('./admin-app.mjs');
  } catch (error) {
    console.error('Admin app failed to start:', error);
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
      errorEl.textContent = 'Admin app could not start: ' + (error?.message || String(error));
      errorEl.classList.remove('hidden');
    }
  }
})();
