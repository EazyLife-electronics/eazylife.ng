import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { initFirebase } from "../../js/firebase.mjs";

const { db } = initFirebase();

const TERMS = [
  ['prepaid', 'Prepaid'],
  ['pay_on_delivery', 'Pay on Delivery'],
  ['credit', 'Credit'],
  ['installment', 'Installment']
];
const METHODS = ['Cash', 'Bank Transfer', 'POS', 'Card', 'Other'];

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
}

function paymentStatus(total, paid) {
  const balance = Math.max(0, Number(total || 0) - Number(paid || 0));
  if (balance <= 0) return ['PAID', 'bg-green-100 text-green-700'];
  if (paid > 0) return ['PARTIAL', 'bg-yellow-100 text-yellow-700'];
  return ['UNPAID', 'bg-gray-100 text-gray-600'];
}

async function loadPayments(orderId) {
  const q = query(collection(db, 'orders', orderId, 'payments'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function refreshPaymentCard(orderId, root) {
  const orderSnap = await getDoc(doc(db, 'orders', orderId));
  if (!orderSnap.exists()) throw new Error('Order no longer exists.');
  const order = orderSnap.data();
  const payments = await loadPayments(orderId);
  const total = Number(order.total || 0);
  const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const balance = Math.max(0, total - paid);
  const [status, statusClass] = paymentStatus(total, paid);
  const currentTerms = order.paymentTerms || 'pay_on_delivery';

  root.innerHTML = `
    <div class="border-t border-gray-100 pt-3 mt-3">
      <div class="flex justify-between items-center mb-2">
        <div>
          <p class="text-[10px] font-black uppercase text-gray-400">Payment</p>
          <p class="text-xs font-bold text-gray-700">${esc(TERMS.find(x => x[0] === currentTerms)?.[1] || currentTerms)}</p>
        </div>
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${statusClass}">${status}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <div class="bg-gray-50 rounded-lg p-2"><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-xs font-black">${money(paid)}</p></div>
        <div class="bg-gray-50 rounded-lg p-2"><p class="text-[9px] uppercase text-gray-400 font-bold">Balance</p><p class="text-xs font-black">${money(balance)}</p></div>
      </div>
      <div class="grid grid-cols-1 gap-2">
        <select data-payment-terms class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
          ${TERMS.map(([value, label]) => `<option value="${value}" ${currentTerms === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        ${balance > 0 ? `<button type="button" data-record-payment class="w-full bg-gray-900 text-white text-[11px] font-bold py-2 rounded-lg">Record Payment</button>` : ''}
      </div>
      <div data-payment-form class="hidden mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
        <input data-payment-amount type="number" min="1" step="1" max="${balance}" placeholder="Amount (max ${money(balance)})" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">
        <select data-payment-method class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">
          ${METHODS.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
        <input data-payment-reference placeholder="Reference (optional)" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">
        <input data-payment-note placeholder="Note (optional)" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">
        <div class="flex gap-2"><button type="button" data-payment-save class="flex-1 bg-[#00B09B] text-white text-[11px] font-bold py-2 rounded-lg">Save Payment</button><button type="button" data-payment-cancel class="bg-white border border-gray-200 text-gray-600 text-[11px] font-bold px-3 rounded-lg">Cancel</button></div>
      </div>
      ${payments.length ? `<div class="mt-3 space-y-1.5">${payments.map(p => {
        const when = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString() : '';
        return `<div class="flex justify-between items-start text-[10px] bg-white border border-gray-100 rounded-lg p-2"><div><b>${esc(p.method || 'Other')}</b>${p.reference ? ` · ${esc(p.reference)}` : ''}<div class="text-gray-400">${when}${p.note ? ` · ${esc(p.note)}` : ''}</div></div><b>${money(p.amount)}</b></div>`;
      }).join('')}</div>` : `<p class="text-[10px] text-gray-400 mt-3">No payments recorded yet.</p>`}
    </div>
  `;

  root.querySelector('[data-payment-terms]').addEventListener('change', async e => {
    const value = e.target.value;
    e.target.disabled = true;
    try {
      await updateDoc(doc(db, 'orders', orderId), { paymentTerms: value, paymentTermsUpdatedAt: serverTimestamp() });
      await refreshPaymentCard(orderId, root);
    } catch (err) {
      e.target.disabled = false;
      alert(`Payment terms could not be saved: ${err.message}`);
    }
  });

  const recordBtn = root.querySelector('[data-record-payment]');
  const form = root.querySelector('[data-payment-form]');
  recordBtn?.addEventListener('click', () => form.classList.toggle('hidden'));
  root.querySelector('[data-payment-cancel]')?.addEventListener('click', () => form.classList.add('hidden'));

  root.querySelector('[data-payment-save]')?.addEventListener('click', async () => {
    const amount = Number(root.querySelector('[data-payment-amount]').value || 0);
    const method = root.querySelector('[data-payment-method]').value;
    const reference = root.querySelector('[data-payment-reference]').value.trim();
    const note = root.querySelector('[data-payment-note]').value.trim();
    if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid payment amount.');
    if (amount > balance) return alert(`Payment exceeds the outstanding balance of ${money(balance)}.`);

    const save = root.querySelector('[data-payment-save]');
    save.disabled = true;
    save.textContent = 'Saving...';
    try {
      await addDoc(collection(db, 'orders', orderId, 'payments'), {
        amount,
        method,
        reference,
        note,
        createdAt: serverTimestamp()
      });
      await refreshPaymentCard(orderId, root);
    } catch (err) {
      save.disabled = false;
      save.textContent = 'Save Payment';
      alert(`Payment could not be saved: ${err.message}`);
    }
  });
}

function enhanceOrders() {
  const list = document.getElementById('orderList');
  if (!list) return;
  list.querySelectorAll(':scope > div').forEach(card => {
    if (card.querySelector('[data-payment-root]')) return;
    const button = card.querySelector('[data-order]');
    if (!button) return;
    const orderId = button.dataset.order;
    const root = document.createElement('div');
    root.dataset.paymentRoot = orderId;
    card.appendChild(root);
    refreshPaymentCard(orderId, root).catch(err => {
      root.innerHTML = `<p class="text-[10px] text-red-500 mt-3">Payment section failed to load: ${esc(err.message)}</p>`;
    });
  });
}

export function initPaymentsUI() {
  const list = document.getElementById('orderList');
  if (!list) return () => {};
  const observer = new MutationObserver(() => enhanceOrders());
  observer.observe(list, { childList: true });
  enhanceOrders();
  return () => observer.disconnect();
}
