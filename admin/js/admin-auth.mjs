// admin/js/admin-auth.mjs
// Single source of truth for who is allowed into the admin UI and the
// Component Painter. Firestore rules still need the same email listed in
// isAdmin() — keep them in sync when you change this list.
//
// To add another admin later: append their email here AND update
// firestore.rules isAdmin(). Prefer Firebase custom claims long-term.

export const ADMIN_EMAILS = Object.freeze([
  'damzyeazy@gmail.com'
]);

export function isAdminUser(user) {
  if (!user || !user.email) return false;
  const email = String(user.email).trim().toLowerCase();
  return ADMIN_EMAILS.some(allowed => allowed.toLowerCase() === email);
}

/**
 * Redirect an unauthenticated or non-admin visitor to the admin login page,
 * optionally signing out a wrong account first. Preserves returnTo so the
 * dashboard can send them back after a successful admin sign-in.
 */
export function redirectToAdminLogin(auth, signOutFn, user, options = {}) {
  const login = new URL(options.loginPath || 'index.html', location.href);
  if (options.returnTo !== false) {
    login.searchParams.set('returnTo', options.returnTo || location.href);
  }
  const finish = () => location.replace(login.href);
  if (user && !isAdminUser(user) && auth && typeof signOutFn === 'function') {
    Promise.resolve(signOutFn(auth)).finally(finish);
  } else {
    finish();
  }
}

/**
 * After a successful admin login on index.html, send the user back to a
 * same-origin admin tool page if returnTo is present and safe.
 * Returns true if a redirect was started.
 */
export function consumeAdminReturnTo(user) {
  if (!isAdminUser(user)) return false;
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  if (!returnTo) return false;
  try {
    const target = new URL(returnTo, location.origin);
    if (target.origin !== location.origin) return false;
    // Only allow known admin tool pages under /admin/
    const path = target.pathname;
    const allowed =
      path.endsWith('/admin/circuit-component-painter.html') ||
      path.endsWith('/admin/portfolio-import.html') ||
      path.endsWith('/admin/customers.html');
    if (!allowed) return false;
    location.replace(target.href);
    return true;
  } catch (error) {
    console.warn('Ignoring invalid admin return destination:', error);
    return false;
  }
}
