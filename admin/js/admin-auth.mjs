// Central admin authorization shared by the dashboard, Circuit Studio and tools.
// Firebase Auth proves identity; the private adminAccess/{uid} document grants access.
// Approval documents are created/managed in Firebase Console, never by client users.
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { reload } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const approvedUids = new Set();
const approvalDiagnostics = new Map();

export function getAdminApprovalDiagnostic(user) {
  return user ? approvalDiagnostics.get(user.uid) || '' : '';
}

export async function verifyAdminAccess(user, db) {
  if (!user || !db) return false;
  approvalDiagnostics.delete(user.uid);
  try {
    // Auth state can be cached after provider linking. Refresh the server-side
    // user record and ID token before making any verification decision.
    await reload(user);
    await user.getIdToken(true);

    const passwordProvider = (user.providerData || []).some(p => p.providerId === 'password');
    if (passwordProvider && !user.emailVerified) {
      approvedUids.delete(user.uid);
      approvalDiagnostics.set(user.uid, 'auth/email-not-verified: Firebase still reports this account email as unverified after refreshing the user record.');
      return false;
    }

    // Prevent a stalled Firestore request from leaving the login screen in a
    // permanent approval-check state. The underlying request may still finish.
    const lookup = getDoc(doc(db, 'adminAccess', user.uid));
    let timeoutId;
    const snap = await Promise.race([
      lookup,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          const error = new Error('Admin approval lookup timed out after 12 seconds.');
          error.code = 'admin/approval-timeout';
          reject(error);
        }, 12000);
      })
    ]).finally(() => clearTimeout(timeoutId));
    const data = snap.exists() ? snap.data() : null;
    const approved = !!data && data.status === 'approved' && data.role === 'admin';
    if (approved) approvedUids.add(user.uid);
    else approvedUids.delete(user.uid);
    return approved;
  } catch (error) {
    approvedUids.delete(user.uid);
    approvalDiagnostics.set(user.uid, `${error.code || 'lookup-error'}: ${error.message || 'Admin authorization check failed.'}`);
    console.error('Admin authorization check failed:', error);
    return false;
  }
}

// Synchronous check is intentionally cache-only. Call verifyAdminAccess first
// after every auth-state change before showing privileged UI.
export function isAdminUser(user) {
  return !!user && approvedUids.has(user.uid);
}

export function redirectToAdminLogin(auth, signOutFn, user, options = {}) {
  const login = new URL(options.loginPath || 'index.html', location.href);
  if (options.returnTo !== false) login.searchParams.set('returnTo', options.returnTo || location.href);
  const finish = () => location.replace(login.href);
  if (user && auth && typeof signOutFn === 'function') Promise.resolve(signOutFn(auth)).finally(finish);
  else finish();
}

export function consumeAdminReturnTo(user) {
  if (!isAdminUser(user)) return false;
  const returnTo = new URLSearchParams(location.search).get('returnTo');
  if (!returnTo) return false;
  try {
    const target = new URL(returnTo, location.origin);
    if (target.origin !== location.origin) return false;
    const path = target.pathname;
    const allowed = path.endsWith('/admin/circuit-component-painter.html')
      || path.endsWith('/admin/portfolio-import.html')
      || path.endsWith('/admin/customers.html');
    if (!allowed) return false;
    location.replace(target.href);
    return true;
  } catch (error) {
    console.warn('Ignoring invalid admin return destination:', error);
    return false;
  }
}
