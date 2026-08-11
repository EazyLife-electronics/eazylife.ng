// admin/js/purchase-voids.mjs
// Controlled purchase correction: never deletes the original purchase.
// A void atomically reverses the received quantity and records an audit movement.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, doc, getDocs, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const { db, auth } = initFirebase();
let currentUser = null;
let installed = false;
let purchases = [];
let loading = false;

function money(v) { return `₦${Number(v || 0).toLocaleString()}`; }
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function dateText(value) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });
}

function install() {
  if (installed) return true;
  const panel = document.getElementById('panel-purchases');
  const history = document.getElementById('purchaseRows')?.closest('.bg-white');
  if (!panel || !history) return false;

  const section = document.createElement('div');
  section.id = 'purchaseCorrectionsPanel';
  section.className = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4';
  section.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="font-black text-lg">Purchase Corrections</h2>
        <p class="text-[11px] text-gray-400">Void a received purchase when it was entered incorrectly. The original record stays in history and the received stock is reversed.</p>
      </div>
      <button id="purchaseVoidRefresh" type="button" class="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-xs">Refresh</button>
    </div>
    <div class="grid md:grid-cols-[1fr_auto] gap-2">
      <select id="purchaseVoidSelect" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
        <option value="">Select a received purchase...</option>
      </select>
      <button id="voidPurchaseBtn" type="button" disabled class="bg-red-600 disabled:bg-gray-200 disabled:text-gray-400 text-white px-5 py-3 rounded-xl font-bold text-sm">Void Purchase</button>
    </div>
    <div id="purchaseVoidDetails" class="mt-3 hidden"></div>
    <p id="purchaseVoidMessage" class="text-xs mt-3 hidden"></p>`;
  history.insertAdjacentElement('afterend', section);
  installed = true;

  document.getElementById('purchaseVoidRefresh').onclick = loadPurchases;
  document.getElementById('purchaseVoidSelect').addEventListener('change', renderDetails);
  document.getElementById('voidPurchaseBtn').onclick = voidPurchase;
  loadPurchases();
  return true;
}

function renderOptions() {
  const select = document.getElementById('purchaseVoidSelect');
  const button = document.getElementById('voidPurchaseBtn');
  if (!select) return;
  const current = select.value;
  const active = purchases.filter(p => p.status !== 'voided');
  select.innerHTML = '<option value="">Select a received purchase...</option>' + active.map(p => {
    const name = `${p.productName || 'Product'} · ${p.variantLabel || ''}`;
    const ref = p.reference ? ` · ${p.reference}` : '';
    return `<option value="${escapeHtml(p.id)}">${escapeHtml(name)} · ${escapeHtml(p.supplier || 'Supplier')} · ${Number(p.quantity || 0).toLocaleString()} units · ${money(p.totalCost)}${escapeHtml(ref)}</option>`;
  }).join('');
  if (current && active.some(p => p.id === current)) select.value = current;
  else select.value = '';
  if (button) button.disabled = !select.value;
  renderDetails();
}

function renderDetails() {
  const id = document.getElementById('purchaseVoidSelect')?.value;
  const details = document.getElementById('purchaseVoidDetails');
  const button = document.getElementById('voidPurchaseBtn');
  if (!details) return;
  const p = purchases.find(x => x.id === id);
  if (!p) {
    details.classList.add('hidden');
    if (button) button.disabled = true;
    return;
  }
  details.innerHTML = `<div class="bg-red-50 border border-red-100 rounded-xl p-3">
    <p class="text-xs font-black text-red-700">This will reverse ${Number(p.quantity || 0).toLocaleString()} unit${Number(p.quantity || 0) === 1 ? '' : 's'} from inventory.</p>
    <p class="text-[10px] text-red-500 mt-1">${escapeHtml(p.productName || 'Product')} · ${escapeHtml(p.variantLabel || '')} · ${escapeHtml(p.supplier || 'Supplier')} · ${money(p.totalCost)} · ${dateText(p.createdAt)}</p>
    <p class="text-[10px] text-red-500 mt-1">The purchase record will remain in history as VOIDED. This action cannot be repeated.</p>
  </div>`;
  details.classList.remove('hidden');
  if (button) button.disabled = false;
}

function message(text, error = false) {
  const el = document.getElementById('purchaseVoidMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `text-xs mt-3 ${error ? 'text-red-500' : 'text-green-600'}`;
  el.classList.remove('hidden');
}

async function loadPurchases() {
  if (!currentUser || loading) return;
  const select = document.getElementById('purchaseVoidSelect');
  if (!select) return;
  loading = true;
  select.innerHTML = '<option value="">Loading purchases...</option>';
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    purchases = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    renderOptions();
  } catch (e) {
    purchases = [];
    select.innerHTML = '<option value="">Could not load purchases</option>';
    message(e.message || 'Could not load purchases.', true);
  } finally {
    loading = false;
  }
}

async function voidPurchase() {
  if (!currentUser) return message('Please log in first.', true);
  const id = document.getElementById('purchaseVoidSelect')?.value;
  const purchase = purchases.find(p => p.id === id);
  if (!purchase) return message('Select a purchase first.', true);
  if (purchase.status === 'voided') return message('This purchase has already been voided.', true);

  const qty = Number(purchase.quantity || 0);
  if (!Number.isInteger(qty) || qty <= 0) return message('This purchase has an invalid quantity and cannot be reversed.', true);
  if (!purchase.productId || !purchase.variantId) return message('This purchase is missing its product or variant reference.', true);

  const confirmed = window.confirm(`Void this purchase?\n\n${purchase.productName || 'Product'} · ${purchase.variantLabel || ''}\nQuantity: ${qty}\nValue: ${money(purchase.totalCost)}\n\nThis will reduce inventory by ${qty}.`);
  if (!confirmed) return;

  const button = document.getElementById('voidPurchaseBtn');
  if (button) { button.disabled = true; button.textContent = 'Voiding...'; }

  const purchaseRef = doc(db, 'purchases', id);
  const productRef = doc(db, 'products', purchase.productId);
  const movementRef = doc(collection(db, 'inventoryMovements'));

  try {
    await runTransaction(db, async tx => {
      const purchaseSnap = await tx.get(purchaseRef);
      if (!purchaseSnap.exists()) throw new Error('Purchase no longer exists.');
      const latest = purchaseSnap.data();
      if (latest.status === 'voided') throw new Error('This purchase has already been voided.');
      if (latest.status && latest.status !== 'received') throw new Error(`Purchase status is ${latest.status} and cannot be voided.`);

      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) throw new Error('The product linked to this purchase no longer exists.');
      const product = productSnap.data();
      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const index = variants.findIndex(v => v.id === latest.variantId);
      if (index < 0) throw new Error('The variant linked to this purchase no longer exists.');

      const current = Number(variants[index].stockQty || 0);
      const receivedQty = Number(latest.quantity || 0);
      if (!Number.isInteger(receivedQty) || receivedQty <= 0) throw new Error('Purchase quantity is invalid.');
      if (current < receivedQty) throw new Error(`Cannot void this purchase because current stock (${current}) is lower than the received quantity (${receivedQty}).`);

      const next = current - receivedQty;
      variants[index] = { ...variants[index], stockQty: next, inStock: next > 0 };
      tx.update(productRef, { variants, inStock: variants.some(v => Number(v.stockQty || 0) > 0) });
      tx.update(purchaseRef, {
        status: 'voided',
        voidedAt: serverTimestamp(),
        voidedQuantity: receivedQty,
        voidReason: 'Purchase voided / stock reversed'
      });
      tx.set(movementRef, {
        productId: latest.productId,
        variantId: latest.variantId,
        sku: latest.sku || variants[index].sku || '',
        productName: latest.productName || product.name || '',
        variantLabel: latest.variantLabel || '',
        type: 'purchase_voided',
        quantity: -receivedQty,
        previousQty: current,
        newQty: next,
        reason: 'Purchase voided / stock reversed',
        reference: latest.reference || latest.supplier || 'Purchase void',
        purchaseId: id,
        supplier: latest.supplier || '',
        unitCost: Number(latest.unitCost || 0),
        totalCost: Number(latest.totalCost || 0),
        createdAt: serverTimestamp()
      });
    });
    message(`Purchase voided successfully. ${qty} unit${qty === 1 ? '' : 's'} returned from stock.`, false);
    await loadPurchases();
  } catch (e) {
    message(e.message || 'Could not void purchase.', true);
    renderOptions();
  } finally {
    if (button) { button.textContent = 'Void Purchase'; button.disabled = !document.getElementById('purchaseVoidSelect')?.value; }
  }
}

function boot() {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) install();
  });
}

const observer = new MutationObserver(() => { if (currentUser) install(); });
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
boot();
