// admin/js/delivery-details.mjs
import { watchDeliveries, watchDeliveryPersonnel, watchDeliveryTypes, watchDeliveryCheckpoints, updateDelivery } from './delivery-store.mjs';
import { DELIVERY_STATE_LABELS, canTransitionDelivery } from './delivery-lifecycle.mjs';

export function deliveryDetailModel(delivery, personnel, types, checkpoints) {
  const person = personnel.find(p => p.id === delivery.assignedTo);
  const type = types.find(t => t.id === delivery.deliveryTypeId || t.id === delivery.deliveryType);
  const checkpoint = checkpoints.find(c => c.id === delivery.lastCheckpointId);
  return {
    ...delivery,
    personnelName: person?.name || delivery.assignedToName || 'Unassigned',
    personnelPhone: person?.phone || delivery.assignedToPhone || '',
    deliveryTypeName: type?.name || delivery.deliveryType || 'Not selected',
    checkpointName: checkpoint?.name || 'No checkpoint'
  };
}

export async function setDeliveryStatus(delivery, nextState, meta = {}) {
  if (!delivery?.id) throw new Error('Delivery record has no id.');
  if (!canTransitionDelivery(delivery.status, nextState)) {
    throw new Error(`Cannot move delivery from ${DELIVERY_STATE_LABELS[delivery.status] || delivery.status} to ${DELIVERY_STATE_LABELS[nextState] || nextState}.`);
  }
  const now = Date.now();
  const patch = { status: nextState, updatedAt: now };
  if (nextState === 'picked_up') patch.pickedUpAt = now;
  if (nextState === 'in_transit') patch.outForDeliveryAt = now;
  if (nextState === 'delivered') patch.deliveredAt = now;
  if (nextState === 'failed') patch.failedAt = now;
  if (nextState === 'returned') patch.returnedAt = now;
  if (meta.checkpointId) {
    patch.lastCheckpointId = meta.checkpointId;
    patch.lastCheckpointAt = now;
  }
  return updateDelivery(delivery.id, patch);
}
