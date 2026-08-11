// admin/js/purchases.mjs
// Stage 5: supplier purchase / stock receiving workflow.
// Purchases are kept in their own Admin tab. Product data is subscribed only after
// authentication so the variant dropdown is populated reliably.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, doc, getDocs, onSnapshot, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const { db, auth } = initFirebase();
let products = [];
let unsubscribeProducts = null;
let tabInstalled = false;
let panelInstalled = false;
let currentUser = null;
let purchaseHistory = [];

function money(v) { return `₦${Number(v || 0).toLocaleString()}`; }
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function label(v, i) {
  const bits = [v?.processor, v?.ram, v?.rom, v?.color].filter(Boolean);
  return bits.length ? bits.join(' / ') : `Variant ${i + 1}`;
}
function dateText(value) {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
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
  const options = variantOptions();
  select.innerHTML = '<option value="">Select product / variant...</option>' + options.map(v =>
    `<option value="${escapeHtml(v.productId)}::${escapeHtml(v.variantId)}" data-cost="${v.costPrice}">${escapeHtml(v.productName)} — ${escapeHtml(v.variantLabel)}${v.sku ? ` — ${escapeHtml(v.sku)}` : ''} (stock ${v.stockQty})</option>`
  ).join('');
  if (current && options.some(v => `${v.productId}::${v.variantId}` === current)) select.value = current;
}

function installTab() {
  if (tabInstalled) return true;
  const tabs = document.querySelector('.tab-btn')?.parentElement;
  const inventoryButton = document.getElementById('inventoryTabBtn');
  const inventoryPanel = document.getElementById('panel-inventory');
  if (!tabs || !inventoryButton || !inventoryPanel) return false;

  if (!document.getElementById('purchasesTabBtn')) {
    const button = document.createElement('button');
    button.id = 'purchasesTabBtn';
    button.dataset.tab = 'purchases';
    button.className = 'tab-btn px-5 py-2 rounded-full text-xs font-bold bg-gray-100';
    button.textContent = 'Purchases';
    inventoryButton.insertAdjacentElement('afterend', button);

    const panel = document.createElement('div');
    panel.id = 'panel-purchases';
    panel.className = 'tab-panel hidden';
    panel.innerHTML = '<div id="purchaseContent"></div>';
    inventoryPanel.insertAdjacentElement('afterend', panel);

    button.addEventListener('click', () => showPurchasesTab(button, panel));
    tabs.addEventListener('click', event => {
      const clicked = event.target.closest?.('.tab-btn');
      if (!clicked || clicked === button) return;
      panel.classList.add('hidden');
    });
  }

  tabInstalled = true;
  return true;
}

function startProducts() {
  if (!currentUser || unsubscribeProducts) return;
  unsubscribeProducts = onSnapshot(collection(db, 'products'), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOptions();
  }, error => {
    const message = document.getElementById('purchaseMessage');
    if (message) showMessage(`Could not load products: ${error.message}`, true);
  });
}

function stopProducts() {
  if (unsubscribeProducts) unsubscribeProducts();
  unsubscribeProducts = null;
  products = [];
}

function showPurchasesTab(button, panel) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
  button.classList.add('tab-active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  panel.classList.remove('hidden');
  installPanel();
  startProducts();
  renderOptions();
  loadPurchases();
}

function installPanel() {
  if (panelInstalled) return;
  const panel = document.getElementById('purchaseContent');
  if (!panel) return;
  panelInstalled = true;

  const wrap = document.createElement('div');
  wrap.id = 'purchaseReceivingPanel';
  wrap.className = 'space-y-4';
  wrap.innerHTML = `
    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div><h2 class="font-black text-lg">Receive Purchase</h2><p class="text-[11px] text-gray-400">Record supplier stock received and its actual buying cost. This increases inventory and creates a purchase record.</p></div>
        <span id="purchaseTotal" class="text-sm font-black">Total: ₦0</span>
      </div>
      <div class="grid md:grid-cols-2 gap-2">
        <input id="purchaseSupplier" placeholder="Supplier name" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        <input id="purchaseReference" placeholder="Invoice / PO reference" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        <select id="purchaseVariant" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none md:col-span-2"><option value="">Select product / variant...</option></select>
        <input id="purchaseQty" type="number" min="1" step="1" placeholder="Quantity received" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        <input id="purchaseCost" type="number" min="0" step="1" placeholder="Unit cost (₦)" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        <textarea id="purchaseNotes" rows="2" placeholder="Notes (optional)" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none md:col-span-2"></textarea>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="receivePurchaseBtn" class="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">Receive Stock</button>
        <button id="clearPurchaseBtn" class="bg-gray-100 text-gray-500 px-4 rounded-xl font-bold text-sm">Clear</button>
      </div>
      <p id="purchaseMessage" class="text-xs mt-3 hidden"></p>
    </div>

    <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><h2 class="font-black text-lg">Purchase History</h2><p class="text-[11px] text-gray-400">Review received purchases without leaving the Purchases tab.</p></div>
        <div class="flex gap-2 w-full md:w-auto">
          <input id="purchaseHistorySearch" placeholder="Search supplier, reference, SKU..." class="flex-1 md:w-72 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
          <button id="purchaseHistoryRefresh" class="bg-gray-100 text-gray-600 px-4 rounded-xl font-bold text-xs">Refresh</button>
        </div>
      </div>
      <div id="purchaseHistorySummary" class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4"></div>
      <div id="purchaseRows" class="space-y-2"><p class="text-xs text-gray-400">Loading...</p></div>
    </div>`;
  panel.appendChild(wrap);

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
    renderOptions();
  };
  document.getElementById('receivePurchaseBtn').onclick = receivePurchase;
  document.getElementById('purchaseHistorySearch').addEventListener('input', renderPurchaseHistory);
  document.getElementById('purchaseHistoryRefresh').onclick = loadPurchases;
  loadPurchases();
}

async function receivePurchase() {
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
      variants[index] = { ...variants[index], stockQty: next, inStock: true, costPrice: unitCost };
      tx.update(productRef, { variants, inStock: true });
      tx.set(purchaseRef, {
        supplier, reference, productId, variantId,
        productName: product.name || variantInfo?.productName || '',
        variantLabel: label(variants[index], index),
        sku: variants[index].sku || variantInfo?.sku || '',
        quantity: qty, unitCost, totalCost: qty * unitCost, notes,
        status: 'received', createdAt: serverTimestamp()
      });
      tx.set(movementRef, {
        productId, variantId,
        sku: variants[index].sku || variantInfo?.sku || '',
        productName: product.name || variantInfo?.productName || '',
        variantLabel: label(variants[index], index), type: 'purchase_received',
        quantity: qty, previousQty: current, newQty: next,
        reason: 'Purchase received', reference: reference || supplier,
        purchaseId: purchaseRef.id, supplier, unitCost, totalCost: qty * unitCost,
        createdAt: serverTimestamp()
      });
    });
    showMessage(`Received ${qty} unit${qty === 1 ? '' : 's'} successfully. Stock is now updated.`, false);
    document.getElementById('clearPurchaseBtn').click();
    await loadPurchases();
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
  el.innerHTML = '<p class="text-xs text-gray-400 py-3">Loading purchases...</p>';
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    purchaseHistory = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0;
      const bt = b.createdAt?.toMillis?.() || 0;
      return bt - at;
    });
    renderPurchaseHistory();
  } catch (e) {
    purchaseHistory = [];
    el.innerHTML = `<p class="text-xs text-red-500 py-3">Could not load purchases: ${escapeHtml(e.message)}</p>`;
  }
}

function renderPurchaseHistory() {
  const el = document.getElementById('purchaseRows');
  const summary = document.getElementById('purchaseHistorySummary');
  if (!el) return;
  const query = String(document.getElementById('purchaseHistorySearch')?.value || '').trim().toLowerCase();
  const filtered = purchaseHistory.filter(p => {
    if (!query) return true;
    return [p.supplier, p.reference, p.productName, p.variantLabel, p.sku, p.notes].some(v => String(v || '').toLowerCase().includes(query));
  });
  const totalQty = filtered.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
  const totalValue = filtered.reduce((sum, p) => sum + Number(p.totalCost || 0), 0);
  const suppliers = new Set(filtered.map(p => String(p.supplier || '').trim()).filter(Boolean)).size;
  if (summary) {
    summary.innerHTML = [
      ['Purchases', filtered.length],
      ['Units received', totalQty.toLocaleString()],
      ['Purchase value', money(totalValue)],
      ['Suppliers', suppliers]
    ].map(([title, value]) => `<div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[10px] text-gray-400 font-bold uppercase">${title}</p><p class="text-sm font-black mt-1">${value}</p></div>`).join('');
  }
  if (!filtered.length) {
    el.innerHTML = `<div class="py-8 text-center text-xs text-gray-400">${query ? 'No purchases match your search.' : 'No purchases recorded yet.'}</div>`;
    return;
  }
  el.innerHTML = filtered.map(p => `
    <div class="border border-gray-100 rounded-xl p-3 hover:border-gray-200">
      <div class="flex flex-col md:flex-row md:items-center gap-2">
        <div class="flex-grow min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-xs font-black truncate">${escapeHtml(p.productName || 'Product')} · ${escapeHtml(p.variantLabel || '')}</p>
            <span class="text-[9px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">RECEIVED</span>
          </div>
          <p class="text-[10px] text-gray-400 mt-1">${escapeHtml(p.supplier || 'Supplier')} ${p.reference ? `· ${escapeHtml(p.reference)}` : ''} · ${escapeHtml(p.sku || 'No SKU')}</p>
          <p class="text-[10px] text-gray-400 mt-1">${dateText(p.createdAt)}</p>
        </div>
        <div class="grid grid-cols-3 md:flex gap-4 md:items-center text-right">
          <div><p class="text-[9px] text-gray-400">QTY</p><p class="text-xs font-black">${Number(p.quantity || 0).toLocaleString()}</p></div>
          <div><p class="text-[9px] text-gray-400">UNIT COST</p><p class="text-xs font-black">${money(p.unitCost)}</p></div>
          <div><p class="text-[9px] text-gray-400">TOTAL</p><p class="text-xs font-black">${money(p.totalCost)}</p></div>
        </div>
      </div>
      ${p.notes ? `<p class="text-[10px] text-gray-500 mt-2 border-t border-gray-50 pt-2">${escapeHtml(p.notes)}</p>` : ''}
    </div>`).join('');
}

function boot() {
  installTab();
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (!user) stopProducts();
    else if (document.getElementById('panel-purchases') && !document.getElementById('panel-purchases').classList.contains('hidden')) startProducts();
  });
}

const observer = new MutationObserver(() => installTab());
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
boot();
