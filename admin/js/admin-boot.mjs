// Diagnostic bootstrap for the admin entry module.
// Catch dependency/import failures before the login handler can attach.
import('./admin-app.mjs').catch((error) => {
  console.error('Admin dashboard failed to start:', error);
  const errorEl = document.getElementById('loginError');
  if (errorEl) {
    errorEl.textContent = 'Admin app could not start: ' + (error?.message || String(error));
    errorEl.classList.remove('hidden');
  }
});
