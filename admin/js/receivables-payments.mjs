import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import {
  recordPayment, PAYMENT_METHODS
} from './payments.mjs';

const { db } = initFirebase();

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>\'\"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

async function getOutstandingOrders() {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const result = [];

  for (const docSnap of snap.docs) {
    const order = { id: docSnap.id, ...docSnap.data() };
    if (['cancelled', 'returned'].includes(String(order.status || '').toLowerCase())) continue;

    const paymentSnap = await getDocs(
      query(collection(db, 'orders', order.id, 'payments'), orderBy('createdAt', 'asc'))
    );
    const paid = paymentSnap.docs.reduce((sum, p) => sum + Math.max(0, Number(p.data().amount || 0)), 0);
    const total = Math.max(0, Number(order.total || 0));
    const balance = Math.max(0, total - paid);
    if (balance <= 0) continue;

    result.push({
      ...order,
      balance,
      paid,
      total
    });
  }

  return result;
}

function render(orders) {
  const old = document.getElementById('receivablesCollectionPanel');
  if (old) old.remove();

  const host = document.getElementById('receivablesContent');
  if (!host) return;

  const panel = document.createElement('div');
  panel.id = 'receivablesCollectionPanel';
  panel.className = 'bg-white p-5 rounded-[24px] shadow-sm mt-5';
  panel.innerHTML = `
    <div class="mb-4">
      <h2 class="font-black text-lg">Collect Payment</h2>
      <p class="text-xs text-gray-400 mt-1">Record a payment against the exact outstanding order. Payment status remains separate from delivery status.</p>
    </div>
    <div class="space-y-3">
      <select id="collectionOrder" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        <option value="">Select outstanding order...</option>
        ${orders.map(order => `
          <option value="${esc(order.id)}">
            ${esc(order.customerName || 'Unknown')} · ${esc(order.trackingCode || order.id)} · Balance ${money(order.balance)}
          </option>`).join('')}
      </select>
      <div id="collectionSummary" class="hidden bg-gray-50 rounded-xl p-3 text-xs"></div>
      <input id="collectionAmount" type="number" min="1" step="0.01" placeholder="Amount received (₦)" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <select id="collectionMethod" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        ${Object.entries(PAYMENT_METHODS).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
      </select>
      <input id="collectionReference" placeholder="Reference (optional)" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <input id="collectionNote" placeholder="Note (optional)" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <button id="collectionSave" type="button" class="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">Record Payment</button>
      <p id="collectionMessage" class="hidden text-xs font-bold text-center"></p>
    </div>`;

  host.parentElement?.appendChild(panel);

  const orderSelect = panel.querySelector('#collectionOrder');
  const summary = panel.querySelector('#collectionSummary');
  const amount = panel.querySelector('#collectionAmount');
  const message = panel.querySelector('#collectionMessage');
  const save = panel.querySelector('#collectionSave');

  orderSelect.addEventListener('change', () => {
    const order = orders.find(item => item.id === orderSelect.value);
    if (!order) {
      summary.classList.add('hidden');
      amount.value = '';
      return;
    }
    summary.classList.remove('hidden');
    summary.innerHTML = `
      <div class="grid grid-cols-3 gap-2">
        <div><span class="text-[9px] uppercase text-gray-400 font-bold">Order</span><p class="font-black mt-1">${esc(order.trackingCode || order.id)}</p></div>
        <div><span class="text-[9px] uppercase text-gray-400 font-bold">Total</span><p class="font-black mt-1">${money(order.total)}</p></div>
        <div><span class="text-[9px] uppercase text-gray-400 font-bold">Balance</span><p class="font-black text-red-600 mt-1">${money(order.balance)}</p></div>
      </div>`;
    amount.max = String(order.balance);
    amount.value = '';
  });

  save.addEventListener('click', async () => {
    const order = orders.find(item => item.id === orderSelect.value);
    if (!order) {
      message.textContent = 'Select an outstanding order first.';
      message.className = 'text-xs font-bold text-center text-red-600';
      return;
    }

    const value = Number(amount.value);
    if (!Number.isFinite(value) || value <= 0) {
      message.textContent = 'Enter a valid payment amount.';
      message.className = 'text-xs font-bold text-center text-red-600';
      return;
    }
    if (value > order.balance) {
      message.textContent = `Payment cannot exceed the balance of ${money(order.balance)}.`;
      message.className = 'text-xs font-bold text-center text-red-600';
      return;
    }

    save.disabled = true;
    save.textContent = 'Saving...';
    message.className = 'hidden text-xs font-bold text-center';

    try {
      await recordPayment(order.id, {
        amount: value,
        method: panel.querySelector('#collectionMethod').value,
        reference: panel.querySelector('#collectionReference').value,
        note: panel.querySelector('#collectionNote').value
      });

      const newBalance = Math.max(0, order.balance - value);
      message.textContent = `${money(value)} payment recorded successfully.`;
      message.className = 'text-xs font-bold text-center text-[#00B09B]';
      amount.value = '';
      panel.querySelector('#collectionReference').value = '';
      panel.querySelector('#collectionNote').value = '';

      // Refresh the Receivables dashboard immediately so totals/customer balances
      // reflect the payment without requiring a browser reload.
      document.getElementById('receivablesRefresh')?.click();

      if (newBalance <= 0) {
        orderSelect.querySelector(`option[value="${CSS.escape(order.id)}"]`)?.remove();
        orderSelect.value = '';
        summary.classList.add('hidden');
        amount.removeAttribute('max');
      } else {
        order.balance = newBalance;
        const option = orderSelect.querySelector(`option[value="${CSS.escape(order.id)}"]`);
        if (option) {
          option.textContent = `${order.customerName || 'Unknown'} · ${order.trackingCode || order.id} · Balance ${money(newBalance)}`;
        }
        summary.innerHTML = `
          <div class="grid grid-cols-3 gap-2">
            <div><span class="text-[9px] uppercase text-gray-400 font-bold">Order</span><p class="font-black mt-1">${esc(order.trackingCode || order.id)}</p></div>
            <div><span class="text-[9px] uppercase text-gray-400 font-bold">Total</span><p class="font-black mt-1">${money(order.total)}</p></div>
            <div><span class="text-[9px] uppercase text-gray-400 font-bold">Balance</span><p class="font-black text-red-600 mt-1">${money(newBalance)}</p></div>
          </div>`;
        amount.max = String(newBalance);
      }

      save.disabled = false;
      save.textContent = 'Record Payment';
    } catch (err) {
      console.error('Receivables payment failed:', err);
      message.textContent = err.message || 'Could not record payment.';
      message.className = 'text-xs font-bold text-center text-red-600';
      save.disabled = false;
      save.textContent = 'Record Payment';
    }
  });
}

async function load() {
  const host = document.getElementById('receivablesContent');
  if (!host) return;
  const existing = document.getElementById('receivablesCollectionPanel');
  if (existing) return;

  try {
    const orders = await getOutstandingOrders();
    render(orders);
  } catch (err) {
    console.error('Receivables collection load failed:', err);
  }
}

export function initReceivablesPayments() {
  load();
}

if (typeof document !== 'undefined') {
  const observer = new MutationObserver(() => {
    if (document.getElementById('receivablesContent') && !document.getElementById('receivablesCollectionPanel')) load();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
