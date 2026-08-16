// admin/js/delivery.mjs
import { watchOrders } from '../../js/store.mjs';
import {
  watchDeliveryPersonnel, addDeliveryPersonnel, updateDeliveryPersonnel, deleteDeliveryPersonnel,
  watchDeliveryTypes, addDeliveryType, updateDeliveryType, deleteDeliveryType,
  watchDeliveryCheckpoints, addDeliveryCheckpoint, updateDeliveryCheckpoint, deleteDeliveryCheckpoint,
  watchDeliveries, updateDelivery
} from './delivery-store.mjs';
import { DELIVERY_STATE_LABELS, isOrderEligibleForDelivery } from './delivery-lifecycle.mjs';
import { createDeliveryForOrder, transitionDelivery, deliveryContactUrl } from './delivery-operations.mjs';
import { deliveryDetailModel } from './delivery-details.mjs';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = v => `₦${Number(v || 0).toLocaleString()}`;
const stateLabel = s => DELIVERY_STATE_LABELS[s] || s || 'Unknown';
const eligible = () => orders.filter(isOrderEligibleForDelivery);
const activeDeliveryForOrder = orderId => deliveries.find(d => d.orderId === orderId && !['cancelled', 'returned'].includes(d.status));
const DELIVERY_STATE_ORDER_FOR_STATS = ['ready', 'assigned', 'picked_up', 'in_transit', 'checkpoint', 'delivered', 'failed', 'returned'];

// `root` is looked up lazily inside render()/initDelivery() rather than once
// at module load, since this module is now loaded as a tab of admin/index.html
// (via initDelivery(), only once the Delivery tab is first clicked) instead
// of always being the sole content of a dedicated admin/delivery.html page.
let root = null;
let personnel = [], types = [], checkpoints = [], orders = [], deliveries = [];
let unsubs = [];

function render() {
  if (!root) return;
  root.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      <div class="bg-white rounded-2xl p-4 shadow-sm"><small>Eligible orders</small><b>${eligible().length}</b></div>
      <div class="bg-white rounded-2xl p-4 shadow-sm"><small>Active deliveries</small><b>${deliveries.filter(d => !['delivered', 'cancelled', 'returned'].includes(d.status)).length}</b></div>
      <div class="bg-white rounded-2xl p-4 shadow-sm"><small>Personnel</small><b>${personnel.filter(p => p.active !== false).length}</b></div>
      <div class="bg-white rounded-2xl p-4 shadow-sm"><small>Checkpoints</small><b>${checkpoints.length}</b></div>
    </div>
    <div class="flex gap-2 overflow-x-auto mb-4">
      <button class="sub" data-section="queue">Delivery Queue</button>
      <button class="sub" data-section="people">Personnel</button>
      <button class="sub" data-section="types">Types</button>
      <button class="sub" data-section="checkpoints">Checkpoints</button>
    </div>
    <div id="deliverySubpanel"></div>`;
  root.querySelectorAll('.sub').forEach(b => {
    b.className = 'sub px-4 py-2 rounded-full bg-gray-100 text-xs font-bold whitespace-nowrap';
    b.onclick = () => {
      root.querySelectorAll('.sub').forEach(x => x.className = 'sub px-4 py-2 rounded-full bg-gray-100 text-xs font-bold whitespace-nowrap');
      b.classList.add('bg-gray-900', 'text-white');
      section(b.dataset.section);
    };
  });
  root.querySelector('.sub[data-section="queue"]').classList.add('bg-gray-900', 'text-white');
  section('queue');
}

function section(s) {
  const e = document.getElementById('deliverySubpanel');
  if (s === 'queue') queue(e);
  if (s === 'people') people(e);
  if (s === 'types') typesUI(e);
  if (s === 'checkpoints') checkpointsUI(e);
}

/* ---------------- QUEUE ---------------- */

function statusBreakdown() {
  const counts = DELIVERY_STATE_ORDER_FOR_STATS.reduce((acc, s) => (acc[s] = deliveries.filter(d => (d.status || 'ready') === s).length, acc), {});
  return DELIVERY_STATE_ORDER_FOR_STATS.map(s => `
    <div class="bg-white rounded-xl border border-gray-100 p-2.5 text-center">
      <div class="text-lg font-black text-gray-800">${counts[s] || 0}</div>
      <div class="text-[9px] font-bold uppercase text-gray-400">${esc(stateLabel(s))}</div>
    </div>`).join('');
}

function queue(el) {
  const list = eligible();
  el.innerHTML = `
    <div class="bg-white rounded-2xl p-5 shadow-sm mb-4">
      <h2 class="font-black text-lg">Delivery Queue</h2>
      <p class="text-xs text-gray-400 mb-3">Only confirmed/shipped orders can enter delivery.</p>
      <div class="grid grid-cols-4 md:grid-cols-8 gap-2">${statusBreakdown()}</div>
    </div>
    <div class="grid gap-3">${list.length ? list.map(card).join('') : '<div class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400">No eligible orders.</div>'}</div>`;

  el.querySelectorAll('[data-create]').forEach(b => b.onclick = () => assign(b.dataset.create));
  el.querySelectorAll('[data-next]').forEach(b => b.onclick = () => advance(b.dataset.id, b.dataset.next));

  // Reassign personnel/type on an existing (not-yet-delivered) delivery —
  // merged in from the standalone delivery-details.html, which allowed this
  // and the current queue previously didn't (only assignable at creation).
  el.querySelectorAll('[data-reassign-person]').forEach(sel => sel.onchange = async () => {
    const p = personnel.find(x => x.id === sel.value);
    try {
      await updateDelivery(sel.dataset.reassignPerson, {
        assignedTo: p?.id || null, assignedToName: p?.name || '', assignedToPhone: p?.phone || '', updatedAt: Date.now()
      });
    } catch (err) { alert(`Could not reassign personnel: ${err.message}`); }
  });
  el.querySelectorAll('[data-reassign-type]').forEach(sel => sel.onchange = async () => {
    const t = types.find(x => x.id === sel.value);
    try {
      await updateDelivery(sel.dataset.reassignType, { deliveryTypeId: t?.id || null, deliveryType: t?.name || '', updatedAt: Date.now() });
    } catch (err) { alert(`Could not change delivery type: ${err.message}`); }
  });

  // Record a checkpoint via dropdown instead of a prompt() dialog — merged
  // in from delivery-details.html. Kept as a direct updateDelivery (not
  // routed through the transition validator) because recording a second or
  // third checkpoint while status is already 'checkpoint' is a same-state
  // update, and the transition validator intentionally rejects those.
  el.querySelectorAll('[data-record-checkpoint]').forEach(sel => sel.onchange = async () => {
    if (!sel.value) return;
    const d = deliveries.find(x => x.id === sel.dataset.recordCheckpoint);
    if (!d) return;
    try {
      await updateDelivery(d.id, {
        status: d.status === 'in_transit' ? 'checkpoint' : d.status,
        lastCheckpointId: sel.value,
        lastCheckpointAt: Date.now(),
        updatedAt: Date.now(),
        checkpoints: [...(d.checkpoints || []), { checkpointId: sel.value, at: Date.now() }]
      });
    } catch (err) {
      alert(err.message);
    } finally {
      sel.value = '';
    }
  });
}

function card(o) {
  const d = activeDeliveryForOrder(o.id);
  if (!d) return `
    <article class="bg-white rounded-2xl p-4 shadow-sm">
      <div class="flex justify-between">
        <div>
          <b>${esc(o.trackingCode || o.id)}</b>
          <p class="text-sm">${esc(o.customerName || o.customer?.name || 'Customer')}</p>
          <p class="text-xs text-gray-400">${esc(o.address || o.customer?.address || 'No address')}</p>
        </div>
        <b>${money(o.total || o.amount)}</b>
      </div>
      <div class="grid md:grid-cols-3 gap-2 mt-4">
        <select id="p-${o.id}" class="border rounded-xl p-2 text-xs"><option value="">Assign personnel</option>${personnel.filter(p => p.active !== false).map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
        <select id="t-${o.id}" class="border rounded-xl p-2 text-xs"><option value="">Delivery type</option>${types.filter(t => t.active !== false).map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select>
        <button data-create="${esc(o.id)}" class="bg-gray-900 text-white rounded-xl text-xs font-bold">Create Delivery</button>
      </div>
    </article>`;
  return deliveryCard(d, o);
}

function deliveryCard(d, o) {
  const next = { ready: 'assigned', assigned: 'picked_up', picked_up: 'in_transit', in_transit: 'checkpoint', checkpoint: 'delivered', failed: 'assigned', returned: 'assigned' }[d.status];
  // Resolved names/phone via the shared model instead of re-doing the
  // personnel/type/checkpoint lookups inline (merged in from delivery-details.mjs,
  // which previously wasn't imported by anything).
  const model = deliveryDetailModel(d, personnel, types, checkpoints);
  const showCheckpointPicker = ['in_transit', 'checkpoint'].includes(d.status);
  return `
    <article class="bg-white rounded-2xl p-4 shadow-sm">
      <div class="flex justify-between gap-3">
        <div>
          <b>${esc(o.trackingCode || d.orderId)}</b>
          <p class="text-sm">${esc(d.customerName || o.customerName || 'Customer')}</p>
          <p class="text-xs text-gray-400">${esc(d.address || o.address || 'No address')}</p>
        </div>
        <span class="px-2 py-1 rounded-full bg-teal-50 text-teal-700 text-[10px] font-black h-fit">${esc(stateLabel(d.status))}</span>
      </div>
      <div class="grid md:grid-cols-3 gap-2 mt-4 text-xs">
        <label class="block">
          <span class="text-[10px] font-black uppercase text-gray-400">Personnel</span>
          <select data-reassign-person="${d.id}" class="w-full mt-1 border rounded-lg p-2">
            <option value="">Unassigned</option>
            ${personnel.filter(x => x.active !== false || x.id === d.assignedTo).map(x => `<option value="${x.id}" ${d.assignedTo === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
          </select>
        </label>
        <label class="block">
          <span class="text-[10px] font-black uppercase text-gray-400">Type</span>
          <select data-reassign-type="${d.id}" class="w-full mt-1 border rounded-lg p-2">
            <option value="">Not selected</option>
            ${types.filter(x => x.active !== false || x.id === (d.deliveryTypeId || d.deliveryType)).map(x => `<option value="${x.id}" ${(d.deliveryTypeId || d.deliveryType) === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
          </select>
        </label>
        <div class="bg-gray-50 rounded-lg p-2">
          <span class="text-[10px] font-black uppercase text-gray-400">Checkpoint</span>
          <div class="mt-0.5">${esc(model.checkpointName)}</div>
        </div>
      </div>
      ${showCheckpointPicker ? `
      <label class="block mt-3">
        <span class="text-[10px] font-black uppercase text-gray-400">Record checkpoint</span>
        <select data-record-checkpoint="${d.id}" class="w-full mt-1 border rounded-lg p-2 text-xs">
          <option value="">Select checkpoint passed...</option>
          ${checkpoints.filter(c => c.active !== false).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
      </label>` : ''}
      <div class="flex flex-wrap gap-2 mt-3">
        ${next ? `<button data-id="${d.id}" data-next="${next}" class="bg-gray-900 text-white rounded-xl px-3 py-2 text-xs font-bold">${esc(stateLabel(next))}</button>` : ''}
        ${['picked_up', 'in_transit', 'checkpoint'].includes(d.status) ? `<button data-id="${d.id}" data-next="failed" class="border border-red-200 text-red-600 rounded-xl px-3 py-2 text-xs font-bold">Failed</button>` : ''}
        ${['picked_up', 'in_transit', 'checkpoint'].includes(d.status) ? `<button data-id="${d.id}" data-next="returned" class="border border-amber-200 text-amber-700 rounded-xl px-3 py-2 text-xs font-bold">Returned</button>` : ''}
        ${model.personnelPhone ? `<a href="${deliveryContactUrl(model.personnelPhone, `Hi ${model.personnelName}, checking in on delivery ${o.trackingCode || d.orderId}.`)}" target="_blank" class="border rounded-xl px-3 py-2 text-xs font-bold"><i class="fab fa-whatsapp"></i> Message rider</a>` : ''}
      </div>
    </article>`;
}

async function assign(orderId) {
  const o = orders.find(x => x.id === orderId);
  const pid = document.getElementById(`p-${orderId}`).value;
  const tid = document.getElementById(`t-${orderId}`).value;
  if (!pid || !tid) return alert('Select personnel and delivery type.');
  const p = personnel.find(x => x.id === pid), t = types.find(x => x.id === tid);
  try {
    await createDeliveryForOrder(o, { deliveryTypeId: tid, deliveryType: t?.name || '', personnelId: pid, personnelName: p?.name || '' });
  } catch (e) {
    alert(e.message);
  }
}

async function advance(id, next) {
  const d = deliveries.find(x => x.id === id);
  if (!d) return;
  try {
    await transitionDelivery(d, next);
  } catch (e) {
    alert(e.message);
  }
}

/* ---------------- PERSONNEL ---------------- */

function people(el) {
  el.innerHTML = `<div class="bg-white rounded-2xl p-5 shadow-sm mb-4"><div class="flex items-center justify-between mb-4"><div><h2 class="font-black text-lg">Delivery Personnel</h2><p class="text-xs text-gray-400">Manage your delivery team and contact details.</p></div><span class="px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-[10px] font-black">${personnel.length} RECORD${personnel.length === 1 ? '' : 'S'}</span></div><form id="personForm" class="grid md:grid-cols-4 gap-3"><input type="hidden" id="personEditId"><input id="personName" required class="border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-200" placeholder="Full name"><input id="personPhone" required class="border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-200" placeholder="Phone"><input id="personEmail" type="email" class="border rounded-xl px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-teal-200" placeholder="Email"><select id="personActive" class="border rounded-xl px-3 py-3 text-sm"><option value="true">Active</option><option value="false">Inactive</option></select><div class="md:col-span-4 flex gap-2"><button id="personSubmit" type="submit" class="flex-1 bg-gray-900 text-white rounded-xl px-4 py-3 font-bold text-sm">Add Delivery Personnel</button><button id="personCancel" type="button" class="hidden bg-gray-100 text-gray-600 rounded-xl px-4 py-3 font-bold text-sm">Cancel</button></div></form></div><div class="grid gap-3">${personnel.length ? personnel.map(p => `<article class="bg-white rounded-2xl p-4 shadow-sm"><div class="flex justify-between gap-3"><div><div class="flex items-center gap-2"><b>${esc(p.name)}</b><span class="px-2 py-1 rounded-full text-[10px] font-black ${p.active === false ? 'bg-gray-100 text-gray-500' : 'bg-teal-50 text-teal-700'}">${p.active === false ? 'INACTIVE' : 'ACTIVE'}</span></div><p class="text-sm text-gray-500 mt-1">${esc(p.phone || 'No phone')}${p.email ? ` · ${esc(p.email)}` : ''}</p></div><button type="button" data-edit="${p.id}" class="border rounded-xl px-3 py-2 text-xs font-bold">Edit</button></div><div class="flex flex-wrap gap-2 mt-4"><a class="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold" href="${deliveryContactUrl(p.phone)}" target="_blank">WhatsApp</a><a class="px-3 py-2 rounded-lg border text-xs font-bold" href="tel:${esc(p.phone || '')}">Call</a><button type="button" data-toggle="${p.id}" data-active="${p.active !== false}" class="px-3 py-2 rounded-lg border text-xs font-bold">${p.active === false ? 'Activate' : 'Deactivate'}</button><button type="button" data-delete="${p.id}" class="px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-bold">Delete</button></div></article>`).join('') : '<div class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400">No delivery personnel yet.</div>'}</div>`;
  const form = el.querySelector('#personForm');
  form.onsubmit = async e => {
    e.preventDefault();
    const editId = el.querySelector('#personEditId').value;
    const name = el.querySelector('#personName').value.trim();
    const phone = el.querySelector('#personPhone').value.trim();
    const email = el.querySelector('#personEmail').value.trim();
    const active = el.querySelector('#personActive').value === 'true';
    if (!name || !phone) return alert('Name and phone are required.');
    try {
      if (editId) {
        await updateDeliveryPersonnel(editId, { name, phone, email, active, updatedAt: Date.now() });
      } else {
        await addDeliveryPersonnel({ name, phone, email, active, createdAt: Date.now(), updatedAt: Date.now() });
      }
      form.reset();
      el.querySelector('#personEditId').value = '';
      el.querySelector('#personSubmit').textContent = 'Add Delivery Personnel';
      el.querySelector('#personCancel').classList.add('hidden');
    } catch (err) { alert(`Could not save personnel: ${err.message}`); }
  };
  el.querySelector('#personCancel').onclick = () => {
    form.reset();
    el.querySelector('#personEditId').value = '';
    el.querySelector('#personSubmit').textContent = 'Add Delivery Personnel';
    el.querySelector('#personCancel').classList.add('hidden');
  };
  el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const p = personnel.find(x => x.id === b.dataset.edit);
    if (!p) return;
    el.querySelector('#personEditId').value = p.id;
    el.querySelector('#personName').value = p.name || '';
    el.querySelector('#personPhone').value = p.phone || '';
    el.querySelector('#personEmail').value = p.email || '';
    el.querySelector('#personActive').value = p.active === false ? 'false' : 'true';
    el.querySelector('#personSubmit').textContent = 'Save Personnel';
    el.querySelector('#personCancel').classList.remove('hidden');
    el.querySelector('#personName').focus();
  });
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    try { await updateDeliveryPersonnel(b.dataset.toggle, { active: b.dataset.active !== 'true', updatedAt: Date.now() }); }
    catch (err) { alert(`Could not update personnel: ${err.message}`); }
  });
  el.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this delivery personnel?')) return;
    try { await deleteDeliveryPersonnel(b.dataset.delete); }
    catch (err) { alert(`Could not delete personnel: ${err.message}`); }
  });
}

/* ---------------- TYPES ---------------- */
// Was prompt()-based; replaced with a proper form + active toggle + delete,
// merged in from the standalone admin/delivery-types.html page.

function typesUI(el) {
  el.innerHTML = `
    <div class="bg-white rounded-2xl p-5 shadow-sm mb-4">
      <div class="flex items-center justify-between mb-3"><h2 class="font-black text-lg">Delivery Types</h2><p class="text-xs text-gray-400">Define how an order gets to the customer.</p></div>
      <form id="typeForm" class="grid md:grid-cols-[1fr_2fr_auto] gap-2">
        <input id="typeName" required class="border rounded-xl px-3 py-2 text-sm" placeholder="Type name e.g. Home Delivery">
        <input id="typeDesc" class="border rounded-xl px-3 py-2 text-sm" placeholder="Description">
        <button class="bg-gray-900 text-white rounded-xl px-5 py-2 font-bold text-sm">+ Add</button>
      </form>
    </div>
    <div class="grid md:grid-cols-2 gap-3">
      ${types.length ? types.map(t => `
        <article class="bg-white rounded-2xl p-4 shadow-sm">
          <div class="flex justify-between gap-3">
            <div><b class="text-sm">${esc(t.name)}</b><p class="text-xs text-gray-400 mt-0.5">${esc(t.description || '')}</p></div>
            <span class="text-[10px] font-black h-fit px-2 py-1 rounded-full ${t.active !== false ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}">${t.active !== false ? 'ACTIVE' : 'INACTIVE'}</span>
          </div>
          <div class="flex gap-2 mt-3">
            <button data-toggle="${t.id}" data-active="${t.active !== false}" class="px-3 py-1.5 rounded-lg border text-[11px] font-bold">${t.active !== false ? 'Disable' : 'Enable'}</button>
            <button data-delete="${t.id}" class="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-[11px] font-bold">Delete</button>
          </div>
        </article>`).join('') : '<div class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400 md:col-span-2">No delivery types yet.</div>'}
    </div>`;

  el.querySelector('#typeForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = el.querySelector('#typeName').value.trim();
    if (!name) return;
    try {
      await addDeliveryType({ name, description: el.querySelector('#typeDesc').value.trim(), active: true, createdAt: Date.now(), updatedAt: Date.now() });
      e.target.reset();
    } catch (err) { alert(`Could not add delivery type: ${err.message}`); }
  });
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    try { await updateDeliveryType(b.dataset.toggle, { active: b.dataset.active !== 'true', updatedAt: Date.now() }); }
    catch (err) { alert(`Could not update type: ${err.message}`); }
  });
  el.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this delivery type?')) return;
    try { await deleteDeliveryType(b.dataset.delete); }
    catch (err) { alert(`Could not delete type: ${err.message}`); }
  });
}

/* ---------------- CHECKPOINTS ---------------- */
// Was prompt()-based; replaced with a proper form + active toggle + delete,
// merged in from the standalone admin/delivery-checkpoints.html page (which
// only had add + delete — the active toggle is added here for parity with Types).

function checkpointsUI(el) {
  el.innerHTML = `
    <div class="bg-white rounded-2xl p-5 shadow-sm mb-4">
      <div class="flex items-center justify-between mb-3"><h2 class="font-black text-lg">Delivery Checkpoints</h2><p class="text-xs text-gray-400">Places or stages used while tracking a delivery in transit.</p></div>
      <form id="checkpointForm" class="grid md:grid-cols-[1fr_2fr_auto] gap-2">
        <input id="cpName" required class="border rounded-xl px-3 py-2 text-sm" placeholder="Checkpoint name">
        <input id="cpDesc" class="border rounded-xl px-3 py-2 text-sm" placeholder="Description / location">
        <button class="bg-gray-900 text-white rounded-xl px-5 py-2 font-bold text-sm">+ Add</button>
      </form>
    </div>
    <div class="grid md:grid-cols-2 gap-3">
      ${checkpoints.length ? checkpoints.map(c => `
        <article class="bg-white rounded-2xl p-4 shadow-sm">
          <div class="flex justify-between gap-3">
            <div><b class="text-sm">${esc(c.name)}</b><p class="text-xs text-gray-400 mt-0.5">${esc(c.address || c.description || '')}</p></div>
            <span class="text-[10px] font-black h-fit px-2 py-1 rounded-full ${c.active !== false ? 'bg-teal-50 text-teal-700' : 'bg-gray-100 text-gray-500'}">${c.active !== false ? 'ACTIVE' : 'INACTIVE'}</span>
          </div>
          <div class="flex gap-2 mt-3">
            <button data-toggle="${c.id}" data-active="${c.active !== false}" class="px-3 py-1.5 rounded-lg border text-[11px] font-bold">${c.active !== false ? 'Disable' : 'Enable'}</button>
            <button data-delete="${c.id}" class="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-[11px] font-bold">Delete</button>
          </div>
        </article>`).join('') : '<div class="bg-white rounded-2xl p-8 text-center text-sm text-gray-400 md:col-span-2">No checkpoints yet.</div>'}
    </div>`;

  el.querySelector('#checkpointForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = el.querySelector('#cpName').value.trim();
    if (!name) return;
    try {
      await addDeliveryCheckpoint({ name, address: el.querySelector('#cpDesc').value.trim(), active: true, createdAt: Date.now(), updatedAt: Date.now() });
      e.target.reset();
    } catch (err) { alert(`Could not add checkpoint: ${err.message}`); }
  });
  el.querySelectorAll('[data-toggle]').forEach(b => b.onclick = async () => {
    try { await updateDeliveryCheckpoint(b.dataset.toggle, { active: b.dataset.active !== 'true', updatedAt: Date.now() }); }
    catch (err) { alert(`Could not update checkpoint: ${err.message}`); }
  });
  el.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this checkpoint?')) return;
    try { await deleteDeliveryCheckpoint(b.dataset.delete); }
    catch (err) { alert(`Could not delete checkpoint: ${err.message}`); }
  });
}

/* ---------------- INIT (lazy — matches the Inventory/Reports tab pattern) ---------------- */

// Called once, the first time the Delivery tab is clicked (see admin/index.html).
// Returns a stop function that unsubscribes all 5 Firestore listeners, so
// switching away from the tab doesn't leave them running in the background.
export function initDelivery() {
  root = document.getElementById('deliveryContent');
  if (!root) return () => {};
  if (unsubs.length) unsubs.forEach(fn => fn && fn()); // guard against double-init

  unsubs = [
    watchDeliveryPersonnel(v => { personnel = v; render(); }),
    watchDeliveryTypes(v => { types = v; render(); }),
    watchDeliveryCheckpoints(v => { checkpoints = v; render(); }),
    watchOrders(v => { orders = v; render(); }),
    watchDeliveries(v => { deliveries = v; render(); })
  ];

  return () => {
    unsubs.forEach(fn => fn && fn());
    unsubs = [];
    root = null;
  };
}
