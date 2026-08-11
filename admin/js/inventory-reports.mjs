// admin/js/inventory-reports.mjs
// Read-only inventory valuation and reporting view.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const { db } = initFirebase();

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function variantLabel(v, index) {
  const bits = [v.processor, v.ram, v.rom, v.color].filter(Boolean);
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

export function initInventoryReports() {
  const panel = document.getElementById('reportsContent');
  if (!panel) return () => {};

  panel.innerHTML = '<div class="bg-white rounded-[24px] p-6 shadow-sm border border-gray-100"><p class="text-xs text-gray-400">Loading inventory reports...</p></div>';

  let products = [];
  let search = '';

  const render = () => {
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
      const key = r.productId;
      if (!productGroups[key]) productGroups[key] = { name: r.productName, category: r.category, units: 0, value: 0, variants: 0 };
      productGroups[key].units += r.qty;
      productGroups[key].value += r.value;
      productGroups[key].variants += 1;
    });
    const productRows = Object.values(productGroups).sort((a, b) => b.value - a.value);

    panel.innerHTML = `
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
        <div><h2 class="font-black text-xl">Inventory Reports</h2><p class="text-xs text-gray-400">Current stock valuation and inventory position.</p></div>
        <input id="reportSearch" value="${esc(search)}" placeholder="Search product / SKU..." class="w-full md:w-72 p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none">
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Inventory value</p><p class="text-xl md:text-2xl font-black mt-1">${money(totalValue)}</p></div>
        <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Units in stock</p><p class="text-xl md:text-2xl font-black mt-1">${totalUnits.toLocaleString()}</p></div>
        <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Low stock</p><p class="text-xl md:text-2xl font-black mt-1 text-orange-500">${low}</p></div>
        <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Out of stock</p><p class="text-xl md:text-2xl font-black mt-1 text-red-500">${out}</p></div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <h3 class="font-black text-base mb-3">Valuation by Category</h3>
        <div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="text-[10px] uppercase text-gray-400 border-b"><th class="py-2">Category</th><th class="py-2">Variants</th><th class="py-2">Units</th><th class="py-2 text-right">Value</th></tr></thead><tbody>
          ${categoryRows.map(([name, x]) => `<tr class="border-b last:border-0"><td class="py-3 font-bold">${esc(name)}</td><td class="py-3">${x.variants}</td><td class="py-3">${x.units.toLocaleString()}</td><td class="py-3 text-right font-bold">${money(x.value)}</td></tr>`).join('') || '<tr><td colspan="4" class="py-4 text-center text-gray-400">No inventory data.</td></tr>'}
        </tbody></table></div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <h3 class="font-black text-base mb-3">Valuation by Product</h3>
        <div class="space-y-2">
          ${productRows.map(x => `<div class="flex items-center gap-3 border-b border-gray-50 last:border-0 py-3"><div class="min-w-0 flex-grow"><p class="text-xs font-bold truncate">${esc(x.name)}</p><p class="text-[10px] text-gray-400">${esc(x.category)} · ${x.variants} variant${x.variants === 1 ? '' : 's'} · ${x.units.toLocaleString()} units</p></div><span class="text-xs font-black whitespace-nowrap">${money(x.value)}</span></div>`).join('') || '<p class="text-xs text-gray-400 py-4">No inventory data.</p>'}
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div class="flex items-center justify-between gap-2 mb-3"><div><h3 class="font-black text-base">Variant Valuation</h3><p class="text-[10px] text-gray-400">${term ? `${rows.length} matching variants` : `${rows.length} variants`}</p></div></div>
        <div class="space-y-2">
          ${rows.map(r => `<div class="border border-gray-100 rounded-xl p-3"><div class="flex items-start justify-between gap-3"><div class="min-w-0"><p class="text-xs font-bold truncate">${esc(r.productName)}</p><p class="text-[10px] text-gray-400">${esc(r.variant)}${r.sku ? ` · ${esc(r.sku)}` : ''}</p></div><span class="text-xs font-black whitespace-nowrap">${money(r.value)}</span></div><div class="flex justify-between mt-2 text-[10px] text-gray-400"><span>${r.qty.toLocaleString()} units × ${money(r.cost)}</span><span>${r.qty <= 0 ? 'OUT' : r.qty <= r.reorder ? 'LOW' : 'OK'}</span></div></div>`).join('') || '<p class="text-xs text-gray-400 py-4 text-center">No matching variants.</p>'}
        </div>
      </div>`;

    document.getElementById('reportSearch')?.addEventListener('input', e => {
      search = e.target.value;
      render();
      const input = document.getElementById('reportSearch');
      if (input) { input.focus(); input.setSelectionRange(search.length, search.length); }
    });
  };

  const unsubscribe = onSnapshot(collection(db, 'products'), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, error => {
    panel.innerHTML = `<div class="bg-white rounded-[24px] p-6 shadow-sm border border-red-100"><p class="text-sm font-bold text-red-600">Could not load inventory reports.</p><p class="text-xs text-gray-400 mt-1">${esc(error.message)}</p></div>`;
  });

  return () => unsubscribe();
}
