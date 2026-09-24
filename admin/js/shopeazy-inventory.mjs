// admin/js/shopeazy-inventory.mjs
// ShopEazy outlet inventory setup and controlled stock adjustment UI.

import {
  getProducts,
  getShopEazyOutlets,
  getShopEazyOutletInventoryForOutlet,
  setShopEazyOutletInventory,
  adjustShopEazyOutletInventory
} from '../../js/store.mjs';

let access = null;
let products = [];
let outlets = [];
let selectedOutletId = null;

const esc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export async function initShopEazyInventory(nextAccess) {
  access = nextAccess;
  const root = document.getElementById('inventoryContent');
  if (!root) return;
  root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-500">Loading outlet inventory…</div>';

  if (!['ADMIN','PARTNER_MANAGER'].includes(access?.role)) {
    root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-500">Outlet inventory management is not enabled for this role.</div>';
    return;
  }

  try {
    [products, outlets] = await Promise.all([getProducts(), getShopEazyOutlets({ activeOnly: false })]);
    if (access.role === 'PARTNER_MANAGER' && access.partnerId) {
      outlets = outlets.filter(o => o.partnerId === access.partnerId);
    }
    selectedOutletId = outlets.find(o => o.status === 'ACTIVE' && o.fulfillmentEnabled)?.id || outlets[0]?.id || null;
    render();
  } catch (error) {
    console.error(error);
    root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-red-500">Could not load inventory data. Check your access and Firestore rules.</div>';
  }
}

function productVariants() {
  return products.flatMap(p => (Array.isArray(p.variants) ? p.variants : []).map((v,i) => ({
    productId:p.id, product:p, variant:v, index:i, variantId:v?.id || String(i)
  })));
}

function render() {
  const root = document.getElementById('inventoryContent');
  root.innerHTML = `
    <div class="bg-white rounded-[24px] shadow-sm p-5 mb-4">
      <div class="flex flex-wrap justify-between gap-3 items-center">
        <div><h2 class="font-black text-lg">Outlet Inventory</h2><p class="text-xs text-gray-400">Stock is maintained per outlet and product variant. Legacy product stock is not changed.</p></div>
        <select id="inventoryOutlet" class="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"></select>
      </div>
    </div>
    <div class="grid lg:grid-cols-2 gap-4">
      <section class="bg-white rounded-[24px] shadow-sm p-5">
        <h3 class="font-black mb-1">Initialize / Set Stock</h3>
        <p class="text-xs text-gray-400 mb-4">Use this for initial outlet stock or a controlled reconciliation value.</p>
        <form id="inventorySetForm" class="space-y-2">
          <select id="setVariant" required class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"></select>
          <input id="setQty" type="number" min="0" step="1" required placeholder="Quantity on hand" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <input id="setReorder" type="number" min="0" step="1" value="0" placeholder="Reorder level" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <input id="setCost" type="number" min="0" step="0.01" placeholder="Cost price (optional)" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <button class="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-bold">Save Stock Record</button>
        </form>
      </section>
      <section class="bg-white rounded-[24px] shadow-sm p-5">
        <h3 class="font-black mb-1">Stock Adjustment</h3>
        <p class="text-xs text-gray-400 mb-4">Every adjustment creates an inventory movement record.</p>
        <form id="inventoryAdjustForm" class="space-y-2">
          <select id="adjustVariant" required class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"></select>
          <input id="adjustQty" type="number" step="1" required placeholder="Change (+ receipt / - correction)" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <select id="adjustType" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
            <option value="receipt">Receipt</option><option value="correction">Correction</option><option value="transferIn">Transfer In</option><option value="transferOut">Transfer Out</option>
          </select>
          <input id="adjustReason" required placeholder="Reason / reference" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <button class="w-full bg-gray-900 text-white py-3 rounded-xl text-xs font-bold">Apply Adjustment</button>
        </form>
      </section>
    </div>
    <section class="bg-white rounded-[24px] shadow-sm p-5 mt-4">
      <div class="flex justify-between items-center mb-3"><div><h3 class="font-black">Current Stock</h3><p id="inventoryCount" class="text-xs text-gray-400"></p></div><button id="refreshInventory" class="text-xs font-bold text-gray-600">Refresh</button></div>
      <div id="inventoryList" class="space-y-2"></div>
    </section>`;

  const outletSelect = document.getElementById('inventoryOutlet');
  outletSelect.innerHTML = outlets.map(o => `<option value="${esc(o.id)}">${esc(o.name)} — ${esc(o.status)}</option>`).join('');
  if (selectedOutletId) outletSelect.value = selectedOutletId;
  fillVariants('setVariant');
  fillVariants('adjustVariant');
  outletSelect.addEventListener('change', async e => { selectedOutletId=e.target.value; await renderInventoryList(); });
  document.getElementById('inventorySetForm').addEventListener('submit', setStock);
  document.getElementById('inventoryAdjustForm').addEventListener('submit', adjustStock);
  document.getElementById('refreshInventory').addEventListener('click', renderInventoryList);
  renderInventoryList();
}

function fillVariants(id) {
  const select=document.getElementById(id);
  select.innerHTML=productVariants().map(x => {
    const label=[x.product.name, x.variant.name, x.variant.sku].filter(Boolean).join(' · ');
    return `<option value="${esc(x.productId)}::${esc(x.variantId)}">${esc(label || x.variantId)}</option>`;
  }).join('');
}

function selectedVariant(id) {
  const [productId, ...rest] = document.getElementById(id).value.split('::');
  const variantId=rest.join('::');
  return productVariants().find(x=>x.productId===productId && x.variantId===variantId);
}

async function setStock(event) {
  event.preventDefault();
  try {
    const x=selectedVariant('setVariant');
    if(!x || !selectedOutletId) throw new Error('Select an outlet and product variant.');
    await setShopEazyOutletInventory({
      outletId:selectedOutletId, productId:x.productId, variantId:x.variantId,
      quantityOnHand:Number(document.getElementById('setQty').value),
      reorderLevel:Number(document.getElementById('setReorder').value),
      costPrice:document.getElementById('setCost').value === '' ? (x.variant.costPrice ?? null) : Number(document.getElementById('setCost').value)
    });
    alert('Stock record saved.');
    await renderInventoryList();
  } catch(error) { alert(error.message || 'Could not save stock record.'); }
}

async function adjustStock(event) {
  event.preventDefault();
  try {
    const x=selectedVariant('adjustVariant');
    if(!x || !selectedOutletId) throw new Error('Select an outlet and product variant.');
    await adjustShopEazyOutletInventory({
      outletId:selectedOutletId, variantId:x.variantId,
      quantityChange:Number(document.getElementById('adjustQty').value),
      movementType:document.getElementById('adjustType').value,
      reason:document.getElementById('adjustReason').value.trim(),
      actorUid:access?.uid || null
    });
    alert('Stock adjustment applied.');
    document.getElementById('adjustForm')?.reset();
    await renderInventoryList();
  } catch(error) { alert(error.message || 'Could not adjust stock.'); }
}

async function renderInventoryList() {
  const list=document.getElementById('inventoryList');
  const count=document.getElementById('inventoryCount');
  if(!list || !selectedOutletId) return;
  try {
    const items=await getShopEazyOutletInventoryForOutlet(selectedOutletId,{activeOnly:false});
    count.textContent=`${items.length} inventory records`;
    list.innerHTML=items.length ? items.map(item=>`
      <div class="flex justify-between gap-3 p-3 rounded-xl border border-gray-100">
        <div><div class="font-bold text-sm">${esc(productName(item.productId))}</div><div class="text-[10px] text-gray-400">SKU: ${esc(item.sku || item.variantId)}</div></div>
        <div class="text-right"><div class="font-black text-sm">${esc(item.quantityOnHand)}</div><div class="text-[10px] text-gray-400">reorder ${esc(item.reorderLevel ?? 0)}</div></div>
      </div>`).join('') : '<p class="text-xs text-gray-400">No inventory records for this outlet yet.</p>';
  } catch(error) { list.innerHTML='<p class="text-xs text-red-500">Could not load stock records.</p>'; }
}
function productName(id){ return products.find(p=>p.id===id)?.name || id; }
