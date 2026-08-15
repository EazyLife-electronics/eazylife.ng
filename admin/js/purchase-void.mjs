// admin/js/purchase-void.mjs
// Safely voids a received purchase by reversing its stock effect.
// The original purchase record is retained for audit history.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, doc, runTransaction, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import './order-delivery-bridge.mjs';

const { db, auth } = initFirebase();
let currentUser = null;
let observerStarted = false;
let busy = false;

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function attachVoidButtons() {
  const rows = document.getElementById('purchaseRows');
  if (!rows || !currentUser) return;

  rows.querySelectorAll('[data-purchase-id]').forEach(row => {
    if (row.querySelector('.void-purchase-btn')) return;
    const id = row.dataset.purchaseId;
    const status = row.dataset.purchaseStatus || 'received';
    if (status !== 'received') return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'void-purchase-btn mt-2 md:mt-0 border border-red-200 text-red-500 bg-red-50 px-3 py-2 rounded-lg font-bold text-[10px]';
    button.textContent = 'Void Purchase';
    button.addEventListener('click', () => voidPurchase(id, button));

    const parent = row.querySelector('.purchase-actions');
    if (parent) parent.appendChild(button);
  });
}

async function voidPurchase(purchaseId, button) {
  if (!currentUser || busy) return;
  const confirmed = window.confirm('Void this purchase? Its received quantity will be removed from inventory. The purchase record will remain in history as VOIDED.');
  if (!confirmed) return;

  const reason = window.prompt('Reason for voiding this purchase (optional):', 'Purchase correction');
  if (reason === null) return;

  busy = true;
  button.disabled = true;
  button.textContent = 'Voiding...';

  const purchaseRef = doc(db, 'purchases', purchaseId);

  try {
    await runTransaction(db, async tx => {
      const purchaseSnap = await tx.get(purchaseRef);
      if (!purchaseSnap.exists()) throw new Error('Purchase record no longer exists.');

      const purchase = purchaseSnap.data();
      if (purchase.status && purchase.status !== 'received') {
        throw new Error(`This purchase is already ${String(purchase.status).toUpperCase()}.`);
      }

      const qty = Number(purchase.quantity || 0);
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('Purchase has an invalid quantity.');

      const productRef = doc(db, 'products', purchase.productId);
      const movementRef = doc(collection(db, 'inventoryMovements'));
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) throw new Error('The product linked to this purchase no longer exists.');

      const product = productSnap.data();
      const variants = Array.isArray(product.variants) ? [...product.variants] : [];
      const index = variants.findIndex(v => v.id === purchase.variantId);
      if (index < 0) throw new Error('The variant linked to this purchase no longer exists.');

      const current = Number(variants[index].stockQty || 0);
      if (current < qty) {
        throw new Error(`Cannot void this purchase: only ${current} unit${current === 1 ? '' : 's'} remain in stock, but the purchase added ${qty}. The stock has already been used or reduced.`);
      }

      const next = current - qty;
      variants[index] = { ...variants[index], stockQty: next, inStock: next > 0 };
      tx.update(productRef, { variants, inStock: variants.some(v => Number(v.stockQty || 0) > 0) });

      tx.update(purchaseRef, {
        status: 'voided',
        voidReason: reason.trim(),
        voidedAt: serverTimestamp(),
        voidedBy: currentUser.uid
      });

      tx.set(movementRef, {
        productId: purchase.productId,
        variantId: purchase.variantId,
        sku: purchase.sku || variants[index].sku || '',
        productName: purchase.productName || product.name || '',
        variantLabel: purchase.variantLabel || '',
        type: 'purchase_void',
        quantity: -qty,
        previousQty: current,
        newQty: next,
        reason: reason.trim() || 'Purchase voided',
        reference: purchase.reference || purchase.supplier || '',
        purchaseId,
        reversalOf: 'purchase_received',
        supplier: purchase.supplier || '',
        unitCost: Number(purchase.unitCost || 0),
        totalCost: Number(purchase.totalCost || 0),
        createdAt: serverTimestamp()
      });
    });

    button.textContent = 'Voided';
    button.className = 'void-purchase-btn mt-2 md:mt-0 border border-gray-200 text-gray-400 bg-gray-100 px-3 py-2 rounded-lg font-bold text-[10px]';
    const refresh = document.getElementById('purchaseHistoryRefresh');
    if (refresh) refresh.click();
  } catch (e) {
    button.disabled = false;
    button.textContent = 'Void Purchase';
    window.alert(e.message || 'Could not void purchase.');
  } finally {
    busy = false;
  }
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observe = () => {
    const rows = document.getElementById('purchaseRows');
    if (!rows) return;
    new MutationObserver(attachVoidButtons).observe(rows, { childList: true, subtree: true });
    attachVoidButtons();
  };
  if (document.body) {
    const bodyObserver = new MutationObserver(observe);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    observe();
  }
}

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (user) startObserver();
});
