// admin/js/delivery-store.mjs
// Kept separate from the existing store until the delivery model is proven.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
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

// Looks up whether an order already has an in-progress delivery record, so
// callers can avoid creating duplicates (e.g. clicking "Send to Delivery"
// twice, or once from the Orders tab and once from the Delivery Queue).
export async function findActiveDeliveryForOrder(orderId) {
  const snap = await getDocs(query(collection(db, 'deliveries'), where('orderId', '==', orderId)));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .find(d => !['cancelled', 'returned'].includes(d.status)) || null;
}