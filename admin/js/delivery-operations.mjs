// admin/js/delivery-operations.mjs
import { createDelivery, updateDelivery } from './delivery-store.mjs';
import { buildDeliveryFromOrder, applyDeliveryTransition } from './delivery-lifecycle.mjs';

export async function createDeliveryForOrder(order, options = {}) {
  const delivery = buildDeliveryFromOrder(order, options);
  return createDelivery(delivery);
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
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}
