import { initFirebase } from '../../js/firebase.mjs';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const { db } = initFirebase();
const CLOSED = new Set(['cancelled', 'returned']);
const TERMS = { prepaid: 'Prepaid', pay_on_delivery: 'Pay on Delivery', credit: 'Credit', installment: 'Installment' };

function money(value) { return `₦${Number(value || 0).toLocaleString()}`; }
function esc(value) { return String(value ?? '').replace(/[&<>\'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function dateText(value) {
  if (!value) return '';
  if (value.toDate) return value.toDate().toLocaleString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
}
function customerKey(order) {
  const phone = String(order.phone || '').replace(/\D/g, '');
  return phone ? `phone:${phone}` : `name:${String(order.customerName || 'Unknown').trim().toLowerCase()}`;
}

async function loadCustomerLedger(customer) {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const orders = [];
  let total = 0;
  let paid = 0;
  let outstanding = 0;

  for (const docSnap of snap.docs) {
    const order = { id: docSnap.id, ...docSnap.data() };
    if (customerKey(order) !== customer.key) continue;

    const paymentSnap = await getDocs(query(collection(db, 'orders', order.id, 'payments'), orderBy('createdAt', 'asc')));
    const payments = paymentSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const paymentTotal = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount || 0)), 0);
    const legacyPaid = Number(order.paidAmount || 0);
    const orderPaid = payments.length ? paymentTotal : legacyPaid;
    const orderTotal = Math.max(0, Number(order.total || 0));
    const balance = CLOSED.has(String(order.status || '').toLowerCase()) ? 0 : Math.max(0, orderTotal - orderPaid);

    total += orderTotal;
    paid += orderPaid;
    outstanding += balance;
    orders.push({ ...order, total: orderTotal, paid: orderPaid, balance, payments });
  }

  orders.sort((a, b) => {
    const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
    const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return { ...customer, total, paid, outstanding, orders };
}

function paymentRows(order) {
  if (!order.payments.length) return '<p class="text-[10px] text-gray-400">No payment records.</p>';
  return order.payments.map(p => `<div class="flex justify-between gap-3 text-[10px] bg-white border border-gray-100 rounded-lg p-2">
    <div><b>${esc(p.method || 'Other')}</b>${p.reference ? ` · ${esc(p.reference)}` : ''}<div class="text-gray-400">${esc(dateText(p.createdAt))}${p.note ? ` · ${esc(p.note)}` : ''}</div></div>
    <b class="shrink-0">${money(p.amount)}</b>
  </div>`).join('');
}

function orderRow(order, index) {
  const status = String(order.status || 'new').toLowerCase();
  const closed = CLOSED.has(status);
  const balanceLabel = closed ? 'Closed' : money(order.balance);
  const balanceClass = closed ? 'text-gray-400' : order.balance > 0 ? 'text-red-600' : 'text-green-600';
  return `<div class="border border-gray-100 rounded-xl p-3">
    <div class="flex justify-between gap-3 items-start">
      <div class="min-w-0"><p class="text-xs font-black truncate">${esc(order.trackingCode || order.id)}</p><p class="text-[10px] text-gray-400 mt-0.5">${esc(dateText(order.createdAt))} · ${esc(status)}</p></div>
      <span class="text-[9px] font-black uppercase px-2 py-1 rounded-full ${closed ? 'bg-gray-100 text-gray-500' : order.balance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}">${closed ? 'CLOSED' : order.balance > 0 ? 'OUTSTANDING' : 'PAID'}</span>
    </div>
    <div class="grid grid-cols-3 gap-2 mt-3">
      <div><p class="text-[9px] uppercase text-gray-400 font-bold">Total</p><p class="text-[11px] font-black">${money(order.total)}</p></div>
      <div><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-[11px] font-black">${money(order.paid)}</p></div>
      <div><p class="text-[9px] uppercase text-gray-400 font-bold">Balance</p><p class="text-[11px] font-black ${balanceClass}">${balanceLabel}</p></div>
    </div>
    <p class="text-[10px] text-gray-400 mt-2">${esc(TERMS[order.paymentTerms] || order.paymentTerms || 'Pay on Delivery')}</p>
    <button type="button" data-ledger-order="${index}" class="mt-2 text-[10px] font-bold text-gray-600">${order.payments.length ? 'View payment history' : 'No payment history'}</button>
    <div id="ledgerPayments-${index}" class="hidden mt-2 pt-2 border-t border-gray-100 space-y-1.5">${paymentRows(order)}</div>
  </div>`;
}

function renderLedger(customer) {
  const host = document.getElementById('receivablesContent');
  if (!host) return;
  host.innerHTML = `<div class="bg-white rounded-[24px] shadow-sm p-5">
    <div class="flex items-start gap-3 mb-5">
      <button id="ledgerBack" type="button" class="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold">← Back</button>
      <div class="min-w-0"><h2 class="font-black text-lg truncate">${esc(customer.name)}</h2><p class="text-xs text-gray-400 mt-1">${esc(customer.phone || 'No phone recorded')}</p></div>
    </div>
    <div class="grid grid-cols-3 gap-2 mb-5">
      <div class="bg-gray-50 rounded-2xl p-3"><p class="text-[9px] uppercase text-gray-400 font-bold">Total purchases</p><p class="text-sm font-black mt-1">${money(customer.total)}</p></div>
      <div class="bg-gray-50 rounded-2xl p-3"><p class="text-[9px] uppercase text-gray-400 font-bold">Total paid</p><p class="text-sm font-black mt-1">${money(customer.paid)}</p></div>
      <div class="bg-red-50 rounded-2xl p-3"><p class="text-[9px] uppercase text-red-400 font-bold">Outstanding</p><p class="text-sm font-black text-red-600 mt-1">${money(customer.outstanding)}</p></div>
    </div>
    <div class="flex justify-between items-center mb-3"><h3 class="font-black text-sm">Order history</h3><span class="text-[10px] text-gray-400">${customer.orders.length} order${customer.orders.length === 1 ? '' : 's'}</span></div>
    <div class="space-y-2">${customer.orders.map(orderRow).join('') || '<p class="text-sm text-gray-400 py-8 text-center">No orders found.</p>'}</div>
  </div>`;

  document.getElementById('ledgerBack')?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('eazylife:receivables-back')));
  document.querySelectorAll('[data-ledger-order]').forEach(btn => btn.addEventListener('click', () => {
    const panel = document.getElementById(`ledgerPayments-${btn.dataset.ledgerOrder}`);
    panel?.classList.toggle('hidden');
    btn.textContent = panel?.classList.contains('hidden') ? 'View payment history' : 'Hide payment history';
  }));
}

export async function openCustomerLedger(customer) {
  const host = document.getElementById('receivablesContent');
  if (!host) return;
  host.innerHTML = '<div class="bg-white rounded-[24px] p-10 text-center text-sm text-gray-400">Loading customer ledger...</div>';
  try {
    const ledger = await loadCustomerLedger(customer);
    renderLedger(ledger);
  } catch (err) {
    console.error('Customer ledger failed:', err);
    host.innerHTML = `<div class="bg-white rounded-[24px] p-6 text-sm text-red-600">Could not load customer ledger: ${esc(err.message)}</div>`;
  }
}
