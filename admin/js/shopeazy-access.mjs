// admin/js/shopeazy-access.mjs
// Client-side ShopEazy access helper. Firestore rules remain authoritative.
// Firebase Auth custom claims are read-only in the browser.

export const SHOPEAZY_ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  PARTNER_MANAGER: 'PARTNER_MANAGER',
  PARTNER_STAFF: 'PARTNER_STAFF',
  OUTLET_STAFF: 'OUTLET_STAFF'
});

export async function getShopEazyAccess(user) {
  if (!user) {
    return { authenticated: false, role: null, partnerId: null, outletId: null, isLegacyAdmin: false };
  }

  const tokenResult = await user.getIdTokenResult();
  const claims = tokenResult.claims || {};
  const isLegacyAdmin = user.email === 'damzyeazy@gmail.com';
  const role = claims.shopEazyRole || (isLegacyAdmin ? SHOPEAZY_ROLES.ADMIN : null);

  return {
    authenticated: true,
    role,
    partnerId: claims.shopEazyPartnerId || null,
    outletId: claims.shopEazyOutletId || null,
    isLegacyAdmin
  };
}

export function shopEazyCan(access, capability) {
  if (!access?.authenticated) return false;

  const matrix = {
    manageCatalog: ['ADMIN'],
    managePartners: ['ADMIN', 'PARTNER_MANAGER'],
    manageOutlets: ['ADMIN', 'PARTNER_MANAGER'],
    manageInventory: ['ADMIN', 'PARTNER_MANAGER', 'PARTNER_STAFF', 'OUTLET_STAFF'],
    reviewOrders: ['ADMIN', 'PARTNER_MANAGER', 'PARTNER_STAFF'],
    operateFulfillment: ['ADMIN', 'PARTNER_MANAGER', 'PARTNER_STAFF', 'OUTLET_STAFF'],
    manageReturns: ['ADMIN', 'PARTNER_MANAGER'],
    viewAudit: ['ADMIN', 'PARTNER_MANAGER']
  };

  return (matrix[capability] || []).includes(access.role);
}

export function describeShopEazyRole(role) {
  return {
    ADMIN: 'Administrator',
    PARTNER_MANAGER: 'Partner Manager',
    PARTNER_STAFF: 'Partner Staff',
    OUTLET_STAFF: 'Outlet Staff'
  }[role] || 'Unassigned';
}
