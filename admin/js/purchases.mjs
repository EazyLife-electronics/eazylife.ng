// admin/js/purchases.mjs
// Stage 5: supplier purchase / stock receiving workflow.
import { initFirebase } from '../../js/firebase.mjs';
import {
  collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const { db } = initFirebase();
let products = [];
let installed = false;
let unsubscribeProducts = null;

function money(v) { return `₦${Number(v || 0).toLocaleString()}`; }
function label(v, i) {
  const bits = [v?.processor, v?.ram, v?.rom, v?.color].filter(Boolean);
  return bits.length ? bits.join(' / ') : `Variant ${i + 1}`;
}

function variantOptions() {
  return products.flatMap(p => (Array.isArray(p.variants) ? p.variants : []).map((v, i) => ({
    productId: p.id,
    productName: p.name || 'Unnamed product',
    variantId: v.id,
    variantLabel: label(v, i),
    sku: v.sku || '',
    stockQty: Number(v.stockQty || 0),
    costPrice: Number(v.costPrice || 0)
  })));
}

function renderOptions() {
  const select = document.getElementById('purchaseVariant');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">Select product / variant...</option>' + variantOptions().map(v =>
    `<option value="${v.productId}::${v.variantId}" data-cost="${v.costPrice}">${v.productName} — ${v.variantLabel}${v.sku ? ` — ${v.sku}` : ''} (stock ${v.stockQty})</option>`
  ).join('');
  if (current) select.value = current;
}

function installPanel() {
  if (installed) return;
  const panel = document.getElementById('inventoryContent');
  if (!panel) return;
  installed = true;

  const wrap = document.createElement('div');
  wrap.id = 'purchaseReceivingPanel';
  wrap.className = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-5';
  wrap.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
      <div><h2 class="font-black text-lg">Receive Purchase</h2><p class="text-[11px] text-gray-400">Record supplier stock received and its actual buying cost. This increases inventory and creates a purchase record.</p></div>
      <span id="purchaseTotal" class="text-sm font-black">Total: ₦0</span>
    </div>
    <div class="grid md:grid-cols-2 gap-2">
      <input id="purchaseSupplier" placeholder="Supplier name" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <input id="purchaseReference" placeholder="Invoice / PO reference" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <select id="purchaseVariant" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none md:col-span-2"></select>
      <input id="purchaseQty" type="number" min="1" step="1" placeholder="Quantity received" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <input id="purchaseCost" type="number" min="0" step="1" placeholder="Unit cost (₦)" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <textarea id="purchaseNotes" rows="2" placeholder="Notes (optional)" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none md:col-span-2"></textarea>
    </div>
    <div class="flex gap-2 mt-3">
      <button id="receivePurchaseBtn" class="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">Receive Stock</button>
      <button id="clearPurchaseBtn" class="bg-gray-100 text-gray-500 px-4 rounded-xl font-bold text-sm">Clear</button>
    </div>
    <p id="purchaseMessage" class="text-xs mt-3 hidden"></p>
    <div class="mt-5 border-t border-gray-100 pt-4"><div class="flex justify-between items-center mb-2"><h3 class="font-black text-sm">Recent purchases</h3><span class="text-[10px] text-gray-400">Latest 10</span></div><div id="purchaseRows" class="space-y-2"><p class="text-xs text-gray-400">Loading...</p></div></div>`;

  panel.parentElement.appendChild(wrap);
  renderOptions();

  const qty = document.getElementById('purchaseQty');
  const cost = document.getElementById('purchaseCost');
  const total = document.getElementById('purchaseTotal');
  const updateTotal = () => { total.textContent = `Total: ${money((Number(qty.value) || 0) * (Number(cost.value) || 0))}`; };
  qty.addEventListener('input', updateTotal);
  cost.addEventListener('input', updateTotal);
  document.getElementById('purchaseVariant').addEventListener('change', e => {
    const option = e.target.selectedOptions[0];
    if (option?.dataset.cost && !cost.value) cost.value = option.dataset.cost;
    updateTotal();
  });
  document.getElementById('clearPurchaseBtn').onclick = () => {
    document.getElementById('purchaseSupplier').value = '';
    document.getElementById('purchaseReference').value = '';
    document.getElementById('purchaseVariant').value = '';
    document.getElementById('purchaseQty').value = '';
    document.getElementById('purchaseCost').value = '';
    document.getElementById('purchaseNotes').value = '';
    updateTotal();
  };
  document.getElementById('receivePurchaseBtn').onclick = receivePurchase;
  loadPurchases();
}

async function receivePurchase() {
  const message = document.getElementById('purchaseMessage');
  const supplier = document.getElementById('purchaseSupplier').value.trim();
  const reference = document.getElementById('purchaseReference').value.trim();
  const selected = document.getElementById('purchaseVariant').value;
  const qty = parseInt(document.getElementById('purchaseQty').value, 10);
  const unitCost = Number(document.getElementById('purchaseCost').value || 0);
  const notes = document.getElementById('purchaseNotes').value.trim();
  if (!supplier) return showMessage('Supplier name is required.', true);
  if (!selected) return showMessage('Select a product variant.', true);
  if (!Number.isInteger(qty) || qty <= 0) return showMessage('Quantity must be a positive whole number.', true);
  if (!Number.isFinite(unitCost) || unitCost < 0) return showMessage('Enter a valid unit cost.', true);

  const [productId, variantId] = selected.split('::');
  const purchaseRef = doc(collection(db, 'purchases'));
  const movementRef = doc(collection(db, 'inventoryMovements'));
  const productRef = doc(db, 'products', productId);
  const variantInfo = variantOptions().find(v => v.productId === productId && v.variantId === variantId);

  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(productRef);
      if (!snap.exists()) throw new Error('Product no longer exists.');
      const product = snap.data();
      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const index = variants.findIndex(v => v.id === variantId);
      if (index < 0) throw new Error('Variant no longer exists.');
      const current = Number(variants[index].stockQty || 0);
      const next = current + qty;
      variants[index] = {
        ...variants[index],
        stockQty: next,
        inStock: true,
        costPrice: unitCost
      };
      tx.update(productRef, { variants, inStock: true });
      tx.set(purchaseRef, {
        supplier,
        reference,
        productId,
        variantId,
        productName: product.name || variantInfo?.productName || '',
        variantLabel: label(variants[index], index),
        sku: variants[index].sku || variantInfo?.sku || '',
        quantity: qty,
        unitCost,
        totalCost: qty * unitCost,
        notes,
        status: 'received',
        createdAt: serverTimestamp()
      });
      tx.set(movementRef, {
        productId,
        variantId,
        sku: variants[index].sku || variantInfo?.sku || '',
        productName: product.name || variantInfo?.productName || '',
        variantLabel: label(variants[index], index),
        type: 'purchase_received',
        quantity: qty,
        previousQty: current,
        newQty: next,
        reason: 'Purchase received',
        reference: reference || supplier,
        purchaseId: purchaseRef.id,
        supplier,
        unitCost,
        totalCost: qty * unitCost,
        createdAt: serverTimestamp()
      });
    });
    showMessage(`Received ${qty} unit${qty === 1 ? '' : 's'} successfully. Stock is now updated.`, false);
    document.getElementById('clearPurchaseBtn').click();
    renderOptions();
    loadPurchases();
  } catch (e) {
    showMessage(e.message || 'Could not receive purchase.', true);
  }
}

function showMessage(text, error) {
  const el = document.getElementById('purchaseMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `text-xs mt-3 ${error ? 'text-red-500' : 'text-green-600'}`;
  el.classList.remove('hidden');
}

async function loadPurchases() {
  const el = document.getElementById('purchaseRows');
  if (!el) return;
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => {
      const at = a.createdAt?.toMillis?.() || 0;
      const bt = b.createdAt?.toMillis?.() || 0;
      return bt - at;
    }).slice(0, 10);
    el.innerHTML = items.map(p => `<div class="flex flex-col md:flex-row md:items-center gap-1 border-b border-gray-50 py-2"><div class="flex-grow min-w-0"><p class="text-xs font-bold truncate">${p.productName || 'Product'} · ${p.variantLabel || ''}</p><p class="text-[10px] text-gray-400 truncate">${p.supplier || 'Supplier'}${p.reference ? ' · ' + p.reference : ''} · ${p.quantity || 0} × ${money(p.unitCost)}</p></div><span class="text-xs font-black">${money(p.totalCost)}</span></div>`).join('') || '<p class="text-xs text-gray-400 py-3">No purchases recorded yet.</p>';
  } catch (e) {
    el.innerHTML = `<p class="text-xs text-red-500 py-3">Could not load purchases: ${e.message}</p>`;
  }
}

function start() {
  if (!location.pathname.includes('/admin/')) return;
  if (unsubscribeProducts) unsubscribeProducts();
  unsubscribeProducts = onSnapshot(collection(db, 'products'), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (installed) renderOptions();
  });
  const observer = new MutationObserver(() => {
    if (document.getElementById('inventoryContent')) installPanel();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  installPanel();
}

start();
