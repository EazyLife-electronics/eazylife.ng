// admin/js/payments.mjs
// Payment ledger is intentionally independent from order status.
import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query, orderBy, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const { db, auth } = initFirebase();

export const PAYMENT_TERMS = { prepaid: 'Prepaid', pay_on_delivery: 'Pay on Delivery', credit: 'Credit', installment: 'Installment' };
export const PAYMENT_METHODS = { cash: 'Cash', bank_transfer: 'Bank Transfer', pos: 'POS', card: 'Card', other: 'Other' };
const CLOSED_ORDER_STATUSES = new Set(['cancelled', 'returned']);

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
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_TERMS, paymentTerms)) throw new Error('Invalid payment terms.');
  return updateDoc(doc(db, 'orders', orderId), { paymentTerms, paymentTermsUpdatedAt: serverTimestamp() });
}

export async function recordPayment(orderId, payment) {
  const amount = normalizeAmount(payment.amount);
  const method = payment.method || 'other';
  if (!Object.prototype.hasOwnProperty.call(PAYMENT_METHODS, method)) throw new Error('Invalid payment method.');
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in as an administrator.');
  const orderSnap = await getDoc(doc(db, 'orders', orderId));
  if (!orderSnap.exists()) throw new Error('Order no longer exists.');
  const order = { id: orderId, ...orderSnap.data() };
  if (CLOSED_ORDER_STATUSES.has(String(order.status || '').toLowerCase())) {
    throw new Error('Payments cannot be recorded for a cancelled or returned order.');
  }
  const payments = await getOrderPayments(orderId);
  const summary = summarizePayments(order, payments);
  if (amount > summary.balance) throw new Error(`Payment exceeds the outstanding balance of ₦${summary.balance.toLocaleString()}.`);
  return addDoc(collection(db, 'orders', orderId, 'payments'), {
    amount, method,
    reference: String(payment.reference || '').trim(),
    note: String(payment.note || '').trim(),
    receivedAt: serverTimestamp(), createdAt: serverTimestamp(),
    recordedByUid: user.uid, recordedByEmail: user.email || ''
  });
}

function formatMoney(value) { return `₦${Number(value || 0).toLocaleString()}`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]); }

function findOrderCard(orderId) {
  const button = document.querySelector(`[data-msg-toggle="${CSS.escape(orderId)}"]`);
  return button?.closest('.bg-white');
}

function getCardOrderId(card) {
  return card.querySelector('[data-msg-toggle]')?.dataset.msgToggle || '';
}

function getCardStatus(card, order) {
  const explicit = card.dataset.orderStatus;
  if (explicit) return explicit.toLowerCase();
  const statusBadge = card.querySelector('[data-order-status-badge]');
  if (statusBadge) return statusBadge.textContent.trim().toLowerCase();
  const orderStatus = String(order?.status || '').toLowerCase();
  if (orderStatus) return orderStatus;
  // admin-app currently renders the status as the first status pill in the card.
  const spans = [...card.querySelectorAll('span')];
  return spans.find(s => ['new', 'confirmed', 'delivered', 'cancelled', 'returned'].includes(s.textContent.trim().toLowerCase()))?.textContent.trim().toLowerCase() || '';
}

function buildClosedPanel(orderId, status, paid) {
  const panel = document.createElement('div');
  panel.dataset.paymentPanel = orderId;
  panel.className = 'mt-3 pt-3 border-t border-gray-100';
  panel.innerHTML = `
    <div class="flex justify-between items-center mb-2">
      <div><p class="text-[10px] font-black uppercase text-gray-400">Payment</p><p class="text-xs font-bold text-gray-500">Collection closed — order ${escapeHtml(status)}</p></div>
      <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">CLOSED</span>
    </div>
    ${paid > 0
      ? `<div class="bg-gray-50 rounded-lg p-2"><p class="text-[9px] uppercase text-gray-400 font-bold">Paid before ${escapeHtml(status)}</p><p class="text-xs font-black">${formatMoney(paid)}</p></div>`
      : '<p class="text-[10px] text-gray-400">No payments recorded before this order was closed.</p>'}`;
  return panel;
}

// WeakSet is important here. The old observer could start several async Firestore
// reads for the same card before the first read finished. Each read then appended
// another payment panel, producing the inconsistent "loop" of duplicate panels.
const pendingCards = new WeakSet();

async function enhanceOrderCard(orderInput, suppliedCard = null) {
  const orderId = orderInput.id;
  const card = suppliedCard || findOrderCard(orderId);
  if (!card || !card.isConnected) return;
  if (card.querySelector(`[data-payment-panel="${CSS.escape(orderId)}"]`)) return;
  if (pendingCards.has(card)) return;

  pendingCards.add(card);
  try {
    const orderSnap = await getDoc(doc(db, 'orders', orderId));
    if (!orderSnap?.exists() || !card.isConnected) return;

    const order = { id: orderId, ...orderSnap.data() };
    const status = getCardStatus(card, order);
    const payments = await getOrderPayments(orderId).catch(() => []);
    if (!card.isConnected) return;

    const paid = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);

    // Cancelled/returned orders are closed. They remain visible for history,
    // but must never look like outstanding receivables and must not accept payment.
    if (CLOSED_ORDER_STATUSES.has(String(order.status || status).toLowerCase())) {
      const panel = buildClosedPanel(orderId, String(order.status || status).toLowerCase(), paid);
      card.appendChild(panel);
      return;
    }

    const summary = summarizePayments(order, payments);
    const terms = order.paymentTerms || 'pay_on_delivery';
    const paymentRows = payments.length
      ? payments.map(p => `<div class="flex justify-between gap-2 text-[10px] text-gray-500"><span>${escapeHtml(PAYMENT_METHODS[p.method] || p.method)}${p.reference ? ` · ${escapeHtml(p.reference)}` : ''}</span><b class="text-gray-700">${formatMoney(p.amount)}</b></div>`).join('')
      : '<p class="text-[10px] text-gray-400">No payments recorded yet.</p>';

    const panel = document.createElement('div');
    panel.dataset.paymentPanel = orderId;
    panel.className = 'mt-3 pt-3 border-t border-gray-100';
    panel.innerHTML = `
      <div class="flex justify-between items-center mb-2">
        <div><p class="text-[10px] font-black uppercase text-gray-400">Payment</p><p class="text-xs font-bold text-gray-700">${escapeHtml(PAYMENT_TERMS[terms] || terms)} · <span class="uppercase">${summary.status}</span></p></div>
        <div class="text-right"><p class="text-[10px] text-gray-400">Balance due</p><p class="text-sm font-black ${summary.balance ? 'text-red-600' : 'text-green-600'}">${formatMoney(summary.balance)}</p></div>
      </div>
      <div class="bg-gray-50 rounded-lg p-2 mb-2 space-y-1">${paymentRows}</div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <select data-payment-terms="${escapeHtml(orderId)}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">${Object.entries(PAYMENT_TERMS).map(([key, label]) => `<option value="${key}" ${key === terms ? 'selected' : ''}>${label}</option>`).join('')}</select>
        <button type="button" data-payment-add="${escapeHtml(orderId)}" class="bg-gray-900 text-white p-2 rounded-lg text-[10px] font-bold" ${summary.balance <= 0 ? 'disabled' : ''}>Record Payment</button>
      </div>
      <div data-payment-form="${escapeHtml(orderId)}" class="hidden space-y-2 bg-white border border-gray-200 rounded-lg p-2">
        <input data-pay-amount="${escapeHtml(orderId)}" type="number" min="1" step="0.01" placeholder="Amount (₦)" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
        <select data-pay-method="${escapeHtml(orderId)}" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">${Object.entries(PAYMENT_METHODS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}</select>
        <input data-pay-reference="${escapeHtml(orderId)}" placeholder="Reference (optional)" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
        <input data-pay-note="${escapeHtml(orderId)}" placeholder="Note (optional)" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] outline-none">
        <button type="button" data-pay-save="${escapeHtml(orderId)}" class="w-full bg-[#00B09B] text-white p-2 rounded-lg text-[10px] font-bold">Save Payment</button>
      </div>`;

    card.appendChild(panel);

    panel.querySelector('[data-payment-terms]').addEventListener('change', async e => {
      const previous = order.paymentTerms || 'pay_on_delivery';
      e.target.disabled = true;
      try {
        await setOrderPaymentTerms(orderId, e.target.value);
        order.paymentTerms = e.target.value;
      } catch (err) {
        alert(err.message);
        e.target.value = previous;
      } finally {
        e.target.disabled = false;
      }
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
        await recordPayment(orderId, { amount, method, reference, note });
        await refreshPaymentsForCard({ id: orderId });
      } catch (err) {
        alert(err.message);
        e.currentTarget.disabled = false;
        e.currentTarget.textContent = 'Save Payment';
      }
    });
  } finally {
    pendingCards.delete(card);
  }
}

async function refreshPaymentsForCard(order) {
  const card = findOrderCard(order.id);
  if (!card) return;
  const old = card.querySelector(`[data-payment-panel="${CSS.escape(order.id)}"]`);
  if (old) old.remove();
  await enhanceOrderCard(order, card);
}

export function initPaymentsAdmin() {
  let observer = null;
  let scheduled = false;

  const stopObserver = () => {
    if (observer) observer.disconnect();
    observer = null;
  };

  const startForCurrentUser = user => {
    stopObserver();
    if (!user) return;

    const target = document.getElementById('orderList');
    if (!target) return;

    const enhance = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        const cards = [...target.querySelectorAll('[data-msg-toggle]')]
          .map(button => button.closest('.bg-white'))
          .filter(Boolean);
        cards.forEach(card => {
          const id = getCardOrderId(card);
          if (!id) return;
          if (card.querySelector(`[data-payment-panel="${CSS.escape(id)}"]`)) return;
          enhanceOrderCard({ id }, card);
        });
      });
    };

    observer = new MutationObserver(enhance);
    observer.observe(target, { childList: true, subtree: true });
    enhance();
  };

  const authStop = onAuthStateChanged(auth, startForCurrentUser);
  return () => {
    stopObserver();
    if (authStop) authStop();
  };
}

// The admin dashboard loads modules dynamically, so initialize this ledger only on admin pages.
if (typeof location !== 'undefined' && location.pathname.includes('/admin/')) initPaymentsAdmin();
