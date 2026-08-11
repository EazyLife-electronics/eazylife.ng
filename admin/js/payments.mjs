// admin/js/payments.mjs
// Payment ledger is intentionally independent from order status.
// Order status answers: "Where is the order?"
// Payment terms/status answer: "How/when is it being paid?"

import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, doc, getDocs, addDoc, updateDoc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const { db, auth } = initFirebase();

export const PAYMENT_TERMS = {
  prepaid: 'Prepaid',
  pay_on_delivery: 'Pay on Delivery',
  credit: 'Credit',
  installment: 'Installment'
};

export const PAYMENT_METHODS = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  pos: 'POS',
  card: 'Card',
  other: 'Other'
};

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Payment amount must be greater than zero.');
  return Math.round(amount * 100) / 100;
}

export async function getOrderPayments(orderId) {
  const q = query(collection(db, 'orders', orderId, 'payments'), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function summarizePayments(order, payments) {
  const total = Math.max(0, Number(order?.total) || 0);
  const paid = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);
  const refunded = payments.reduce((sum, p) => sum + Math.max(0, Number(p.refundAmount) || 0), 0);
  const netPaid = Math.max(0, paid - refunded);
  const balance = Math.max(0, total - netPaid);
  let status = 'unpaid';
  if (netPaid > 0 && balance > 0) status = 'partial';
  if (balance === 0 && total > 0) status = 'paid';
  if (netPaid > total) status = 'overpaid';
  return { total, paid, refunded, netPaid, balance, status };
}

export async function setOrderPaymentTerms(orderId, paymentTerms) {
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_TERMS, paymentTerms)) {
    throw new Error('Invalid payment terms.');
  }
  return updateDoc(doc(db, 'orders', orderId), {
    paymentTerms,
    paymentTermsUpdatedAt: serverTimestamp()
  });
}

export async function recordPayment(orderId, payment) {
  const amount = normalizeAmount(payment.amount);
  const method = payment.method || 'other';
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, method)) throw new Error('Invalid payment method.');

  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in as an administrator.');

  const payments = await getOrderPayments(orderId);
  const orderRef = doc(db, 'orders', orderId);
  const paymentRef = doc(collection(db, 'orders', orderId, 'payments'));
  const orderSnap = await (await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js')).getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error('Order no longer exists.');
  const order = { id: orderId, ...orderSnap.data() };
  const summary = summarizePayments(order, payments);
  if (amount > summary.balance) {
    throw new Error(`Payment exceeds the outstanding balance of ₦${summary.balance.toLocaleString()}.`);
  }

  return addDoc(collection(db, 'orders', orderId, 'payments'), {
    amount,
    method,
    reference: String(payment.reference || '').trim(),
    note: String(payment.note || '').trim(),
    receivedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    recordedByUid: user.uid,
    recordedByEmail: user.email || ''
  });
}

function formatMoney(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
}

function findOrderCard(orderId) {
  const button = document.querySelector(`[data-msg-toggle="${CSS.escape(orderId)}"]`);
  return button?.closest('.bg-white');
}

async function enhanceOrderCard(order) {
  const card = findOrderCard(order.id);
  if (!card || card.querySelector(`[data-payment-panel="${CSS.escape(order.id)}"]`)) return;

  const payments = await getOrderPayments(order.id).catch(() => []);
  const summary = summarizePayments(order, payments);
  const terms = order.paymentTerms || 'pay_on_delivery';
  const paymentRows = payments.length
    ? payments.map(p => `<div class="flex justify-between gap-2 text-[10px] text-gray-500"><span>${escapeHtml(PAYMENT_METHODS[p.method] || p.method)}${p.reference ? ` · ${escapeHtml(p.reference)}` : ''}</span><b class="text-gray-700">${formatMoney(p.amount)}</b></div>`).join('')
    : '<p class="text-[10px] text-gray-400">No payments recorded yet.</p>';

  const panel = document.createElement('div');
  panel.dataset.paymentPanel = order.id;
  panel.className = 'mt-3 pt-3 border-t border-gray-100';
  panel.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <div><p class="text-[10px] font-black uppercase text-gray-400">Payment</p><p class="text-xs font-bold text-gray-700">${escapeHtml(PAYMENT_TERMS[terms] || terms)} · <span class="uppercase">${summary.status}</span></p></div>
      <div class="text-right"><p class="text-[10px] text-gray-400">Balance due</p><p class="text-sm font-black ${summary.balance ? 'text-red-600' : 'text-green-600'}">${formatMoney(summary.balance)}</p></div>
    </div>
    <div class="bg-gray-50 rounded-lg p-2 mb-2 space-y-1">${paymentRows}</div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <select data-payment-terms="${escapeHtml(order.id)}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
        ${Object.entries(PAYMENT_TERMS).map(([key, label]) => `<option value="${key}" ${key === terms ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <button type="button" data-payment-add="${escapeHtml(order.id)}" class="bg-gray-900 text-white p-2 rounded-lg text-[10px] font-bold" ${summary.balance <= 0 ? 'disabled' : ''}>Record Payment</button>
    </div>
    <div data-payment-form="${escapeHtml(order.id)}" class="hidden space-y-2 bg-white border border-gray-200 rounded-lg p-2">
      <input data-pay-amount="${escapeHtml(order.id)}" type="number" min="1" step="0.01" placeholder="Amount (₦)" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
      <select data-pay-method="${escapeHtml(order.id)}" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">${Object.entries(PAYMENT_METHODS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>
      <input data-pay-reference="${escapeHtml(order.id)}" placeholder="Reference (optional)" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
      <input data-pay-note="${escapeHtml(order.id)}" placeholder="Note (optional)" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
      <button type="button" data-pay-save="${escapeHtml(order.id)}" class="w-full bg-[#00B09B] text-white p-2 rounded-lg text-[10px] font-bold">Save Payment</button>
    </div>`;

  card.appendChild(panel);

  panel.querySelector('[data-payment-terms]').addEventListener('change', async e => {
    e.target.disabled = true;
    try { await setOrderPaymentTerms(order.id, e.target.value); }
    catch (err) { alert(err.message); e.target.value = terms; }
    finally { e.target.disabled = false; }
  });
  panel.querySelector('[data-payment-add]').addEventListener('click', () => panel.querySelector('[data-payment-form]').classList.toggle('hidden'));
  panel.querySelector('[data-pay-save]').addEventListener('click', async e => {
    const amount = panel.querySelector('[data-pay-amount]').value;
    const method = panel.querySelector('[data-pay-method]').value;
    const reference = panel.querySelector('[data-pay-reference]').value;
    const note = panel.querySelector('[data-pay-note]').value;
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Saving...';
    try {
      await recordPayment(order.id, { amount, method, reference, note });
      await refreshPaymentsForCard(order);
    } catch (err) {
      alert(err.message);
      e.currentTarget.disabled = false;
      e.currentTarget.textContent = 'Save Payment';
    }
  });
}

async function refreshPaymentsForCard(order) {
  const card = findOrderCard(order.id);
  const old = card?.querySelector(`[data-payment-panel="${CSS.escape(order.id)}"]`);
  if (old) old.remove();
  await enhanceOrderCard(order);
}

export function initPaymentsAdmin() {
  let observer = null;
  let authStop = onAuthStateChanged(auth, user => {
    if (!user) return;
    const target = document.getElementById('orderList');
    if (!target) return;
    const enhance = () => {
      const buttons = target.querySelectorAll('[data-msg-toggle]');
      buttons.forEach(button => {
        const id = button.dataset.msgToggle;
        if (!id || findOrderCard(id)?.querySelector(`[data-payment-panel="${CSS.escape(id)}"]`)) return;
        enhanceOrderCard({ id });
      });
    };
    observer = new MutationObserver(enhance);
    observer.observe(target, { childList: true, subtree: true });
    enhance();
  });

  return () => {
    if (observer) observer.disconnect();
    if (authStop) authStop();
  };
}
