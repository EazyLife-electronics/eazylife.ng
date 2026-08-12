// admin/js/inventory-reports.mjs
// Read-only inventory valuation plus date-filtered sales/profit reporting.
import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, onSnapshot, getDocs, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const { db } = initFirebase();

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function variantLabel(v, index) {
  const bits = [v?.processor, v?.ram, v?.rom, v?.color].filter(Boolean);
  return bits.length ? bits.join(' / ') : `Variant ${index + 1}`;
}

function flatten(products) {
  const rows = [];
  products.forEach(p => (p.variants || []).forEach((v, index) => {
    const qty = Math.max(0, Number(v.stockQty || 0));
    const cost = Math.max(0, Number(v.costPrice || 0));
    rows.push({
      productId: p.id,
      productName: p.name || 'Unnamed product',
      brand: p.brand || '',
      category: p.category || 'Uncategorised',
      variantId: v.id || `${p.id}-${index}`,
      variant: variantLabel(v, index),
      sku: v.sku || '',
      qty,
      cost,
      value: qty * cost,
      reorder: Math.max(0, Number(v.reorderLevel ?? 2))
    });
  }));
  return rows;
}

function timestampDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

function startOfDay(value) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(value) {
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isExcluded(order) {
  return ['cancelled', 'returned'].includes(String(order.status || '').toLowerCase());
}

async function loadOrderPayments(orderId) {
  try {
    const snap = await getDocs(query(collection(db, 'orders', orderId, 'payments'), orderBy('createdAt', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`Could not load payments for ${orderId}:`, err);
    return [];
  }
}

function buildCostIndex(products) {
  const index = new Map();
  products.forEach(p => (p.variants || []).forEach((v, i) => {
    const key = `${p.id}::${v.id || `${p.id}-${i}`}`;
    index.set(key, {
      productName: p.name || 'Unnamed product',
      category: p.category || 'Uncategorised',
      variant: variantLabel(v, i),
      cost: Math.max(0, Number(v.costPrice || 0))
    });
  }));
  return index;
}

function renderInventory(panel, products, search = '') {
  const all = flatten(products);
  const term = search.trim().toLowerCase();
  const rows = term ? all.filter(r => `${r.productName} ${r.brand} ${r.category} ${r.variant} ${r.sku}`.toLowerCase().includes(term)) : all;

  const totalUnits = all.reduce((s, r) => s + r.qty, 0);
  const totalValue = all.reduce((s, r) => s + r.value, 0);
  const low = all.filter(r => r.qty > 0 && r.qty <= r.reorder).length;
  const out = all.filter(r => r.qty <= 0).length;

  const categories = {};
  all.forEach(r => {
    if (!categories[r.category]) categories[r.category] = { units: 0, value: 0, variants: 0 };
    categories[r.category].units += r.qty;
    categories[r.category].value += r.value;
    categories[r.category].variants += 1;
  });

  const categoryRows = Object.entries(categories).sort((a, b) => b[1].value - a[1].value);
  const productGroups = {};
  all.forEach(r => {
    if (!productGroups[r.productId]) productGroups[r.productId] = { name: r.productName, category: r.category, units: 0, value: 0, variants: 0 };
    productGroups[r.productId].units += r.qty;
    productGroups[r.productId].value += r.value;
    productGroups[r.productId].variants += 1;
  });
  const productRows = Object.values(productGroups).sort((a, b) => b.value - a.value);

  panel.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
      <div><h2 class="font-black text-xl">Reports</h2><p class="text-xs text-gray-400">Inventory position and business performance.</p></div>
      <div class="flex gap-2"><button id="inventoryReportMode" class="bg-gray-900 text-white px-4 py-2 rounded-xl text-xs font-bold">Inventory</button><button id="salesReportMode" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold">Sales & Profit</button></div>
    </div>
    <div class="flex flex-col md:flex-row gap-2 mb-5"><input id="reportSearch" value="${esc(search)}" placeholder="Search product / SKU..." class="w-full md:w-72 p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none"></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Inventory value</p><p class="text-xl md:text-2xl font-black mt-1">${money(totalValue)}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Units in stock</p><p class="text-xl md:text-2xl font-black mt-1">${totalUnits.toLocaleString()}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Low stock</p><p class="text-xl md:text-2xl font-black mt-1 text-orange-500">${low}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Out of stock</p><p class="text-xl md:text-2xl font-black mt-1 text-red-500">${out}</p></div>
    </div>
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5"><h3 class="font-black text-base mb-3">Valuation by Category</h3><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="text-[10px] uppercase text-gray-400 border-b"><th class="py-2">Category</th><th class="py-2">Variants</th><th class="py-2">Units</th><th class="py-2 text-right">Value</th></tr></thead><tbody>${categoryRows.map(([name, x]) => `<tr class="border-b last:border-0"><td class="py-3 font-bold">${esc(name)}</td><td class="py-3">${x.variants}</td><td class="py-3">${x.units.toLocaleString()}</td><td class="py-3 text-right font-bold">${money(x.value)}</td></tr>`).join('') || '<tr><td colspan="4" class="py-4 text-center text-gray-400">No inventory data.</td></tr>'}</tbody></table></div></div>
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5"><h3 class="font-black text-base mb-3">Valuation by Product</h3><div class="space-y-2">${productRows.map(x => `<div class="flex items-center gap-3 border-b border-gray-50 last:border-0 py-3"><div class="min-w-0 flex-grow"><p class="text-xs font-bold truncate">${esc(x.name)}</p><p class="text-[10px] text-gray-400">${esc(x.category)} · ${x.variants} variant${x.variants === 1 ? '' : 's'} · ${x.units.toLocaleString()} units</p></div><span class="text-xs font-black whitespace-nowrap">${money(x.value)}</span></div>`).join('') || '<p class="text-xs text-gray-400 py-4">No inventory data.</p>'}</div></div>
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><div class="flex items-center justify-between gap-2 mb-3"><div><h3 class="font-black text-base">Variant Valuation</h3><p class="text-[10px] text-gray-400">${term ? `${rows.length} matching variants` : `${rows.length} variants`}</p></div></div><div class="space-y-2">${rows.map(r => `<div class="border border-gray-100 rounded-xl p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-xs font-bold truncate">${esc(r.productName)}</p><p class="text-[10px] text-gray-400">${esc(r.variant)}${r.sku ? ` · ${esc(r.sku)}` : ''}</p></div><span class="text-xs font-black whitespace-nowrap">${money(r.value)}</span></div><div class="flex justify-between mt-2 text-[10px] text-gray-400"><span>${r.qty.toLocaleString()} units × ${money(r.cost)}</span><span>${r.qty <= 0 ? 'OUT' : r.qty <= r.reorder ? 'LOW' : 'OK'}</span></div></div>`).join('') || '<p class="text-xs text-gray-400 py-4 text-center">No matching variants.</p>'}</div></div>`;

  document.getElementById('reportSearch')?.addEventListener('input', e => {
    renderInventory(panel, products, e.target.value);
    const input = document.getElementById('reportSearch');
    if (input) { input.focus(); input.setSelectionRange(e.target.value.length, e.target.value.length); }
  });
  document.getElementById('salesReportMode')?.addEventListener('click', () => renderSales(panel, products));
}

async function buildSalesData(orders, products, from, to) {
  const costIndex = buildCostIndex(products);
  const sales = [];

  for (const order of orders) {
    if (isExcluded(order)) continue;
    const date = timestampDate(order.createdAt);
    if (!date || (from && date < from) || (to && date > to)) continue;

    const payments = await loadOrderPayments(order.id);
    const paymentTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const paid = payments.length ? paymentTotal : Number(order.paidAmount || 0);
    const total = Number(order.total || 0);

    let cogs = 0;
    let knownCostLines = 0;
    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      const qty = Math.max(0, Number(item.quantity || 0));
      const key = `${item.productId}::${item.variantId}`;
      const costInfo = costIndex.get(key);
      if (costInfo) {
        cogs += qty * costInfo.cost;
        if (costInfo.cost > 0) knownCostLines += 1;
      }
    }

    sales.push({
      ...order,
      date,
      total,
      paid,
      balance: Math.max(0, total - paid),
      cogs,
      grossProfit: total - cogs,
      knownCostLines
    });
  }

  return sales.sort((a, b) => b.date - a.date);
}

async function renderSales(panel, products, initialFrom = '', initialTo = '') {
  panel.innerHTML = `<div class="bg-white rounded-[24px] p-8 text-center shadow-sm"><p class="text-sm font-bold">Loading sales report...</p><p class="text-xs text-gray-400 mt-1">Calculating payments and product costs.</p></div>`;

  const ordersSnap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const dates = orders.map(o => timestampDate(o.createdAt)).filter(Boolean).sort((a, b) => a - b);
  const defaultFrom = initialFrom || (dates[0] ? dateKey(dates[0]) : dateKey(new Date()));
  const defaultTo = initialTo || dateKey(new Date());
  const fromDate = startOfDay(defaultFrom);
  const toDate = endOfDay(defaultTo);
  const sales = await buildSalesData(orders, products, fromDate, toDate);

  const revenue = sales.reduce((s, o) => s + o.total, 0);
  const collected = sales.reduce((s, o) => s + o.paid, 0);
  const outstanding = sales.reduce((s, o) => s + o.balance, 0);
  const cogs = sales.reduce((s, o) => s + o.cogs, 0);
  const grossProfit = revenue - cogs;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const delivered = sales.filter(o => String(o.status || '').toLowerCase() === 'delivered').length;
  const confirmed = sales.filter(o => ['confirmed', 'shipped'].includes(String(o.status || '').toLowerCase())).length;
  const costCoverage = sales.reduce((s, o) => s + o.knownCostLines, 0);

  const productMap = new Map();
  sales.forEach(order => (order.items || []).forEach(item => {
    const key = `${item.productId || ''}::${item.variantId || item.variant || item.name || ''}`;
    const qty = Math.max(0, Number(item.quantity || 0));
    const lineRevenue = Number(item.total ?? item.lineTotal ?? item.price ?? 0) || 0;
    let row = productMap.get(key);
    if (!row) row = { name: item.name || 'Unknown product', variant: item.variant || '', qty: 0, revenue: 0 };
    row.qty += qty;
    row.revenue += lineRevenue || (qty * Number(item.unitPrice || item.price || 0));
    productMap.set(key, row);
  }));
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const customerMap = new Map();
  sales.forEach(order => {
    const key = String(order.phone || order.customerName || 'Unknown').toLowerCase();
    let row = customerMap.get(key);
    if (!row) row = { name: order.customerName || 'Unknown', phone: order.phone || '', revenue: 0, paid: 0, balance: 0, orders: 0 };
    row.revenue += order.total;
    row.paid += order.paid;
    row.balance += order.balance;
    row.orders += 1;
    customerMap.set(key, row);
  });
  const topCustomers = [...customerMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  const paymentMethods = {};
  for (const order of sales) {
    const payments = await loadOrderPayments(order.id);
    for (const p of payments) {
      const method = p.method || p.paymentMethod || 'Unspecified';
      paymentMethods[method] = (paymentMethods[method] || 0) + Number(p.amount || 0);
    }
  }

  panel.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
      <div><h2 class="font-black text-xl">Sales & Profit</h2><p class="text-xs text-gray-400">Performance for a specific date range. Cancelled and returned orders are excluded.</p></div>
      <button id="backInventoryReport" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold">Inventory</button>
    </div>

    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
        <label class="text-[10px] font-black text-gray-500">FROM<input id="salesFrom" type="date" value="${defaultFrom}" class="mt-1 w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs"></label>
        <label class="text-[10px] font-black text-gray-500">TO<input id="salesTo" type="date" value="${defaultTo}" class="mt-1 w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs"></label>
        <button id="applySalesDates" class="bg-gray-900 text-white py-3 rounded-xl text-xs font-bold">Apply dates</button>
        <button id="salesAllTime" class="bg-gray-100 text-gray-700 py-3 rounded-xl text-xs font-bold">All time</button>
      </div>
      <p class="text-[10px] text-gray-400 mt-2">Report period: ${fromDate.toLocaleDateString()} – ${toDate.toLocaleDateString()}</p>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Sales</p><p class="text-xl font-black mt-1">${money(revenue)}</p><p class="text-[9px] text-gray-400 mt-1">${sales.length} orders</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Collected</p><p class="text-xl font-black text-teal-600 mt-1">${money(collected)}</p><p class="text-[9px] text-gray-400 mt-1">cash actually recorded</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Receivables</p><p class="text-xl font-black text-red-600 mt-1">${money(outstanding)}</p><p class="text-[9px] text-gray-400 mt-1">remaining on these orders</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Gross profit</p><p class="text-xl font-black mt-1">${money(grossProfit)}</p><p class="text-[9px] text-gray-400 mt-1">${margin.toFixed(1)}% margin · estimated COGS ${money(cogs)}</p></div>
    </div>

    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <div class="flex justify-between gap-3"><div><h3 class="font-black text-base">Order status</h3><p class="text-[10px] text-gray-400">${delivered} delivered · ${confirmed} confirmed/shipped</p></div><span class="text-[10px] font-bold text-gray-400">${sales.length} active orders</span></div>
      <div class="grid grid-cols-3 gap-2 mt-3"><div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Average order</p><p class="text-sm font-black mt-1">${money(sales.length ? revenue / sales.length : 0)}</p></div><div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Collection rate</p><p class="text-sm font-black mt-1">${revenue ? ((collected / revenue) * 100).toFixed(1) : '0.0'}%</p></div><div class="bg-gray-50 rounded-xl p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Cost coverage</p><p class="text-sm font-black mt-1">${costCoverage} lines</p></div></div>
    </div>

    <div class="grid md:grid-cols-2 gap-5 mb-5">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><h3 class="font-black text-base mb-3">Top products by sales</h3><div class="space-y-2">${topProducts.map(x => `<div class="flex justify-between gap-3 border-b border-gray-50 last:border-0 py-2"><div class="min-w-0"><p class="text-xs font-bold truncate">${esc(x.name)}</p><p class="text-[10px] text-gray-400">${esc(x.variant)} · ${x.qty} units</p></div><p class="text-xs font-black whitespace-nowrap">${money(x.revenue)}</p></div>`).join('') || '<p class="text-xs text-gray-400">No product sales in this period.</p>'}</div></div>
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><h3 class="font-black text-base mb-3">Top customers</h3><div class="space-y-2">${topCustomers.map(x => `<div class="flex justify-between gap-3 border-b border-gray-50 last:border-0 py-2"><div class="min-w-0"><p class="text-xs font-bold truncate">${esc(x.name)}</p><p class="text-[10px] text-gray-400">${esc(x.phone)} · ${x.orders} order${x.orders === 1 ? '' : 's'}</p></div><div class="text-right"><p class="text-xs font-black">${money(x.revenue)}</p><p class="text-[9px] text-red-500">${money(x.balance)} owing</p></div></div>`).join('') || '<p class="text-xs text-gray-400">No customer sales in this period.</p>'}</div></div>
    </div>

    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5"><h3 class="font-black text-base mb-3">Payment methods</h3><div class="grid grid-cols-2 md:grid-cols-4 gap-2">${Object.entries(paymentMethods).sort((a,b) => b[1]-a[1]).map(([method, amount]) => `<div class="bg-gray-50 rounded-xl p-3"><p class="text-[10px] text-gray-400 font-bold">${esc(method)}</p><p class="text-sm font-black mt-1">${money(amount)}</p></div>`).join('') || '<p class="text-xs text-gray-400 col-span-full">No recorded payments in this period.</p>'}</div></div>

    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><h3 class="font-black text-base mb-3">Recent orders in period</h3><div class="space-y-2">${sales.slice(0, 25).map(o => `<div class="border border-gray-100 rounded-xl p-3"><div class="flex justify-between gap-3"><div class="min-w-0"><p class="text-xs font-black truncate">${esc(o.trackingCode || o.id)}</p><p class="text-[10px] text-gray-400">${esc(o.customerName || 'Unknown')} · ${esc(o.status || 'new')} · ${o.date.toLocaleDateString()}</p></div><div class="text-right"><p class="text-xs font-black">${money(o.total)}</p><p class="text-[9px] ${o.balance ? 'text-red-500' : 'text-teal-600'}">${o.balance ? money(o.balance) + ' due' : 'Paid'}</p></div></div></div>`).join('') || '<p class="text-xs text-gray-400">No orders in this period.</p>'}</div></div>
    <p class="text-[9px] text-gray-400 mt-4">Profit note: COGS is estimated from the current product variant costPrice. For products without a recorded cost price, profit is understated/less reliable. Historical cost snapshots can be added later for accounting-grade profit.</p>`;

  document.getElementById('backInventoryReport')?.addEventListener('click', () => renderInventory(panel, products));
  document.getElementById('applySalesDates')?.addEventListener('click', () => {
    const from = document.getElementById('salesFrom').value;
    const to = document.getElementById('salesTo').value;
    if (!from || !to || from > to) return alert('Please select a valid From and To date.');
    renderSales(panel, products, from, to);
  });
  document.getElementById('salesAllTime')?.addEventListener('click', () => renderSales(panel, products, dates[0] ? dateKey(dates[0]) : defaultFrom, dateKey(new Date()));
}

export function initInventoryReports() {
  const panel = document.getElementById('reportsContent');
  if (!panel) return () => {};

  let products = [];
  let search = '';
  let currentMode = 'inventory';

  const unsubscribe = onSnapshot(collection(db, 'products'), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (currentMode === 'inventory') renderInventory(panel, products, search);
  }, error => {
    panel.innerHTML = `<div class="bg-white rounded-[24px] p-6 shadow-sm border border-red-100"><p class="text-sm font-bold text-red-600">Could not load inventory reports.</p><p class="text-xs text-gray-400 mt-1">${esc(error.message)}</p></div>`;
  });

  renderInventory(panel, products, search);

  const stop = () => {
    unsubscribe();
    panel.innerHTML = '';
  };
  return stop;
}
