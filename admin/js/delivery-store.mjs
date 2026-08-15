// admin/js/delivery-store.mjs
// Delivery data layer. Delivery records remain separate from orders.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, onSnapshot, query, orderBy, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
const { db } = initFirebase();
const watch = (name, cb) => onSnapshot(collection(db,name), s => cb(s.docs.map(d=>({id:d.id,...d.data()}))));
export const watchDeliveryPersonnel = cb => watch('deliveryPersonnel',cb);
export const addDeliveryPersonnel = data => addDoc(collection(db,'deliveryPersonnel'),data);
export const updateDeliveryPersonnel = (id,data) => updateDoc(doc(db,'deliveryPersonnel',id),data);
export const deleteDeliveryPersonnel = id => deleteDoc(doc(db,'deliveryPersonnel',id));
export const watchDeliveryTypes = cb => watch('deliveryTypes',cb);
export const addDeliveryType = data => addDoc(collection(db,'deliveryTypes'),data);
export const updateDeliveryType = (id,data) => updateDoc(doc(db,'deliveryTypes',id),data);
export const deleteDeliveryType = id => deleteDoc(doc(db,'deliveryTypes',id));
export const watchDeliveryCheckpoints = cb => watch('deliveryCheckpoints',cb);
export const addDeliveryCheckpoint = data => addDoc(collection(db,'deliveryCheckpoints'),data);
export const updateDeliveryCheckpoint = (id,data) => updateDoc(doc(db,'deliveryCheckpoints',id),data);
export const deleteDeliveryCheckpoint = id => deleteDoc(doc(db,'deliveryCheckpoints',id));
export const createDelivery = data => addDoc(collection(db,'deliveries'),data);
export const watchDeliveries = cb => watch('deliveries',cb);
export const updateDelivery = (id,data) => updateDoc(doc(db,'deliveries',id),data);

export async function getDeliveryForOrder(orderId) {
  if (!orderId) return null;
  const snap = await getDocs(query(collection(db,'deliveries'), where('orderId','==',orderId)));
  const first = snap.docs[0];
  return first ? { id:first.id, ...first.data() } : null;
}

export async function createDeliveryFromOrder(order) {
  const orderId = order?.id || order?.trackingCode;
  if (!orderId) throw new Error('Order has no ID or tracking code.');
  if (String(order.status || '').toLowerCase() !== 'confirmed') {
    throw new Error('Only confirmed orders can be sent to delivery.');
  }

  const existing = await getDeliveryForOrder(orderId);
  if (existing) return { ...existing, alreadyExists:true };

  const now = Date.now();
  const data = {
    orderId,
    trackingCode: order.trackingCode || order.id || orderId,
    customerName: order.customerName || '',
    phone: order.phone || '',
    address: order.address || '',
    items: Array.isArray(order.items) ? order.items : [],
    orderTotal: Number(order.total || 0),
    status: 'ready',
    deliveryTypeId: null,
    assignedTo: null,
    assignedToName: '',
    assignedToPhone: '',
    lastCheckpointId: null,
    createdAt: now,
    updatedAt: now
  };
  const ref = await createDelivery(data);
  return { id:ref.id, ...data, alreadyExists:false };
}
