// admin/js/shopeazy-orders.mjs
// ShopEazy order review, outlet allocation, and approval workspace.
// This first operational version is intentionally ADMIN-only. Partner Manager
// order visibility will be enabled after server-side order scoping is added.

import {
  watchOrders,
  getShopEazyFulfillmentGroups,
  createShopEazyFulfillmentGroup,
  allocateShopEazyOrderItem,
  getShopEazyOrderAllocationSummary,
  approveShopEazyOrder,
  getShopEazyOutlets
} from '../../js/store.mjs';

let access = null;
let orders = [];
let outlets = [];
let selectedOrderId = null;
let unsubscribe = null;

const esc = value => String(value ?? '')
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

export function initShopEazyOrders(nextAccess) {
  access = nextAccess;
  const root = document.getElementById('shopEazyOrdersContent');
  if (!root) return;

  if (access?.role !== 'ADMIN') {
    root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-500">ShopEazy order review is currently available to administrators.</div>';
    return;
  }

  root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-500">Loading ShopEazy orders…</div>';

  if (unsubscribe) unsubscribe();
  unsubscribe = watchOrders(nextOrders => {
    orders = nextOrders.filter(order => {
      const status = String(order.status || '').trim().toUpperCase();
      return !['CANCELLED','RETURNED'].includes(status);
    });
    if (!selectedOrderId && orders.length) selectedOrderId = orders[0].id;
    render();
  });

  loadOutlets();
}

async function loadOutlets() {
  try {
    outlets = await getShopEazyOutlets();
    render();
  } catch (error) {
    console.error(error);
  }
}

function render() {
  const root = document.getElementById('shopEazyOrdersContent');
  if (!root) return;

  root.innerHTML = `
    <div class="grid lg:grid-cols-[320px_1fr] gap-4">
      <section class="bg-white rounded-[24px] shadow-sm p-4">
        <div class="flex justify-between items-center mb-3">
          <div><h2 class="font-black text-lg">Order Review</h2><p class="text-xs text-gray-400">Review incoming ShopEazy orders.</p></div>
          <span class="text-[10px] font-bold bg-gray-100 rounded-full px-2 py-1">${orders.length}</span>
        </div>
        <div id="shopEazyOrderList" class="space-y-2"></div>
      </section>
      <section id="shopEazyOrderDetail"></section>
    </div>`;

  const list = document.getElementById('shopEazyOrderList');
  list.innerHTML = orders.length ? orders.map(order => {
    const active = order.id === selectedOrderId;
    const status = String(order.status || 'NEW').toUpperCase();
    const approval = String(order.approvalStatus || 'NOT_REVIEWED').toUpperCase();
    return `
      <button data-order-id="${esc(order.id)}" class="w-full text-left p-3 rounded-xl border ${active ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}">
        <div class="flex justify-between gap-2">
          <span class="font-mono text-[10px] font-black text-teal-600">${esc(order.trackingCode || order.id)}</span>
          <span class="text-[9px] font-bold">${esc(status)}</span>
        </div>
        <div class="font-bold text-sm mt-1">${esc(order.customerName || 'Customer')}</div>
        <div class="text-[10px] text-gray-400 mt-1">${esc(approval)} · ${(order.items || []).length} item(s)</div>
      </button>`;
  }).join('') : '<p class="text-xs text-gray-400 py-8 text-center">No incoming orders.</p>';

  list.querySelectorAll('[data-order-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedOrderId = btn.dataset.orderId;
      render();
    });
  });

  renderDetail();
}

async function renderDetail() {
  const root = document.getElementById('shopEazyOrderDetail');
  if (!root || !selectedOrderId) {
    if (root) root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-400">Select an order.</div>';
    return;
  }

  const order = orders.find(o => o.id === selectedOrderId);
  if (!order) {
    root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-400">Order no longer available.</div>';
    return;
  }

  root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-500">Loading allocation…</div>';

  try {
    const [groups, summary] = await Promise.all([
      getShopEazyFulfillmentGroups(order.id),
      getShopEazyOrderAllocationSummary(order.id)
    ]);
    renderDetailBody(order, groups, summary);
  } catch (error) {
    console.error(error);
    root.innerHTML = `<div class="bg-white rounded-[24px] p-6 text-sm text-red-500">${esc(error.message || 'Could not load this order.')}</div>`;
  }
}

function renderDetailBody(order, groups, summary) {
  const root = document.getElementById('shopEazyOrderDetail');
  const eligible = ['NEW','PROCESSING'].includes(String(order.status || '').toUpperCase()) && order.inventoryApplied !== true;
  const canAllocate = eligible;
  const groupsHtml = groups.length ? groups.map(group => `
    <div class="border border-gray-100 rounded-xl p-3">
      <div class="flex justify-between gap-2">
        <div><span class="font-bold text-sm">${esc(outletName(group.outletId))}</span><div class="text-[10px] text-gray-400">${esc(group.id)} · ${esc(group.status)}</div></div>
        <span class="text-[10px] font-bold">${group.items?.reduce((s,i)=>s+Number(i.quantityAllocated||0),0) || 0} allocated</span>
      </div>
      <div class="mt-2 space-y-1">${(group.items || []).map(item => `
        <div class="text-[11px] flex justify-between gap-2"><span>${esc(item.nameSnapshot || item.sku || item.variantId)}</span><span class="font-bold">${Number(item.quantityAllocated||0)}</span></div>
      `).join('') || '<div class="text-[10px] text-gray-400">No items allocated.</div>'}</div>
    </div>`).join('') : '<p class="text-xs text-gray-400">No fulfillment groups yet.</p>';

  root.innerHTML = `
    <div class="bg-white rounded-[24px] shadow-sm p-5">
      <div class="flex flex-wrap justify-between gap-3">
        <div>
          <div class="flex items-center gap-2"><h2 class="font-black text-lg">${esc(order.customerName || 'Customer')}</h2><span class="text-[9px] font-bold px-2 py-1 rounded-full bg-gray-100">${esc(String(order.status || 'NEW').toUpperCase())}</span></div>
          <p class="text-[10px] font-mono text-teal-600 font-bold mt-1">${esc(order.trackingCode || order.id)}</p>
          <p class="text-xs text-gray-400 mt-1">${esc(order.phone || '')} · ${esc(order.address || '')}</p>
        </div>
        <div class="text-right"><div class="font-black text-lg text-[#00B09B]">₦${Number(order.total || 0).toLocaleString()}</div><div class="text-[10px] text-gray-400">${esc(String(order.approvalStatus || 'NOT_REVIEWED').toUpperCase())}</div></div>
      </div>

      <div class="mt-5">
        <h3 class="font-black text-sm mb-2">Order Items</h3>
        <div class="space-y-2">${(order.items || []).map((item,index) => {
          const s = summary[index] || {};
          return `
            <div class="border border-gray-100 rounded-xl p-3">
              <div class="flex justify-between gap-3">
                <div><div class="font-bold text-sm">${esc(item.name || item.sku || 'Item')}</div><div class="text-[10px] text-gray-400">${esc(item.variant || item.sku || item.variantId || '')}</div></div>
                <div class="text-right"><div class="font-black text-sm">${Number(item.quantity || 0)} ordered</div><div class="text-[10px] text-gray-400">${Number(s.allocatedQuantity || 0)} allocated · ${Number(s.unallocatedQuantity || 0)} unallocated</div></div>
              </div>
              ${canAllocate ? allocationControls(order.id, index, groups) : ''}
            </div>`;
        }).join('')}</div>
      </div>

      <div class="mt-5">
        <div class="flex justify-between items-center mb-2"><h3 class="font-black text-sm">Fulfillment Groups</h3><button id="newFulfillmentGroup" class="text-[10px] font-bold bg-gray-900 text-white px-3 py-2 rounded-lg" ${canAllocate ? '' : 'disabled'}>+ Add Outlet Group</button></div>
        <div id="groupList" class="space-y-2">${groupsHtml}</div>
      </div>

      ${canAllocate ? `
      <div class="mt-5 border-t pt-4">
        <h3 class="font-black text-sm">Approve Order</h3>
        <p class="text-[10px] text-gray-400 mt-1">Approval is the point where allocated quantities are atomically deducted from outlet stock.</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button id="approveFull" class="bg-gray-900 text-white px-4 py-3 rounded-xl text-xs font-bold">Approve Fully</button>
          <button id="approvePartial" class="bg-gray-100 text-gray-800 px-4 py-3 rounded-xl text-xs font-bold">Approve Partial</button>
        </div>
      </div>` : ''}
    </div>`;

  document.getElementById('newFulfillmentGroup')?.addEventListener('click', createGroup);
  document.getElementById('approveFull')?.addEventListener('click', () => approve('FULL'));
  document.getElementById('approvePartial')?.addEventListener('click', () => approve('PARTIAL'));
  bindAllocationControls(order.id);
}

function allocationControls(orderId, index, groups) {
  const activeGroups = groups.filter(g => ['UNALLOCATED','ALLOCATED'].includes(String(g.status || '').toUpperCase()));
  if (!activeGroups.length) return '<div class="mt-3 text-[10px] text-gray-400">Create an outlet group first, then allocate this item.</div>';
  return `
    <div class="mt-3 grid grid-cols-[1fr_100px_auto] gap-2 items-end">
      <label class="text-[10px] text-gray-500">Outlet group
        <select id="allocGroup-${index}" class="w-full mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
          ${activeGroups.map(g => `<option value="${esc(g.id)}">${esc(outletName(g.outletId))}</option>`).join('')}
        </select>
      </label>
      <label class="text-[10px] text-gray-500">Quantity
        <input id="allocQty-${index}" type="number" min="0" step="1" value="0" class="w-full mt-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs">
      </label>
      <button data-allocate-index="${index}" class="bg-gray-900 text-white px-3 py-2 rounded-lg text-[10px] font-bold">Allocate</button>
    </div>`;
}

function bindAllocationControls(orderId) {
  document.querySelectorAll('[data-allocate-index]').forEach(btn => btn.addEventListener('click', async () => {
    const index = Number(btn.dataset.allocateIndex);
    const groupId = document.getElementById(`allocGroup-${index}`).value;
    const quantity = Number(document.getElementById(`allocQty-${index}`).value);
    if (!Number.isInteger(quantity) || quantity < 0) return alert('Enter a valid non-negative quantity.');
    btn.disabled = true;
    try {
      await allocateShopEazyOrderItem({ orderId, groupId, orderItemIndex:index, quantityAllocated:quantity, actorUid:access.uid });
      await renderDetail();
    } catch (error) {
      alert(error.message || 'Could not allocate this item.');
      btn.disabled = false;
    }
  }));
}

async function createGroup() {
  if (!selectedOrderId) return;
  const active = outlets.filter(o => String(o.status || '').toUpperCase() === 'ACTIVE' && o.fulfillmentEnabled === true);
  if (!active.length) return alert('No active fulfillment-enabled outlets are available.');
  const names = active.map((o,i) => `${i+1}. ${o.name}`).join('\\n');
  const choice = prompt(`Choose an outlet by number:\\n\\n${names}`, '1');
  const index = Number(choice) - 1;
  const outlet = active[index];
  if (!outlet) return;
  try {
    await createShopEazyFulfillmentGroup({ orderId:selectedOrderId, outletId:outlet.id });
    await renderDetail();
  } catch (error) {
    alert(error.message || 'Could not create outlet group.');
  }
}

async function approve(mode) {
  if (!selectedOrderId) return;
  const order = orders.find(o => o.id === selectedOrderId);
  if (!order) return;
  if (mode === 'FULL' && !confirm('Approve this order fully and deduct the allocated quantities from outlet stock?')) return;
  if (mode === 'PARTIAL') {
    const resolutionPath = prompt('Partial resolution: WAIT_FOR_STOCK, CUSTOMER_ACCEPTED, SUBSTITUTION, or CANCEL_REMAINDER', 'WAIT_FOR_STOCK');
    if (!resolutionPath) return;
    const normalized = resolutionPath.trim().toUpperCase();
    if (!['WAIT_FOR_STOCK','CUSTOMER_ACCEPTED','SUBSTITUTION','CANCEL_REMAINDER'].includes(normalized)) return alert('Invalid partial resolution path.');
    const note = prompt('Optional resolution note:', '') || null;
    if (!confirm('Approve the currently allocated quantities and leave the remainder explicit?')) return;
    try {
      await approveShopEazyOrder({ orderId:selectedOrderId, actorUid:access.uid, approvalMode:mode, resolutionPath:normalized, resolutionNote:note });
      await renderDetail();
    } catch (error) { alert(error.message || 'Approval failed.'); }
    return;
  }
  try {
    await approveShopEazyOrder({ orderId:selectedOrderId, actorUid:access.uid, approvalMode:mode });
    await renderDetail();
  } catch (error) { alert(error.message || 'Approval failed.'); }
}

function outletName(id) { return outlets.find(o => o.id === id)?.name || id || 'Unknown outlet'; }
