import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const { db } = initFirebase();

const TERMS = {
  prepaid: 'Prepaid',
  pay_on_delivery: 'Pay on Delivery',
  credit: 'Credit',
  installment: 'Installment'
};

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>\'\"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function dateText(timestamp) {
  if (!timestamp) return '';
  if (timestamp.toDate) return timestamp.toDate().toLocaleString();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
}

function isExcluded(order) {
  return ['cancelled', 'returned'].includes(String(order.status || '').toLowerCase());
}

function isDueNow(order, balance) {
  if (balance <= 0) return false;
  const terms = order.paymentTerms || 'pay_on_delivery';
  const status = String(order.status || '').toLowerCase();
  if (terms === 'prepaid') return true;
  return status === 'delivered';
}

async function loadOrderPayments(orderId) {
  const snap = await getDocs(
    query(collection(db, 'orders', orderId, 'payments'), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadReceivables() {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const orders = [];

  for (const docSnap of snap.docs) {
    const order = { id: docSnap.id, ...docSnap.data() };
    if (isExcluded(order)) continue;

    const payments = await loadOrderPayments(order.id);
    const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const legacyPaid = Number(order.paidAmount || 0);
    const paid = payments.length ? paymentTotal : legacyPaid;
    const total = Number(order.total || 0);
    const balance = Math.max(0, total - paid);

    if (balance <= 0) continue;

    orders.push({
      ...order,
      total,
      paid,
      balance,
      dueNow: isDueNow(order, balance),
      payments
    });
  }

  return orders;
}

function customerKey(order) {
  const phone = String(order.phone || '').replace(/\D/g, '');
  if (phone) return `phone:${phone}`;
  return `name:${String(order.customerName || 'Unknown').trim().toLowerCase()}`;
}

function aggregateCustomers(orders) {
  const map = new Map();
  for (const order of orders) {
    const key = customerKey(order);
    let customer = map.get(key);
    if (!customer) {
      customer = {
        key,
        name: order.customerName || 'Unknown',
        phone: order.phone || '',
        balance: 0,
        dueNow: 0,
        pending: 0,
        total: 0,
        paid: 0,
        orderCount: 0,
        orders: []
      };
      map.set(key, customer);
    }
    customer.name = customer.name === 'Unknown' && order.customerName ? order.customerName : customer.name;
    customer.phone = customer.phone || order.phone || '';
    customer.balance += order.balance;
    customer.total += order.total;
    customer.paid += order.paid;
    customer.orderCount += 1;
    if (order.dueNow) customer.dueNow += order.balance;
    else customer.pending += order.balance;
    customer.orders.push(order);
  }
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

function orderLine(order) {
  const terms = TERMS[order.paymentTerms] || order.paymentTerms || 'Pay on Delivery';
  const dueLabel = order.dueNow ? 'DUE NOW' : 'PENDING COLLECTION';
  const dueClass = order.dueNow ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  const items = (order.items || []).map(item => `${esc(item.name)} × ${Number(item.quantity || 0)}`).join(', ');
  return `
    <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
      <div class="flex justify-between gap-3 items-start">
        <div class="min-w-0">
          <p class="text-xs font-black text-gray-800 truncate">${esc(order.trackingCode || order.id)}</p>
          <p class="text-[10px] text-gray-500 mt-0.5">${esc(items || 'Order items')} · ${esc(order.status || 'new')}</p>
          <p class="text-[10px] text-gray-400 mt-1">${esc(terms)} · ${esc(dateText(order.createdAt))}</p>
        </div>
        <span class="text-[9px] font-black px-2 py-1 rounded-full whitespace-nowrap ${dueClass}">${dueLabel}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3">
        <div><p class="text-[9px] uppercase text-gray-400 font-bold">Total</p><p class="text-[11px] font-black">${money(order.total)}</p></div>
        <div><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-[11px] font-black">${money(order.paid)}</p></div>
        <div><p class="text-[9px] uppercase text-gray-400 font-bold">Balance</p><p class="text-[11px] font-black text-red-600">${money(order.balance)}</p></div>
      </div>
    </div>`;
}

function paymentLine(payment) {
  const method = payment.method || payment.paymentMethod || 'Payment';
  return `
    <div class="flex justify-between gap-3 py-2 border-b border-gray-100 last:border-0">
      <div class="min-w-0">
        <p class="text-[10px] font-bold text-gray-700">${esc(method)}${payment.reference ? ` · ${esc(payment.reference)}` : ''}</p>
        <p class="text-[9px] text-gray-400">${esc(dateText(payment.createdAt))}${payment.note ? ` · ${esc(payment.note)}` : ''}</p>
      </div>
      <p class="text-[10px] font-black text-teal-600 whitespace-nowrap">${money(payment.amount)}</p>
    </div>`;
}

function renderLedger(customer) {
  const root = document.getElementById('receivablesLedger');
  if (!root) return;

  root.innerHTML = `
    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 p-5">
      <div class="flex justify-between items-start gap-3">
        <div>
          <p class="text-[10px] uppercase font-black text-gray-400">Customer Ledger</p>
          <h3 class="font-black text-lg mt-1">${esc(customer.name)}</h3>
          <p class="text-xs text-gray-400">${esc(customer.phone || 'No phone recorded')}</p>
        </div>
        <button type="button" id="closeLedger" class="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold">Close</button>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-4">
        <div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase text-gray-400 font-bold">Purchases</p><p class="text-sm font-black mt-1">${money(customer.total)}</p></div>
        <div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-sm font-black text-teal-600 mt-1">${money(customer.paid)}</p></div>
        <div class="bg-red-50 rounded-xl p-3"><p class="text-[9px] uppercase text-red-400 font-bold">Outstanding</p><p class="text-sm font-black text-red-600 mt-1">${money(customer.balance)}</p></div>
      </div>
      <div class="mt-4">
        <p class="text-xs font-black text-gray-700 mb-2">Outstanding orders</p>
        <div class="space-y-2">
          ${customer.orders.map(order => `
            <div class="border border-gray-100 rounded-xl p-3">
              ${orderLine(order)}
              <div class="mt-2 bg-white border border-gray-100 rounded-lg px-3">
                <p class="text-[9px] uppercase font-black text-gray-400 py-2">Payment history</p>
                ${order.payments.length ? order.payments.map(paymentLine).join('') : '<p class="text-[10px] text-gray-400 pb-2">No payments recorded for this order.</p>'}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  document.getElementById('closeLedger')?.addEventListener('click', () => {
    root.classList.add('hidden');
    root.innerHTML = '';
  });
}

function render(customers, queryText = '') {
  const root = document.getElementById('receivablesContent');
  if (!root) return;

  const needle = queryText.trim().toLowerCase();
  const filtered = customers.filter(c =>
    !needle || `${c.name} ${c.phone}`.toLowerCase().includes(needle)
  );

  const outstanding = customers.reduce((sum, c) => sum + c.balance, 0);
  const dueNow = customers.reduce((sum, c) => sum + c.dueNow, 0);
  const pending = customers.reduce((sum, c) => sum + c.pending, 0);
  const orderCount = customers.reduce((sum, c) => sum + c.orderCount, 0);

  root.innerHTML = `
    <div class="bg-white p-5 rounded-[24px] shadow-sm mb-5">
      <div class="flex justify-between items-start gap-3 mb-1">
        <div>
          <h2 class="font-black text-lg">Customer Receivables</h2>
          <p class="text-xs text-gray-400 mt-1">See who owes EazyLife, how much has been paid, and what is still outstanding.</p>
        </div>
        <button id="receivablesRefresh" type="button" class="bg-gray-100 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold">Refresh</button>
      </div>
      <div class="grid grid-cols-2 gap-3 mt-4">
        <div class="bg-gray-50 rounded-2xl p-4"><p class="text-[10px] uppercase text-gray-400 font-bold">Outstanding</p><p class="text-lg font-black text-red-600 mt-1">${money(outstanding)}</p></div>
        <div class="bg-gray-50 rounded-2xl p-4"><p class="text-[10px] uppercase text-gray-400 font-bold">Customers owing</p><p class="text-lg font-black mt-1">${customers.length}</p></div>
        <div class="bg-red-50 rounded-2xl p-4"><p class="text-[10px] uppercase text-red-400 font-bold">Due now</p><p class="text-lg font-black text-red-600 mt-1">${money(dueNow)}</p></div>
        <div class="bg-yellow-50 rounded-2xl p-4"><p class="text-[10px] uppercase text-yellow-600 font-bold">Pending collection</p><p class="text-lg font-black text-yellow-700 mt-1">${money(pending)}</p></div>
      </div>
      <div class="mt-3 text-[10px] text-gray-400">${orderCount} outstanding order${orderCount === 1 ? '' : 's'} across ${customers.length} customer${customers.length === 1 ? '' : 's'}.</div>
    </div>

    <div class="bg-white p-5 rounded-[24px] shadow-sm">
      <div class="flex gap-2 mb-4">
        <input id="receivablesSearch" value="${esc(queryText)}" placeholder="Search customer or phone..." class="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      </div>
      <div id="receivablesList" class="grid gap-3">
        ${filtered.map((c, index) => `
          <div class="border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div class="flex justify-between gap-3 items-start">
              <div class="min-w-0">
                <p class="font-black text-sm text-gray-800 truncate">${esc(c.name)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${esc(c.phone || 'No phone recorded')} · ${c.orderCount} outstanding order${c.orderCount === 1 ? '' : 's'}</p>
              </div>
              <div class="text-right shrink-0">
                <p class="font-black text-sm text-red-600">${money(c.balance)}</p>
                <p class="text-[9px] uppercase font-bold ${c.dueNow ? 'text-red-500' : 'text-yellow-600'}">${c.dueNow ? money(c.dueNow) + ' due' : 'pending collection'}</p>
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <button type="button" data-customer-toggle="${index}" class="flex-1 bg-gray-900 text-white text-[11px] font-bold py-2 rounded-lg">View orders</button>
              <button type="button" data-ledger="${index}" class="bg-[#00B09B] text-white text-[11px] font-bold px-4 rounded-lg">Ledger</button>
              <button type="button" data-go-orders class="bg-gray-100 text-gray-700 text-[11px] font-bold px-3 rounded-lg">Orders</button>
            </div>
            <div id="receivableOrders-${index}" class="hidden mt-3 pt-3 border-t border-gray-100 space-y-2">
              ${c.orders.map(orderLine).join('')}
            </div>
          </div>
        `).join('') || `<p class="text-center text-gray-400 text-sm py-10">No outstanding customer balances.</p>`}
      </div>
    </div>
    <div id="receivablesLedger" class="hidden mt-5"></div>`;

  document.getElementById('receivablesRefresh')?.addEventListener('click', () => refresh(queryText));
  document.getElementById('receivablesSearch')?.addEventListener('input', e => render(customers, e.target.value));
  document.querySelectorAll('[data-customer-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`receivableOrders-${btn.dataset.customerToggle}`).classList.toggle('hidden');
      btn.textContent = btn.textContent === 'View orders' ? 'Hide orders' : 'View orders';
    });
  });
  document.querySelectorAll('[data-ledger]').forEach(btn => {
    btn.addEventListener('click', () => {
      const customer = filtered[Number(btn.dataset.ledger)];
      if (!customer) return;
      const ledger = document.getElementById('receivablesLedger');
      ledger.classList.remove('hidden');
      renderLedger(customer);
      ledger.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  document.querySelectorAll('[data-go-orders]').forEach(btn => {
    btn.addEventListener('click', () => document.querySelector('[data-tab="orders"]')?.click());
  });
}

async function refresh(queryText = '') {
  const root = document.getElementById('receivablesContent');
  if (!root) return;
  root.innerHTML = '<div class="bg-white rounded-[24px] p-10 text-center text-sm text-gray-400">Loading receivables...</div>';
  try {
    const orders = await loadReceivables();
    render(aggregateCustomers(orders), queryText);
  } catch (err) {
    console.error('Receivables load failed:', err);
    root.innerHTML = `<div class="bg-white rounded-[24px] p-6 text-sm text-red-600">Could not load receivables: ${esc(err.message)}</div>`;
  }
}

export function initReceivables() {
  refresh();
  return () => {};
}
