// admin/js/reports.mjs
// Inventory reporting layer. Reuses the existing products collection and current
// variant stock/cost fields; it does not create or modify inventory data.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

const { db, auth } = initFirebase();
let unsubscribe = null;
let products = [];
let installed = false;

const money = value => `₦${Number(value || 0).toLocaleString()}`;
const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
const variantLabel = (v, i) => [v.processor, v.ram, v.rom, v.color].filter(Boolean).join(' / ') || `Variant ${i + 1}`;

function rows() {
  return products.flatMap(p => (Array.isArray(p.variants) ? p.variants : []).map((v, i) => ({
    productId: p.id,
    productName: p.name || 'Unnamed product',
    category: p.category || 'Uncategorized',
    variant: v,
    variantIndex: i,
    sku: v.sku || '',
    qty: Number(v.stockQty || 0),
    cost: Number(v.costPrice || 0)
  })));
}

function render() {
  const panel = document.getElementById('reportsContent');
  if (!panel) return;
  const rs = rows();
  const totalUnits = rs.reduce((n, r) => n + r.qty, 0);
  const totalValue = rs.reduce((n, r) => n + r.qty * r.cost, 0);
  const low = rs.filter(r => r.qty > 0 && r.qty <= Number(r.variant.reorderLevel ?? 2)).length;
  const out = rs.filter(r => r.qty <= 0).length;

  const categories = {};
  rs.forEach(r => {
    if (!categories[r.category]) categories[r.category] = { units: 0, value: 0 };
    categories[r.category].units += r.qty;
    categories[r.category].value += r.qty * r.cost;
  });

  const productsById = {};
  rs.forEach(r => {
    if (!productsById[r.productId]) productsById[r.productId] = { name: r.productName, units: 0, value: 0 };
    productsById[r.productId].units += r.qty;
    productsById[r.productId].value += r.qty * r.cost;
  });

  panel.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] uppercase font-black text-gray-400">Inventory value</p><p class="text-xl font-black mt-1">${money(totalValue)}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] uppercase font-black text-gray-400">Units</p><p class="text-xl font-black mt-1">${totalUnits.toLocaleString()}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] uppercase font-black text-gray-400">Low stock</p><p class="text-xl font-black mt-1 text-orange-500">${low}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] uppercase font-black text-gray-400">Out of stock</p><p class="text-xl font-black mt-1 text-red-500">${out}</p></div>
    </div>
    <div class="grid md:grid-cols-2 gap-4">
      <section class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><div class="mb-3"><h2 class="text-base font-black">By Category</h2><p class="text-[10px] text-gray-400">Current stock at cost.</p></div><div id="reportCategoryRows" class="space-y-2"></div></section>
      <section class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4"><div class="mb-3"><h2 class="text-base font-black">By Product</h2><p class="text-[10px] text-gray-400">Current stock at cost.</p></div><div id="reportProductRows" class="space-y-2"></div></section>
    </div>
    <section class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4"><div class="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3"><div><h2 class="text-base font-black">Valuation Detail</h2><p class="text-[10px] text-gray-400">Variant quantity × current cost price.</p></div><input id="reportSearch" placeholder="Search product / SKU..." class="p-2.5 bg-gray-50 rounded-xl border text-xs outline-none w-full md:w-64"></div><div id="reportDetailRows" class="space-y-2"></div></section>`;

  document.getElementById('reportCategoryRows').innerHTML = Object.entries(categories).sort((a,b) => b[1].value - a[1].value).map(([name, data]) => `<div class="flex justify-between gap-3 border-b border-gray-50 py-2"><div><p class="text-xs font-bold">${esc(name)}</p><p class="text-[10px] text-gray-400">${data.units.toLocaleString()} units</p></div><span class="text-xs font-black">${money(data.value)}</span></div>`).join('') || '<p class="text-xs text-gray-400">No inventory.</p>';
  document.getElementById('reportProductRows').innerHTML = Object.values(productsById).sort((a,b) => b.value - a.value).map(data => `<div class="flex justify-between gap-3 border-b border-gray-50 py-2"><div class="min-w-0"><p class="text-xs font-bold truncate">${esc(data.name)}</p><p class="text-[10px] text-gray-400">${data.units.toLocaleString()} units</p></div><span class="text-xs font-black">${money(data.value)}</span></div>`).join('') || '<p class="text-xs text-gray-400">No inventory.</p>';

  const drawDetail = () => {
    const q = (document.getElementById('reportSearch')?.value || '').toLowerCase();
    const filtered = rs.filter(r => `${r.productName} ${r.sku} ${variantLabel(r.variant, r.variantIndex)}`.toLowerCase().includes(q));
    document.getElementById('reportDetailRows').innerHTML = filtered.map(r => `<div class="flex flex-col md:flex-row md:items-center gap-2 border-b border-gray-50 py-2"><div class="flex-grow min-w-0"><p class="text-xs font-bold truncate">${esc(r.productName)}</p><p class="text-[10px] text-gray-400">${esc(variantLabel(r.variant, r.variantIndex))}${r.sku ? ' · ' + esc(r.sku) : ''}</p></div><span class="text-xs font-black">${r.qty.toLocaleString()} units</span><span class="text-xs text-gray-500">${money(r.cost)} cost</span><span class="text-xs font-black w-28 text-right">${money(r.qty * r.cost)}</span></div>`).join('') || '<p class="text-xs text-gray-400 py-4 text-center">No matching variants.</p>';
  };
  document.getElementById('reportSearch').addEventListener('input', drawDetail);
  drawDetail();
}

function install() {
  if (installed) return;
  const tabs = document.querySelector('.tab-btn')?.parentElement;
  const anchor = document.getElementById('inventoryTabBtn');
  const inventoryPanel = document.getElementById('panel-inventory');
  if (!tabs || !anchor || !inventoryPanel) return;

  if (!document.getElementById('reportsTabBtn')) {
    const button = document.createElement('button');
    button.id = 'reportsTabBtn';
    button.dataset.tab = 'reports';
    button.className = 'tab-btn px-5 py-2 rounded-full text-xs font-bold bg-gray-100';
    button.textContent = 'Reports';
    anchor.insertAdjacentElement('afterend', button);

    const panel = document.createElement('div');
    panel.id = 'panel-reports';
    panel.className = 'tab-panel hidden';
    panel.innerHTML = '<div id="reportsContent"></div>';
    inventoryPanel.insertAdjacentElement('afterend', panel);

    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      button.classList.add('tab-active');
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      panel.classList.remove('hidden');
      if (!unsubscribe) start();
      render();
    });
  }
  installed = true;
}

function start() {
  if (unsubscribe) return;
  unsubscribe = onSnapshot(collection(db, 'products'), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!document.getElementById('panel-reports')?.classList.contains('hidden')) render();
  });
}

onAuthStateChanged(auth, user => {
  if (user) { install(); } else if (unsubscribe) { unsubscribe(); unsubscribe = null; products = []; }
});

// Inventory is loaded lazily by the Admin page. If this module is imported after login,
// install immediately; otherwise the auth callback above will install it.
install();
