// admin/js/inventory.mjs
// Inventory foundation: variant-level SKUs, quantities, cost prices, movements and dashboard.
import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, orderBy,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const { db } = initFirebase();
let unsubscribe = null;
let products = [];
let productBridgeInstalled = false;

function makeSku(product, variant, index) {
  const clean = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 10);
  const parts = [clean(product.brand), clean(product.name), clean(variant.processor), clean(variant.ram), clean(variant.rom), clean(variant.color)].filter(Boolean);
  return (parts.join('-') || `PRODUCT-${index + 1}`).slice(0, 42);
}

function variantLabel(v, index) {
  const bits = [v.processor, v.ram, v.rom, v.color].filter(Boolean);
  return bits.length ? bits.join(' / ') : `Variant ${index + 1}`;
}

function money(value) {
  return `₦${Number(value || 0).toLocaleString()}`;
}

function flattenProducts() {
  const rows = [];
  products.forEach(p => (p.variants || []).forEach((v, index) => {
    rows.push({
      productId: p.id,
      productName: p.name || 'Unnamed product',
      brand: p.brand || '',
      category: p.category || '',
      variantId: v.id,
      variantIndex: index,
      variant: v,
      sku: v.sku || makeSku(p, v, index),
      stockQty: Number.isFinite(Number(v.stockQty)) ? Number(v.stockQty) : 0,
      reorderLevel: Number.isFinite(Number(v.reorderLevel)) ? Number(v.reorderLevel) : 2,
      costPrice: Number.isFinite(Number(v.costPrice)) ? Number(v.costPrice) : 0
    });
  }));
  return rows;
}

async function changeStock(productId, variantId, delta, type, reason, reference = '') {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('Quantity must be a non-zero whole number.');

  const productRef = doc(db, 'products', productId);
  const movementRef = doc(collection(db, 'inventoryMovements'));

  await runTransaction(db, async tx => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('Product no longer exists.');
    const product = snap.data();
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    const index = variants.findIndex(v => v.id === variantId);
    if (index < 0) throw new Error('Variant no longer exists.');

    const current = Number(variants[index].stockQty || 0);
    const next = current + delta;
    if (next < 0) throw new Error(`Insufficient stock. Current stock is ${current}.`);

    variants[index] = { ...variants[index], stockQty: next, inStock: next > 0 };
    tx.update(productRef, { variants, inStock: variants.some(v => Number(v.stockQty || 0) > 0) });
    tx.set(movementRef, {
      productId,
      variantId,
      sku: variants[index].sku || '',
      productName: product.name || '',
      variantLabel: variantLabel(variants[index], index),
      type,
      quantity: delta,
      previousQty: current,
      newQty: next,
      reason: reason || '',
      reference: reference || '',
      createdAt: serverTimestamp()
    });
  });
}

async function saveVariantSettings(row, sku, reorderLevel, costPrice) {
  const productRef = doc(db, 'products', row.productId);
  await runTransaction(db, async tx => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error('Product no longer exists.');
    const product = snap.data();
    const variants = Array.isArray(product.variants) ? [...product.variants] : [];
    const index = variants.findIndex(v => v.id === row.variantId);
    if (index < 0) throw new Error('Variant no longer exists.');

    const currentStock = Math.max(0, Number(variants[index].stockQty || 0));
    variants[index] = {
      ...variants[index],
      sku: sku.trim() || makeSku(product, variants[index], index),
      reorderLevel: Math.max(0, parseInt(reorderLevel, 10) || 0),
      costPrice: Math.max(0, Number(costPrice) || 0),
      stockQty: currentStock,
      inStock: currentStock > 0
    };
    tx.update(productRef, { variants, inStock: variants.some(v => Number(v.stockQty || 0) > 0) });
  });
}

function render() {
  const panel = document.getElementById('inventoryContent');
  if (!panel) return;
  const rows = flattenProducts();
  const totalUnits = rows.reduce((sum, r) => sum + r.stockQty, 0);
  const low = rows.filter(r => r.stockQty > 0 && r.stockQty <= r.reorderLevel).length;
  const out = rows.filter(r => r.stockQty <= 0).length;
  const value = rows.reduce((sum, r) => sum + r.costPrice * r.stockQty, 0);

  panel.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Variants</p><p class="text-2xl font-black mt-1">${rows.length}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Units in stock</p><p class="text-2xl font-black mt-1">${totalUnits.toLocaleString()}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Low stock</p><p class="text-2xl font-black mt-1 text-orange-500">${low}</p></div>
      <div class="bg-white rounded-2xl p-4 border border-gray-100"><p class="text-[10px] font-black uppercase text-gray-400">Out of stock</p><p class="text-2xl font-black mt-1 text-red-500">${out}</p></div>
    </div>
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <div><h2 class="font-black text-lg">Inventory</h2><p class="text-[11px] text-gray-400">Manage SKU, cost, reorder level and stock per product variant. Stock changes are recorded in the movement ledger.</p></div>
        <input id="inventorySearch" placeholder="Search product / SKU..." class="w-full md:w-64 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      </div>
      <div id="inventoryRows" class="space-y-2"></div>
    </div>
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div class="flex items-center justify-between mb-3"><div><h2 class="font-black text-lg">Recent movements</h2><p class="text-[11px] text-gray-400">Every manual stock change is kept here.</p></div><span class="text-xs text-gray-400 font-bold">Stock cost value: ${money(value)}</span></div>
      <div id="movementRows" class="space-y-2"><p class="text-xs text-gray-400 py-4">Loading movements...</p></div>
    </div>`;

  const drawRows = () => {
    const term = (document.getElementById('inventorySearch')?.value || '').toLowerCase();
    const filtered = rows.filter(r => `${r.productName} ${r.sku} ${variantLabel(r.variant, r.variantIndex)}`.toLowerCase().includes(term));
    const container = document.getElementById('inventoryRows');
    container.innerHTML = filtered.map(r => {
      const status = r.stockQty <= 0 ? 'OUT' : r.stockQty <= r.reorderLevel ? 'LOW' : 'OK';
      const statusClass = status === 'OUT' ? 'bg-red-50 text-red-600' : status === 'LOW' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600';
      return `<div class="border border-gray-100 rounded-xl p-3" data-inv-row="${r.productId}:${r.variantId}">
        <div class="flex flex-col lg:flex-row lg:items-center gap-3">
          <div class="flex-grow min-w-0"><p class="font-bold text-xs truncate">${r.productName}</p><p class="text-[10px] text-gray-400">${variantLabel(r.variant, r.variantIndex)}</p></div>
          <input data-sku value="${r.sku}" class="w-full lg:w-40 p-2 bg-gray-50 rounded-lg border border-gray-200 text-[10px] font-mono outline-none" title="SKU">
          <div class="flex items-center gap-2"><span class="text-[10px] font-black uppercase px-2 py-1 rounded-full ${statusClass}">${status}</span><span class="font-black text-lg w-12 text-center">${r.stockQty}</span></div>
          <input data-reorder type="number" min="0" value="${r.reorderLevel}" class="w-20 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs text-center" title="Reorder level">
          <input data-cost type="number" min="0" value="${r.costPrice || ''}" placeholder="Cost ₦" class="w-24 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs text-center" title="Cost price">
          <div class="flex gap-1"><button data-in="${r.productId}:${r.variantId}" class="px-3 py-2 rounded-lg bg-green-50 text-green-700 text-[10px] font-black">+ IN</button><button data-out="${r.productId}:${r.variantId}" class="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[10px] font-black">− OUT</button><button data-save="${r.productId}:${r.variantId}" class="px-3 py-2 rounded-lg bg-gray-900 text-white text-[10px] font-black">SAVE</button></div>
        </div>
      </div>`;
    }).join('') || '<p class="text-xs text-gray-400 py-5 text-center">No matching variants.</p>';

    container.querySelectorAll('[data-save]').forEach(btn => btn.onclick = async () => {
      const row = filtered.find(x => `${x.productId}:${x.variantId}` === btn.dataset.save);
      const el = btn.closest('[data-inv-row]');
      try {
        await saveVariantSettings(
          row,
          el.querySelector('[data-sku]').value,
          el.querySelector('[data-reorder]').value,
          el.querySelector('[data-cost]').value
        );
      } catch (e) { alert(e.message); }
    });
    container.querySelectorAll('[data-in]').forEach(btn => btn.onclick = () => movementDialog(filtered.find(x => `${x.productId}:${x.variantId}` === btn.dataset.in), 1));
    container.querySelectorAll('[data-out]').forEach(btn => btn.onclick = () => movementDialog(filtered.find(x => `${x.productId}:${x.variantId}` === btn.dataset.out), -1));
  };

  document.getElementById('inventorySearch').addEventListener('input', drawRows);
  drawRows();
  loadMovements();
}

async function movementDialog(row, direction) {
  if (!row) return;
  const label = direction > 0 ? 'Stock In' : 'Stock Out';
  const rawQty = prompt(`${label}: ${row.productName} — ${row.sku}\nEnter quantity:`);
  if (rawQty === null) return;
  const qty = parseInt(rawQty, 10);
  if (!Number.isInteger(qty) || qty <= 0) return alert('Enter a positive whole number.');
  const reason = prompt('Reason (e.g. New purchase, damaged, customer sale):') || '';
  const reference = prompt('Reference / invoice / order ID (optional):') || '';
  try {
    await changeStock(row.productId, row.variantId, direction * qty, direction > 0 ? 'stock_in' : 'stock_out', reason, reference);
  } catch (e) { alert(e.message); }
}

async function loadMovements() {
  const el = document.getElementById('movementRows');
  if (!el) return;
  try {
    const q = query(collection(db, 'inventoryMovements'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const items = snap.docs.slice(0, 25).map(d => ({ id: d.id, ...d.data() }));
    el.innerHTML = items.map(m => `<div class="flex items-center gap-3 border-b border-gray-50 py-2"><span class="text-[10px] font-black px-2 py-1 rounded-full ${m.quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}">${m.quantity > 0 ? '+' : ''}${m.quantity}</span><div class="flex-grow min-w-0"><p class="text-xs font-bold truncate">${m.productName || 'Product'} · ${m.sku || 'No SKU'}</p><p class="text-[10px] text-gray-400 truncate">${m.reason || m.type || 'Adjustment'}${m.reference ? ' · ' + m.reference : ''}</p></div><span class="text-[10px] text-gray-400">${m.newQty ?? '—'} now</span></div>`).join('') || '<p class="text-xs text-gray-400 py-4">No movements yet.</p>';
  } catch (e) { el.innerHTML = `<p class="text-xs text-red-500 py-4">Could not load movements: ${e.message}</p>`; }
}

/* ---------------- PRODUCT ↔ INVENTORY BRIDGE ---------------- */
// The Product editor originally treated variants as catalog data only. This bridge
// adds inventory fields without replacing the existing product UI. Existing variant
// stock is always preserved when editing a product; only a genuinely new variant gets
// its opening-stock value from the Product form.
function bridgeEscape(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decorateVariantRow(row, originalVariant = null) {
  if (!row || row.dataset.inventoryDecorated === '1') return;
  row.dataset.inventoryDecorated = '1';
  if (originalVariant?.id) row.dataset.originalVariantId = originalVariant.id;
  const rowId = row.dataset.rowId;
  const existing = originalVariant ? true : false;
  const stock = originalVariant ? Number(originalVariant.stockQty || 0) : 0;
  const reorder = originalVariant ? Number(originalVariant.reorderLevel ?? 2) : 2;
  const cost = originalVariant ? Number(originalVariant.costPrice || 0) : 0;
  const sku = originalVariant?.sku || '';
  const label = existing ? 'Current stock (managed in Inventory)' : 'Opening stock (new variant)';

  const image = row.querySelector(`#v${rowId}_image`)?.closest('.flex');
  const html = document.createElement('div');
  html.className = 'mt-2 bg-gray-50 rounded-lg p-2 border border-gray-200';
  html.dataset.inventoryFields = '1';
  html.innerHTML = `
    <p class="text-[10px] font-black uppercase text-gray-500 mb-1.5">Inventory</p>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <div><label class="text-[9px] text-gray-400 font-bold block mb-1">SKU</label><input id="v${rowId}_invSku" value="${bridgeEscape(sku)}" placeholder="e.g. HP840-R5-16-512" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs font-mono outline-none"></div>
      <div><label class="text-[9px] text-gray-400 font-bold block mb-1">Cost price (₦)</label><input id="v${rowId}_invCost" type="number" min="0" value="${cost || ''}" placeholder="What it costs you" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none"></div>
    </div>
    <div class="grid grid-cols-2 gap-2">
      <div><label class="text-[9px] text-gray-400 font-bold block mb-1">Reorder level</label><input id="v${rowId}_invReorder" type="number" min="0" value="${reorder}" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none"></div>
      <div><label class="text-[9px] text-gray-400 font-bold block mb-1">${label}</label><input id="v${rowId}_invStock" type="number" min="0" value="${stock}" ${existing ? 'readonly' : ''} class="w-full p-2 ${existing ? 'bg-gray-100 text-gray-500' : 'bg-white'} rounded-lg border border-gray-200 text-xs outline-none"></div>
    </div>
    <p class="text-[9px] text-gray-400 mt-1.5">${existing ? 'Current stock is controlled from Inventory. Editing this product will not reset it.' : 'This becomes the starting quantity. After saving, use Inventory for all stock movements.'}</p>`;
  if (image?.parentElement) image.parentElement.insertAdjacentElement('afterend', html);
  else row.appendChild(html);
}

async function markExistingVariantIds(productId) {
  if (!productId) return;
  try {
    const snap = await getDoc(doc(db, 'products', productId));
    if (!snap.exists()) return;
    const variants = Array.isArray(snap.data().variants) ? snap.data().variants : [];
    const rows = [...document.querySelectorAll('#variantRows .variant-row')];
    rows.forEach((row, index) => {
      if (variants[index]) {
        row.dataset.originalVariantId = variants[index].id || '';
        decorateVariantRow(row, variants[index]);
      }
    });
  } catch (e) {
    console.warn('Could not load existing inventory data for product form:', e);
  }
}

async function saveProductFromBridge(event) {
  if (event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  const form = document.getElementById('productForm');
  if (!form) return;
  const editId = document.getElementById('editId')?.value || '';
  const existingProductSnap = editId ? await getDoc(doc(db, 'products', editId)) : null;
  const existingProduct = existingProductSnap?.exists() ? existingProductSnap.data() : null;
  const existingVariants = Array.isArray(existingProduct?.variants) ? existingProduct.variants : [];
  const variantRows = [...document.querySelectorAll('#variantRows .variant-row')];
  if (!variantRows.length) return alert('Add at least one variant — that\'s what customers actually buy.');

  const variants = variantRows.map((row, index) => {
    const id = row.dataset.originalVariantId || ('v' + Date.now() + '_' + index + '_' + Math.random().toString(36).slice(2, 7));
    const old = existingVariants.find(v => v.id === id);
    const value = key => document.getElementById(`v${row.dataset.rowId}_${key}`)?.value?.trim() || '';
    const number = key => parseInt(document.getElementById(`v${row.dataset.rowId}_${key}`)?.value, 10) || 0;
    const invSku = document.getElementById(`v${row.dataset.rowId}_invSku`)?.value?.trim() || '';
    const invCost = parseInt(document.getElementById(`v${row.dataset.rowId}_invCost`)?.value, 10) || 0;
    const invReorder = Math.max(0, parseInt(document.getElementById(`v${row.dataset.rowId}_invReorder`)?.value, 10) || 0);
    const openingStock = Math.max(0, parseInt(document.getElementById(`v${row.dataset.rowId}_invStock`)?.value, 10) || 0);
    const deliveryFeeRaw = document.getElementById(`v${row.dataset.rowId}_deliveryFee`)?.value?.trim() || '';
    const bulkEnabled = document.getElementById(`v${row.dataset.rowId}_bulkEnabled`)?.checked || false;
    const bulkModeOwn = document.querySelector(`input[name="v${row.dataset.rowId}_bulkMode"][value="own"]`)?.checked || false;
    const image = value('image');
    const stockQty = old ? Math.max(0, Number(old.stockQty || 0)) : openingStock;
    return {
      id,
      color: value('color'), processor: value('processor'), ram: value('ram'), rom: value('rom'),
      price: number('price'), promoPrice: number('promo'), image,
      deliveryFee: deliveryFeeRaw === '' ? null : parseInt(deliveryFeeRaw, 10),
      deliveryRoute: document.getElementById(`v${row.dataset.rowId}_deliveryGeneral`)?.checked ? 'general' : 'separate',
      bulkSavingsEnabled: bulkEnabled,
      bulkSavingsMode: bulkModeOwn ? 'own' : 'general',
      bulkSavingsPercent: parseFloat(document.getElementById(`v${row.dataset.rowId}_bulkPercent`)?.value) || 0,
      bulkSavingsMinQty: parseInt(document.getElementById(`v${row.dataset.rowId}_bulkMinQty`)?.value, 10) || 0,
      sku: invSku || old?.sku || '',
      costPrice: invCost || Number(old?.costPrice || 0),
      reorderLevel: invReorder,
      stockQty,
      inStock: stockQty > 0
    };
  });

  if (variants.some(v => !v.price)) return alert('Every variant needs a price.');
  const product = {
    name: document.getElementById('pName').value.trim(),
    brand: document.getElementById('pBrand').value.trim(),
    category: document.getElementById('pCategory').value.trim(),
    desc: document.getElementById('pDesc').value.trim(),
    inStock: document.getElementById('pInStock').checked,
    variants,
    upgrades: collectBridgeUpgrades()
  };

  try {
    const ref = editId ? doc(db, 'products', editId) : doc(collection(db, 'products'));
    if (editId) {
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('Product no longer exists.');
        tx.update(ref, product);
      });
    } else {
      await runTransaction(db, async tx => tx.set(ref, product));
    }
    form.reset();
    document.getElementById('editId').value = '';
    document.getElementById('formTitle').textContent = 'Add Product';
    document.getElementById('variantRows').innerHTML = '';
    document.getElementById('upgradeRows').innerHTML = '';
    document.getElementById('pInStock').checked = true;
    // Reuse the existing Add Variant button by triggering it.
    document.getElementById('addVariantBtn').click();
    alert(editId ? 'Product updated successfully.' : 'Product added successfully.');
  } catch (e) {
    alert('Failed to save product: ' + e.message);
  }
}

function collectBridgeUpgrades() {
  return [...document.querySelectorAll('#upgradeRows .upgrade-row')].map(row => {
    const rowId = row.dataset.rowId;
    return {
      id: 'u' + Date.now() + '_' + rowId,
      name: document.getElementById(`u${rowId}_name`)?.value?.trim() || '',
      price: parseInt(document.getElementById(`u${rowId}_price`)?.value, 10) || 0
    };
  }).filter(u => u.name);
}

function installProductBridge() {
  if (productBridgeInstalled) return;
  const form = document.getElementById('productForm');
  const rowsContainer = document.getElementById('variantRows');
  if (!form || !rowsContainer) return;
  productBridgeInstalled = true;

  const decorateAll = () => document.querySelectorAll('#variantRows .variant-row').forEach(row => decorateVariantRow(row));
  new MutationObserver(decorateAll).observe(rowsContainer, { childList: true });
  decorateAll();

  document.addEventListener('click', event => {
    const editButton = event.target.closest?.('[data-edit]');
    if (editButton) setTimeout(() => markExistingVariantIds(editButton.dataset.edit), 80);
  }, true);

  form.addEventListener('submit', saveProductFromBridge, true);
}

// Inventory is lazy-loaded by the Admin page. Install the Product bridge as soon as
// this module is loaded (the first time the Inventory tab is opened), and again when
// initInventory is called.
installProductBridge();

export function initInventory() {
  installProductBridge();
  const panel = document.getElementById('panel-inventory');
  if (!panel) return () => {};
  if (unsubscribe) unsubscribe();
  unsubscribe = onSnapshot(collection(db, 'products'), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
  return () => { if (unsubscribe) unsubscribe(); unsubscribe = null; };
}

export { makeSku };