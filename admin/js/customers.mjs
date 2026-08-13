import { initFirebase } from '../../js/firebase.mjs';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const { auth, db } = initFirebase();
const $ = id => document.getElementById(id);
const money = value => `₦${Number(value || 0).toLocaleString()}`;
const esc = value => String(value ?? '').replace(/[&<>\'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const dateValue = value => {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dateText = value => { const d = dateValue(value); return d ? d.toLocaleString() : ''; };
const phoneDigits = value => String(value || '').replace(/\D/g, '');
const customerKey = order => {
  const phone = phoneDigits(order.phone);
  return phone ? `phone:${phone}` : `name:${String(order.customerName || 'Unknown').trim().toLowerCase()}`;
};
const excluded = order => ['cancelled','returned'].includes(String(order.status || '').toLowerCase());

let allCustomers = [];
let selectedCustomer = null;
let range = { from:'', to:'' };

async function loadPayments(orderId) {
  const snap = await getDocs(query(collection(db, 'orders', orderId, 'payments'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

function parseDate(value, end=false) {
  if (!value) return null;
  const d = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function inRange(date) {
  const d = dateValue(date);
  if (!d) return false;
  const from = parseDate(range.from);
  const to = parseDate(range.to, true);
  return (!from || d >= from) && (!to || d <= to);
}

async function loadCustomers() {
  $('status').textContent = 'Loading customer accounts...';
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const map = new Map();

  for (const docSnap of snap.docs) {
    const raw = { id:docSnap.id, ...docSnap.data() };
    const key = customerKey(raw);
    let customer = map.get(key);
    if (!customer) {
      customer = { key, name:raw.customerName || 'Unknown', phone:raw.phone || '', address:raw.address || raw.deliveryAddress || '', orders:[] };
      map.set(key, customer);
    }
    customer.name = customer.name === 'Unknown' && raw.customerName ? raw.customerName : customer.name;
    customer.phone = customer.phone || raw.phone || '';
    customer.address = customer.address || raw.address || raw.deliveryAddress || '';

    const payments = await loadPayments(raw.id);
    const paymentTotal = payments.reduce((sum,p) => sum + Number(p.amount || 0), 0);
    const legacyPaid = Number(raw.paidAmount || 0);
    const paid = payments.length ? paymentTotal : legacyPaid;
    const total = Number(raw.total || 0);
    const active = !excluded(raw);
    customer.orders.push({ ...raw, total, paid, balance:Math.max(0,total-paid), payments, active });
  }

  allCustomers = [...map.values()].map(c => {
    const activeOrders = c.orders.filter(o => o.active);
    const filtered = activeOrders.filter(o => inRange(o.createdAt));
    const basis = range.from || range.to ? filtered : activeOrders;
    c.metrics = {
      orderCount:basis.length,
      purchases:basis.reduce((s,o)=>s+o.total,0),
      paid:basis.reduce((s,o)=>s+o.paid,0),
      balance:basis.reduce((s,o)=>s+o.balance,0),
      lastOrder:c.orders.filter(o=>o.active).sort((a,b)=>(dateValue(b.createdAt)?.getTime()||0)-(dateValue(a.createdAt)?.getTime()||0))[0] || null
    };
    return c;
  }).sort((a,b)=>b.metrics.balance-a.metrics.balance || b.metrics.purchases-a.metrics.purchases);

  render();
}

function render() {
  const term = $('search').value.trim().toLowerCase();
  const customers = allCustomers.filter(c => !term || c.name.toLowerCase().includes(term) || phoneDigits(c.phone).includes(phoneDigits(term)) || c.phone.toLowerCase().includes(term));
  $('statCustomers').textContent = customers.length;
  $('statPurchases').textContent = money(customers.reduce((s,c)=>s+c.metrics.purchases,0));
  $('statPaid').textContent = money(customers.reduce((s,c)=>s+c.metrics.paid,0));
  $('statBalance').textContent = money(customers.reduce((s,c)=>s+c.metrics.balance,0));
  $('status').textContent = `${customers.length} customer${customers.length===1?'':'s'} found${range.from||range.to ? ` · ${range.from||'Beginning'} → ${range.to||'Today'}` : ''}`;
  $('customerList').innerHTML = customers.length ? customers.map(customerCard).join('') : `<div class="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">No customers found.</div>`;
  $('customerList').querySelectorAll('[data-customer]').forEach(btn => btn.addEventListener('click', () => openProfile(btn.dataset.customer)));
}

function customerCard(customer) {
  const m = customer.metrics;
  const wa = phoneDigits(customer.phone);
  return `<article class="bg-white rounded-[24px] shadow-sm border border-gray-100 p-5">
    <div class="flex justify-between gap-3 items-start">
      <div class="min-w-0"><h2 class="font-black text-base truncate">${esc(customer.name)}</h2><p class="text-xs text-gray-400 mt-1">${esc(customer.phone || 'No phone recorded')} · ${m.orderCount} active order${m.orderCount===1?'':'s'}</p>${customer.address ? `<p class="text-[10px] text-gray-400 mt-1 truncate">${esc(customer.address)}</p>` : ''}</div>
      <div class="text-right"><p class="text-lg font-black text-red-600">${money(m.balance)}</p><p class="text-[9px] font-black text-red-400 uppercase">Outstanding</p></div>
    </div>
    <div class="grid grid-cols-3 gap-2 mt-4"><div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase font-bold text-gray-400">Purchases</p><p class="text-xs font-black mt-1">${money(m.purchases)}</p></div><div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase font-bold text-gray-400">Paid</p><p class="text-xs font-black text-[#00B09B] mt-1">${money(m.paid)}</p></div><div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] uppercase font-bold text-gray-400">Orders</p><p class="text-xs font-black mt-1">${m.orderCount}</p></div></div>
    <div class="flex gap-2 mt-4"><button data-customer="${esc(customer.key)}" class="flex-1 bg-gray-900 text-white py-2.5 rounded-xl text-xs font-bold">View profile</button>${customer.phone ? `<a href="tel:${esc(customer.phone)}" class="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fas fa-phone"></i></a>${wa ? `<a target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}" class="bg-green-100 text-green-700 px-4 py-2.5 rounded-xl text-xs font-bold"><i class="fab fa-whatsapp"></i></a>` : ''}` : ''}</div>
  </article>`;
}

function openProfile(key) {
  const customer = allCustomers.find(c => c.key === key);
  if (!customer) return;
  selectedCustomer = customer;
  const orders = customer.orders.filter(o => o.active).sort((a,b)=>(dateValue(b.createdAt)?.getTime()||0)-(dateValue(a.createdAt)?.getTime()||0));
  const m = customer.metrics;
  const profile = $('profile');
  profile.classList.remove('hidden');
  profile.innerHTML = `<div class="bg-white rounded-[28px] shadow-sm border border-gray-100 p-5">
    <div class="flex justify-between items-start gap-3"><div><p class="text-[10px] uppercase font-black text-gray-400">Customer profile</p><h2 class="font-black text-xl mt-1">${esc(customer.name)}</h2><p class="text-xs text-gray-400">${esc(customer.phone || 'No phone recorded')}</p>${customer.address ? `<p class="text-xs text-gray-400 mt-1">${esc(customer.address)}</p>`:''}</div><button id="closeProfile" class="bg-gray-100 text-gray-500 px-4 py-2 rounded-xl text-xs font-bold">Close</button></div>
    <div class="grid grid-cols-3 gap-2 mt-5"><div><p class="text-[9px] uppercase text-gray-400 font-bold">Purchases</p><p class="text-sm font-black">${money(m.purchases)}</p></div><div><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-sm font-black text-[#00B09B]">${money(m.paid)}</p></div><div><p class="text-[9px] uppercase text-gray-400 font-bold">Outstanding</p><p class="text-sm font-black text-red-600">${money(m.balance)}</p></div></div>
    <div class="flex gap-2 mt-5">${customer.phone ? `<a href="tel:${esc(customer.phone)}" class="flex-1 text-center bg-gray-900 text-white py-2.5 rounded-xl text-xs font-bold"><i class="fas fa-phone"></i> Call</a><a target="_blank" rel="noopener" href="https://wa.me/${esc(phoneDigits(customer.phone))}" class="flex-1 text-center bg-green-600 text-white py-2.5 rounded-xl text-xs font-bold"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}<button id="printCustomer" class="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-xs font-bold"><i class="fas fa-print"></i> Statement</button></div>
    <h3 class="font-black text-base mt-6 mb-3">Purchase history</h3>
    <div class="grid gap-3">${orders.length ? orders.map(orderCard).join('') : '<p class="text-sm text-gray-400">No active orders.</p>'}</div>
  </div>`;
  $('closeProfile').addEventListener('click', () => { profile.classList.add('hidden'); selectedCustomer=null; });
  $('printCustomer').addEventListener('click', () => printStatement(customer, orders));
  profile.scrollIntoView({ behavior:'smooth', block:'start' });
}

function orderCard(order) {
  const items = (order.items || []).map(i=>`${esc(i.name)} × ${Number(i.quantity||0)}`).join(', ') || 'Order items';
  const status = String(order.status || 'new').toUpperCase();
  const balanceClass = order.balance > 0 ? 'text-red-600' : 'text-[#00B09B]';
  return `<div class="border border-gray-100 bg-gray-50 rounded-2xl p-4"><div class="flex justify-between gap-3"><div><p class="text-xs font-black">${esc(order.trackingCode || order.id)}</p><p class="text-[10px] text-gray-500 mt-1">${items}</p><p class="text-[10px] text-gray-400 mt-1">${esc(order.paymentTerms || 'Pay on Delivery')} · ${esc(dateText(order.createdAt))}</p></div><span class="text-[9px] font-black bg-white px-2 py-1 rounded-full">${esc(status)}</span></div><div class="grid grid-cols-3 gap-2 mt-3"><div><p class="text-[9px] uppercase text-gray-400 font-bold">Total</p><p class="text-xs font-black">${money(order.total)}</p></div><div><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-xs font-black text-[#00B09B]">${money(order.paid)}</p></div><div><p class="text-[9px] uppercase text-gray-400 font-bold">Balance</p><p class="text-xs font-black ${balanceClass}">${money(order.balance)}</p></div></div></div>`;
}

function printStatement(customer, orders) {
  const old = document.getElementById('customerPrintSheet');
  old?.remove();
  const sheet = document.createElement('section');
  sheet.id = 'customerPrintSheet';
  sheet.innerHTML = `<h1>EazyLife Customer Statement</h1><p><strong>${esc(customer.name)}</strong></p><p>${esc(customer.phone || 'No phone recorded')}</p><p>Generated ${esc(new Date().toLocaleString())}</p><hr><h2>Account Summary</h2><p>Purchases: ${money(customer.metrics.purchases)}</p><p>Paid: ${money(customer.metrics.paid)}</p><p>Outstanding: ${money(customer.metrics.balance)}</p><h2>Orders</h2>${orders.map(o=>`<div class="print-order"><strong>${esc(o.trackingCode || o.id)}</strong> · ${esc(dateText(o.createdAt))}<br>${(o.items||[]).map(i=>`${esc(i.name)} × ${Number(i.quantity||0)}`).join(', ')}<br>Total ${money(o.total)} · Paid ${money(o.paid)} · Balance ${money(o.balance)}</div>`).join('')}`;
  const style = document.createElement('style');
  style.id='customerPrintStyle';
  style.textContent=`#customerPrintSheet{display:none}@media print{body>*{display:none!important}#customerPrintSheet{display:block!important;font-family:Arial;padding:20px;color:#111}#customerPrintSheet h1{font-size:24px}#customerPrintSheet h2{font-size:15px;margin-top:20px}.print-order{padding:10px 0;border-bottom:1px solid #ddd;font-size:11px;line-height:1.6}}`;
  document.head.appendChild(style); document.body.appendChild(sheet);
  const cleanup=()=>{sheet.remove();style.remove();window.removeEventListener('afterprint',cleanup)};
  window.addEventListener('afterprint',cleanup,{once:true});
  window.print();
}

$('search').addEventListener('input', render);
$('applyDates').addEventListener('click', () => { range={from:$('from').value,to:$('to').value}; if(range.from && range.to && range.from>range.to){ alert('The From date cannot be after the To date.'); return; } render(); });
$('refresh').addEventListener('click', () => loadCustomers().catch(showError));

function showError(err) {
  console.error(err);
  $('status').textContent = `Could not load customers: ${err.message || err}`;
  $('status').className = 'text-xs text-red-500 mb-3 px-1 font-bold';
}

onAuthStateChanged(auth, user => {
  if (!user) {
    $('status').textContent='Please log in from the Admin page first.';
    return;
  }
  loadCustomers().catch(showError);
});
