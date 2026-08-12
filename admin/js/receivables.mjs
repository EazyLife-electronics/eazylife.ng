import { initFirebase } from '../../js/firebase.mjs';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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

function dateValue(timestamp) {
  if (!timestamp) return null;
  if (timestamp.toDate) return timestamp.toDate();
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateText(timestamp) {
  const date = dateValue(timestamp);
  return date ? date.toLocaleString() : '';
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
  const snap = await getDocs(query(
    collection(db, 'orders', orderId, 'payments'),
    orderBy('createdAt', 'desc')
  ));
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

    orders.push({ ...order, total, paid, balance, dueNow: isDueNow(order, balance), payments });
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

async function loadCustomerStatement(customer) {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'asc')));
  const orders = [];

  for (const docSnap of snap.docs) {
    const order = { id: docSnap.id, ...docSnap.data() };
    if (isExcluded(order) || customerKey(order) !== customer.key) continue;

    const payments = await loadOrderPayments(order.id);
    const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const legacyPaid = Number(order.paidAmount || 0);
    const paid = payments.length ? paymentTotal : legacyPaid;
    const total = Number(order.total || 0);

    orders.push({ ...order, total, paid, balance: Math.max(0, total - paid), payments });
  }

  const entries = [];
  for (const order of orders) {
    entries.push({
      type: 'order',
      date: dateValue(order.createdAt) || new Date(0),
      order,
      amount: order.total,
      sort: 0
    });
    for (const payment of order.payments) {
      entries.push({
        type: 'payment',
        date: dateValue(payment.createdAt) || dateValue(order.createdAt) || new Date(0),
        order,
        payment,
        amount: Number(payment.amount || 0),
        sort: 1
      });
    }
  }

  entries.sort((a, b) => {
    const timeDiff = a.date.getTime() - b.date.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.sort - b.sort;
  });

  let runningBalance = 0;
  for (const entry of entries) {
    if (entry.type === 'order') runningBalance += entry.amount;
    else runningBalance = Math.max(0, runningBalance - entry.amount);
    entry.runningBalance = runningBalance;
  }

  const totalPurchases = orders.reduce((sum, order) => sum + order.total, 0);
  const totalPaid = orders.reduce((sum, order) => sum + order.paid, 0);
  const outstanding = Math.max(0, totalPurchases - totalPaid);
  return { orders, entries, totalPurchases, totalPaid, outstanding };
}

function statementEntryLine(entry) {
  const isOrder = entry.type === 'order';
  const code = entry.order.trackingCode || entry.order.id;
  const label = isOrder
    ? `Order ${code}`
    : `Payment · ${entry.payment.method || entry.payment.paymentMethod || 'Payment'}`;
  const detail = isOrder
    ? `${(entry.order.items || []).map(item => `${esc(item.name)} × ${Number(item.quantity || 0)}`).join(', ') || 'Order'} · ${esc(TERMS[entry.order.paymentTerms] || entry.order.paymentTerms || 'Pay on Delivery')}`
    : `${esc(code)}${entry.payment.reference ? ` · Ref: ${esc(entry.payment.reference)}` : ''}${entry.payment.note ? ` · ${esc(entry.payment.note)}` : ''}`;

  return `
    <div class="grid grid-cols-[70px_1fr_auto] gap-2 items-start py-3 border-b border-gray-100 last:border-0">
      <div class="text-[9px] text-gray-400 leading-tight">${esc(entry.date.toLocaleDateString())}<br>${esc(entry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</div>
      <div class="min-w-0">
        <p class="text-[10px] font-black ${isOrder ? 'text-gray-800' : 'text-teal-600'}">${label}</p>
        <p class="text-[9px] text-gray-400 mt-0.5">${detail}</p>
      </div>
      <div class="text-right whitespace-nowrap">
        <p class="text-[10px] font-black ${isOrder ? 'text-gray-800' : 'text-teal-600'}">${isOrder ? '+' : '-'}${money(entry.amount)}</p>
        <p class="text-[9px] text-gray-400 mt-0.5">Bal ${money(entry.runningBalance)}</p>
      </div>
    </div>`;
}

function printStatement(customer, statement) {
  const oldSheet = document.getElementById('eazylifePrintSheet');
  if (oldSheet) oldSheet.remove();

  const sheet = document.createElement('section');
  sheet.id = 'eazylifePrintSheet';
  sheet.innerHTML = `
    <div class="print-header">
      <h1>EazyLife Customer Statement</h1>
      <p><strong>${esc(customer.name)}</strong></p>
      <p class="print-muted">${esc(customer.phone || 'No phone recorded')}</p>
      <p class="print-muted">Generated ${esc(new Date().toLocaleString())}</p>
    </div>
    <div class="print-summary">
      <div><span>Purchases</span><strong>${money(statement.totalPurchases)}</strong></div>
      <div><span>Payments</span><strong class="print-green">${money(statement.totalPaid)}</strong></div>
      <div><span>Balance</span><strong class="print-red">${money(statement.outstanding)}</strong></div>
    </div>
    <h2>Account Activity</h2>
    <div class="print-rows">
      ${statement.entries.map(entry => {
        const isOrder = entry.type === 'order';
        const code = entry.order.trackingCode || entry.order.id;
        const method = entry.payment?.method || entry.payment?.paymentMethod || 'Payment';
        const detail = isOrder
          ? `${(entry.order.items || []).map(item => `${esc(item.name)} × ${Number(item.quantity || 0)}`).join(', ') || 'Order'} · ${esc(TERMS[entry.order.paymentTerms] || entry.order.paymentTerms || 'Pay on Delivery')}`
          : `${esc(code)}${entry.payment.reference ? ` · Ref: ${esc(entry.payment.reference)}` : ''}${entry.payment.note ? ` · ${esc(entry.payment.note)}` : ''}`;
        return `<div class="print-row">
          <div class="print-date">${esc(entry.date.toLocaleString())}</div>
          <div><strong>${isOrder ? 'Order' : 'Payment · ' + esc(method)}</strong><div class="print-muted">${detail}</div></div>
          <div class="print-amount ${isOrder ? '' : 'print-green'}">${isOrder ? '+' : '-'}${money(entry.amount)}<small>Balance ${money(entry.runningBalance)}</small></div>
        </div>`;
      }).join('')}
    </div>
    <div class="print-total"><span>Current Balance</span><strong>${money(statement.outstanding)}</strong></div>`;

  const style = document.createElement('style');
  style.id = 'eazylifePrintStyle';
  style.textContent = `
    #eazylifePrintSheet { display:none; }
    @media print {
      @page { size:auto; margin:12mm; }
      body > * { display:none !important; }
      #eazylifePrintSheet { display:block !important; font-family:Arial,sans-serif; color:#111; background:#fff; padding:4px; }
      #eazylifePrintSheet h1 { font-size:22px; margin:0 0 6px; }
      #eazylifePrintSheet h2 { font-size:15px; margin:20px 0 8px; }
      #eazylifePrintSheet p { margin:3px 0; font-size:12px; }
      .print-muted { color:#666; font-size:11px; }
      .print-summary { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin:18px 0; }
      .print-summary > div { border:1px solid #ddd; border-radius:7px; padding:10px; }
      .print-summary span { display:block; font-size:9px; color:#777; text-transform:uppercase; font-weight:bold; }
      .print-summary strong { display:block; font-size:14px; margin-top:4px; }
      .print-green { color:#008f7a !important; }
      .print-red { color:#c62828 !important; }
      .print-rows { border:1px solid #ddd; border-radius:7px; padding:0 10px; }
      .print-row { display:grid; grid-template-columns:105px 1fr 125px; gap:10px; padding:10px 0; border-bottom:1px solid #eee; break-inside:avoid; }
      .print-row:last-child { border-bottom:0; }
      .print-date,.print-muted { color:#666; font-size:10px; }
      .print-amount { text-align:right; font-weight:bold; font-size:11px; }
      .print-amount small { display:block; color:#666; font-weight:normal; font-size:9px; margin-top:3px; }
      .print-total { display:flex; justify-content:space-between; margin-top:18px; padding:12px; background:#f3f4f6; border-radius:7px; font-size:13px; font-weight:bold; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(sheet);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    sheet.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup, { once: true });

  try {
    window.print();
  } catch (err) {
    cleanup();
    console.error('Print failed:', err);
    alert(`Could not open print preview: ${err.message}`);
  }
}

function renderStatement(root, customer, statement) {
  const existing = document.getElementById('receivablesStatement');
  if (existing) existing.remove();

  const wrapper = document.createElement('div');
  wrapper.id = 'receivablesStatement';
  wrapper.className = 'mt-5';
  wrapper.innerHTML = `
    <div class="bg-white rounded-[24px] shadow-sm border border-gray-100 p-5">
      <div class="flex justify-between items-start gap-3">
        <div>
          <p class="text-[10px] uppercase font-black text-gray-400">Customer Statement</p>
          <h3 class="font-black text-lg mt-1">${esc(customer.name)}</h3>
          <p class="text-xs text-gray-400">${esc(customer.phone || 'No phone recorded')} · All non-cancelled transactions</p>
        </div>
        <button type="button" id="closeStatement" class="bg-gray-100 text-gray-600 px-3 py-2 rounded-xl text-xs font-bold">Close</button>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-4">
        <div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase text-gray-400 font-bold">Purchases</p><p class="text-sm font-black mt-1">${money(statement.totalPurchases)}</p></div>
        <div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase text-gray-400 font-bold">Payments</p><p class="text-sm font-black text-teal-600 mt-1">${money(statement.totalPaid)}</p></div>
        <div class="bg-red-50 rounded-xl p-3"><p class="text-[9px] uppercase text-red-400 font-bold">Balance</p><p class="text-sm font-black text-red-600 mt-1">${money(statement.outstanding)}</p></div>
      </div>
      <div class="mt-4 flex justify-between items-center gap-3">
        <p class="text-xs font-black text-gray-700">Account activity</p>
        <span class="text-[9px] font-bold text-gray-400">${statement.entries.length} transaction${statement.entries.length === 1 ? '' : 's'}</span>
      </div>
      <div class="mt-2 bg-gray-50 rounded-xl border border-gray-100 px-3">
        ${statement.entries.length ? statement.entries.map(statementEntryLine).join('') : '<p class="text-xs text-gray-400 py-5 text-center">No transactions found.</p>'}
      </div>
      <div class="mt-4 bg-gray-900 text-white rounded-xl p-4 flex justify-between items-center gap-3">
        <div>
          <p class="text-[9px] uppercase font-bold text-gray-400">Current balance</p>
          <p class="text-lg font-black mt-1">${money(statement.outstanding)}</p>
        </div>
        <button type="button" id="printStatement" class="bg-white text-gray-900 px-4 py-2 rounded-lg text-[11px] font-black">Print</button>
      </div>
    </div>`;

  root.appendChild(wrapper);
  document.getElementById('closeStatement')?.addEventListener('click', () => wrapper.remove());
  document.getElementById('printStatement')?.addEventListener('click', () => printStatement(customer, statement));
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
        <div class="flex justify-between items-center gap-3 mb-2">
          <p class="text-xs font-black text-gray-700">Outstanding orders</p>
          <button type="button" id="openStatementFromLedger" class="bg-gray-900 text-white px-3 py-2 rounded-lg text-[10px] font-bold">Statement</button>
        </div>
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

  document.getElementById('openStatementFromLedger')?.addEventListener('click', async () => {
    const button = document.getElementById('openStatementFromLedger');
    if (!button) return;
    button.disabled = true;
    button.textContent = 'Loading...';
    try {
      const statement = await loadCustomerStatement(customer);
      renderStatement(root, customer, statement);
      document.getElementById('receivablesStatement')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      console.error('Customer statement failed:', err);
      button.disabled = false;
      button.textContent = 'Statement';
      alert(`Could not load customer statement: ${err.message}`);
    }
  });
}

function render(customers, queryText = '') {
  const root = document.getElementById('receivablesContent');
  if (!root) return;

  const needle = queryText.trim().toLowerCase();
  const filtered = customers.filter(c => !needle || `${c.name} ${c.phone}`.toLowerCase().includes(needle));
  const outstanding = customers.reduce((sum, c) => sum + c.balance, 0);
  const dueNow = customers.reduce((sum, c) => sum + c.dueNow, 0);
  const pending = customers.reduce((sum, c) => sum + c.pending, 0);
  const orderCount = customers.reduce((sum, c) => sum + c.orderCount, 0);

  root.innerHTML = `
    <div class="bg-white p-5 rounded-[24px] shadow-sm mb-5">
      <div class="flex justify-between items-start gap-3 mb-1">
        <div><h2 class="font-black text-lg">Customer Receivables</h2><p class="text-xs text-gray-400 mt-1">See who owes EazyLife, how much has been paid, and what is still outstanding.</p></div>
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
      <div class="flex gap-2 mb-4"><input id="receivablesSearch" value="${esc(queryText)}" placeholder="Search customer or phone..." class="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none"></div>
      <div id="receivablesList" class="grid gap-3">
        ${filtered.map((c, index) => `
          <div class="border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div class="flex justify-between gap-3 items-start">
              <div class="min-w-0"><p class="font-black text-sm text-gray-800 truncate">${esc(c.name)}</p><p class="text-xs text-gray-400 mt-0.5">${esc(c.phone || 'No phone recorded')} · ${c.orderCount} outstanding order${c.orderCount === 1 ? '' : 's'}</p></div>
              <div class="text-right shrink-0"><p class="font-black text-sm text-red-600">${money(c.balance)}</p><p class="text-[9px] uppercase font-bold ${c.dueNow ? 'text-red-500' : 'text-yellow-600'}">${c.dueNow ? money(c.dueNow) + ' due' : 'pending collection'}</p></div>
            </div>
            <div class="flex gap-2 mt-3">
              <button type="button" data-customer-toggle="${index}" class="flex-1 bg-gray-900 text-white text-[11px] font-bold py-2 rounded-lg">View orders</button>
              <button type="button" data-ledger="${index}" class="bg-[#00B09B] text-white text-[11px] font-bold px-4 rounded-lg">Ledger</button>
              <button type="button" data-go-orders class="bg-gray-100 text-gray-700 text-[11px] font-bold px-3 rounded-lg">Orders</button>
            </div>
            <div id="receivableOrders-${index}" class="hidden mt-3 pt-3 border-t border-gray-100 space-y-2">${c.orders.map(orderLine).join('')}</div>
          </div>`).join('') || '<p class="text-center text-gray-400 text-sm py-10">No outstanding customer balances.</p>'}
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
