// admin/js/delivery-lifecycle.mjs
// Delivery business rules kept independent from the UI.

export const DELIVERY_STATES = Object.freeze({
  READY: 'ready',
  ASSIGNED: 'assigned',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  CHECKPOINT: 'checkpoint',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETURNED: 'returned',
  CANCELLED: 'cancelled'
});

export const DELIVERY_STATE_LABELS = Object.freeze({
  ready: 'Ready for Delivery',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  checkpoint: 'At Checkpoint',
  delivered: 'Delivered',
  failed: 'Failed Delivery',
  returned: 'Returned',
  cancelled: 'Cancelled'
});

export const DELIVERY_STATE_ORDER = [
  DELIVERY_STATES.READY,
  DELIVERY_STATES.ASSIGNED,
  DELIVERY_STATES.PICKED_UP,
  DELIVERY_STATES.IN_TRANSIT,
  DELIVERY_STATES.CHECKPOINT,
  DELIVERY_STATES.DELIVERED
];

// Only orders that have reached an operationally safe state may enter delivery.
export function isOrderEligibleForDelivery(order = {}) {
  const state = String(order.status || order.orderStatus || '').trim().toLowerCase();
  return ['confirmed', 'shipped'].includes(state) && state !== 'cancelled';
}

export function getDeliveryStateLabel(state) {
  return DELIVERY_STATE_LABELS[state] || 'Unknown';
}

export function canTransitionDelivery(from, to) {
  if (!from || from === to) return false;
  const allowed = {
    ready: ['assigned', 'cancelled'],
    assigned: ['picked_up', 'ready', 'cancelled'],
    picked_up: ['in_transit', 'failed', 'returned'],
    in_transit: ['checkpoint', 'delivered', 'failed', 'returned'],
    checkpoint: ['in_transit', 'delivered', 'failed', 'returned'],
    failed: ['assigned', 'returned'],
    returned: ['assigned', 'cancelled'],
    delivered: [],
    cancelled: []
  };
  return (allowed[from] || []).includes(to);
}

export function buildDeliveryFromOrder(order, {
  deliveryTypeId = null,
  deliveryType = null,
  personnelId = null,
  personnelName = null
} = {}) {
  if (!isOrderEligibleForDelivery(order)) {
    throw new Error('Order is not confirmed or otherwise eligible for delivery.');
  }

  return {
    orderId: order.id || null,
    customerId: order.customerId || null,
    customerName: order.customerName || order.customer || '',
    customerPhone: order.customerPhone || order.phone || '',
    address: order.deliveryAddress || order.address || '',
    deliveryTypeId,
    deliveryType,
    assignedTo: personnelId,
    assignedToName: personnelName,
    status: personnelId ? DELIVERY_STATES.ASSIGNED : DELIVERY_STATES.READY,
    checkpoints: [],
    createdAt: Date.now(),
    assignedAt: personnelId ? Date.now() : null,
    pickedUpAt: null,
    outForDeliveryAt: null,
    deliveredAt: null,
    failedAt: null,
    returnedAt: null
  };
}

export function applyDeliveryTransition(delivery, nextState, meta = {}) {
  const current = delivery?.status || DELIVERY_STATES.READY;
  if (!canTransitionDelivery(current, nextState)) {
    throw new Error(`Invalid delivery transition: ${current} -> ${nextState}`);
  }

  const now = Date.now();
  const patch = { status: nextState, updatedAt: now };

  if (nextState === DELIVERY_STATES.ASSIGNED) patch.assignedAt = delivery.assignedAt || now;
  if (nextState === DELIVERY_STATES.PICKED_UP) patch.pickedUpAt = now;
  if (nextState === DELIVERY_STATES.IN_TRANSIT) patch.outForDeliveryAt = now;
  if (nextState === DELIVERY_STATES.DELIVERED) patch.deliveredAt = now;
  if (nextState === DELIVERY_STATES.FAILED) patch.failedAt = now;
  if (nextState === DELIVERY_STATES.RETURNED) patch.returnedAt = now;

  if (meta.checkpointId) {
    patch.lastCheckpointId = meta.checkpointId;
    patch.lastCheckpointAt = now;
  }

  return patch;
}
