// admin/js/delivery-operations.mjs
import { createDelivery, updateDelivery, findActiveDeliveryForOrder } from './delivery-store.mjs';
import { buildDeliveryFromOrder, applyDeliveryTransition, isOrderEligibleForDelivery } from './delivery-lifecycle.mjs';
import { linkOrderToDelivery } from '../../js/store.mjs';

export async function createDeliveryForOrder(order, options = {}) {
  const delivery = buildDeliveryFromOrder(order, options);
  const ref = await createDelivery(delivery);
  // Non-fatal: the delivery itself is already created and usable in the admin
  // dashboard either way — this link only affects whether the *customer's*
  // tracking page can show delivery progress, so a failure here shouldn't
  // roll back or block the delivery creation the admin actually asked for.
  if (order.id) {
    linkOrderToDelivery(order.id, ref.id).catch(err => console.warn('Could not link order to delivery:', err));
  }
  return ref;
}

// Used by the "Send to Delivery" button on the Orders tab. Unlike
// createDeliveryForOrder above (which always creates a new record, used by
// the Delivery Queue's own "Create Delivery" flow with an explicit
// personnel/type selection), this is idempotent: if the order already has
// an active delivery, it returns that instead of creating a duplicate.
export async function createDeliveryFromOrder(order) {
  if (!isOrderEligibleForDelivery(order)) {
    throw new Error('Only confirmed orders can be sent to delivery.');
  }
  const existing = await findActiveDeliveryForOrder(order.id);
  if (existing) return { id: existing.id, alreadyExists: true };
  const ref = await createDelivery(buildDeliveryFromOrder(order));
  if (order.id) {
    linkOrderToDelivery(order.id, ref.id).catch(err => console.warn('Could not link order to delivery:', err));
  }
  return { id: ref.id, alreadyExists: false };
}

export async function assignDeliveryPerson(delivery, person) {
  const patch = applyDeliveryTransition(delivery, 'assigned');
  return updateDelivery(delivery.id, {
    ...patch,
    assignedTo: person.id,
    assignedToName: person.name || '',
    assignedToPhone: person.phone || ''
  });
}

export async function transitionDelivery(delivery, nextState, meta = {}) {
  return updateDelivery(delivery.id, applyDeliveryTransition(delivery, nextState, meta));
}

export function deliveryContactUrl(phone, message = '') {
  // Nigerian numbers can arrive as 0805..., 234805..., or +234805... — WhatsApp's
  // wa.me links need the country-code form with no plus and no leading zero
  // (same normalization used for customer contact in admin-orders.mjs).
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = '234' + digits.slice(1);
  else if (!digits.startsWith('234') && digits.length === 10) digits = '234' + digits;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
