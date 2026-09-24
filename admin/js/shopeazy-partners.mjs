// admin/js/shopeazy-partners.mjs
// ShopEazy partner/outlet management UI.
// Firestore rules remain authoritative; this module only exposes management
// controls to roles that the dashboard explicitly enables.

import {
  createShopEazyPartner,
  getShopEazyPartners,
  updateShopEazyPartner,
  createShopEazyOutlet,
  getShopEazyOutlets,
  updateShopEazyOutlet
} from '../../js/store.mjs';

let currentAccess = null;
let partners = [];
let outlets = [];
let selectedPartnerId = null;

const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const canManage = () => ['ADMIN', 'PARTNER_MANAGER'].includes(currentAccess?.role);

export async function initShopEazyPartners(access) {
  currentAccess = access;
  const root = document.getElementById('partnersContent');
  if (!root) return;

  root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-gray-500">Loading partners and outlets…</div>';

  if (!canManage()) {
    root.innerHTML = '<div class="bg-white rounded-[24px] p-6"><h2 class="font-black text-lg">Partners & Outlets</h2><p class="text-sm text-gray-500 mt-2">This area is available to administrators and partner managers.</p></div>';
    return;
  }

  try {
    [partners, outlets] = await Promise.all([
      getShopEazyPartners(),
      getShopEazyOutlets()
    ]);
    render();
  } catch (error) {
    console.error('ShopEazy partners/outlets load failed:', error);
    root.innerHTML = '<div class="bg-white rounded-[24px] p-6 text-sm text-red-500">Could not load partners and outlets. Check your access and Firestore rules.</div>';
  }
}

function render() {
  const root = document.getElementById('partnersContent');
  if (!root) return;

  const selected = partners.find(p => p.id === selectedPartnerId) || partners[0] || null;
  if (selected && !selectedPartnerId) selectedPartnerId = selected.id;

  root.innerHTML = `
    <div class="grid md:grid-cols-2 gap-4">
      <section class="bg-white rounded-[24px] shadow-sm p-5">
        <div class="flex justify-between items-center mb-4">
          <div><h2 class="font-black text-lg">Partners</h2><p class="text-xs text-gray-400">Inventory partners for ShopEazy.</p></div>
          <button id="addPartnerBtn" class="bg-gray-900 text-white px-3 py-2 rounded-xl text-xs font-bold">+ Partner</button>
        </div>
        <div id="partnerList" class="space-y-2"></div>
        <form id="partnerForm" class="hidden mt-4 border-t pt-4 space-y-2">
          <input type="hidden" id="partnerEditId">
          <input id="partnerName" required placeholder="Partner name" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <input id="partnerContact" placeholder="Contact (phone/email)" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <textarea id="partnerNotes" rows="2" placeholder="Notes" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"></textarea>
          <select id="partnerStatus" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"><option>ACTIVE</option><option>INACTIVE</option></select>
          <div class="flex gap-2"><button class="flex-1 bg-gray-900 text-white py-3 rounded-xl text-xs font-bold">Save Partner</button><button type="button" id="cancelPartnerBtn" class="px-4 bg-gray-100 rounded-xl text-xs font-bold">Cancel</button></div>
        </form>
      </section>

      <section class="bg-white rounded-[24px] shadow-sm p-5">
        <div class="flex justify-between items-center mb-4">
          <div><h2 class="font-black text-lg">Outlets</h2><p class="text-xs text-gray-400">Physical fulfillment points.</p></div>
          <button id="addOutletBtn" class="bg-gray-900 text-white px-3 py-2 rounded-xl text-xs font-bold" ${partners.length ? '' : 'disabled'}>+ Outlet</button>
        </div>
        <div id="outletList" class="space-y-2"></div>
        <form id="outletForm" class="hidden mt-4 border-t pt-4 space-y-2">
          <input type="hidden" id="outletEditId">
          <select id="outletPartnerId" required class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"></select>
          <input id="outletName" required placeholder="Outlet name" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <textarea id="outletAddress" rows="2" placeholder="Address" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"></textarea>
          <input id="outletAreas" placeholder="Service areas, comma separated" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
          <label class="flex items-center gap-2 text-xs font-bold text-gray-500"><input type="checkbox" id="outletFulfillment" checked> Fulfillment enabled</label>
          <select id="outletStatus" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm"><option>ACTIVE</option><option>INACTIVE</option></select>
          <div class="flex gap-2"><button class="flex-1 bg-gray-900 text-white py-3 rounded-xl text-xs font-bold">Save Outlet</button><button type="button" id="cancelOutletBtn" class="px-4 bg-gray-100 rounded-xl text-xs font-bold">Cancel</button></div>
        </form>
      </section>
    </div>`;

  renderLists();
  bindForms();
}

function renderLists() {
  const partnerList = document.getElementById('partnerList');
  const outletList = document.getElementById('outletList');
  if (!partnerList || !outletList) return;

  partnerList.innerHTML = partners.length ? partners.map(p => `
    <button data-partner-id="${esc(p.id)}" class="partner-row w-full text-left p-3 rounded-xl border ${p.id === selectedPartnerId ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}">
      <div class="flex justify-between gap-2"><span class="font-bold text-sm">${esc(p.name)}</span><span class="text-[10px] font-bold">${esc(p.status)}</span></div>
      <div class="text-[10px] text-gray-400 mt-1">${esc(p.contact || 'No contact recorded')}</div>
    </button>`).join('') : '<p class="text-xs text-gray-400">No partners yet.</p>';

  const visible = selectedPartnerId ? outlets.filter(o => o.partnerId === selectedPartnerId) : outlets;
  outletList.innerHTML = visible.length ? visible.map(o => `
    <div class="p-3 rounded-xl border border-gray-100">
      <div class="flex justify-between gap-2"><div><span class="font-bold text-sm">${esc(o.name)}</span><div class="text-[10px] text-gray-400">${esc(o.address || 'No address recorded')}</div></div><span class="text-[10px] font-bold">${esc(o.status)}</span></div>
      <button data-edit-outlet="${esc(o.id)}" class="mt-2 text-[10px] font-bold text-gray-600">Edit outlet</button>
    </div>`).join('') : '<p class="text-xs text-gray-400">No outlets for this partner.</p>';

  partnerList.querySelectorAll('[data-partner-id]').forEach(btn => btn.addEventListener('click', () => {
    selectedPartnerId = btn.dataset.partnerId;
    render();
  }));
  outletList.querySelectorAll('[data-edit-outlet]').forEach(btn => btn.addEventListener('click', () => editOutlet(btn.dataset.editOutlet)));
}

function bindForms() {
  document.getElementById('addPartnerBtn')?.addEventListener('click', () => {
    document.getElementById('partnerForm').classList.remove('hidden');
    document.getElementById('partnerEditId').value = '';
  });
  document.getElementById('cancelPartnerBtn')?.addEventListener('click', () => document.getElementById('partnerForm').classList.add('hidden'));
  document.getElementById('addOutletBtn')?.addEventListener('click', () => {
    const form = document.getElementById('outletForm');
    form.classList.remove('hidden');
    document.getElementById('outletEditId').value = '';
    fillPartnerSelect(selectedPartnerId);
  });
  document.getElementById('cancelOutletBtn')?.addEventListener('click', () => document.getElementById('outletForm').classList.add('hidden'));

  document.getElementById('partnerForm')?.addEventListener('submit', savePartner);
  document.getElementById('outletForm')?.addEventListener('submit', saveOutlet);
}

function fillPartnerSelect(value) {
  const select = document.getElementById('outletPartnerId');
  if (!select) return;
  select.innerHTML = partners.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  if (value && partners.some(p => p.id === value)) select.value = value;
}

async function savePartner(event) {
  event.preventDefault();
  try {
    const id = document.getElementById('partnerEditId').value;
    const data = {
      name: document.getElementById('partnerName').value.trim(),
      contact: document.getElementById('partnerContact').value.trim() || null,
      notes: document.getElementById('partnerNotes').value.trim() || null,
      status: document.getElementById('partnerStatus').value
    };
    if (id) await updateShopEazyPartner(id, data);
    else await createShopEazyPartner(data);
    [partners, outlets] = await Promise.all([getShopEazyPartners(), getShopEazyOutlets()]);
    selectedPartnerId = id || partners.at(-1)?.id || null;
    render();
  } catch (error) {
    alert(error.message || 'Could not save partner.');
  }
}

function editOutlet(id) {
  const outlet = outlets.find(o => o.id === id);
  if (!outlet) return;
  document.getElementById('outletForm').classList.remove('hidden');
  document.getElementById('outletEditId').value = id;
  fillPartnerSelect(outlet.partnerId);
  document.getElementById('outletName').value = outlet.name || '';
  document.getElementById('outletAddress').value = outlet.address || '';
  document.getElementById('outletAreas').value = Array.isArray(outlet.serviceAreas) ? outlet.serviceAreas.join(', ') : '';
  document.getElementById('outletFulfillment').checked = outlet.fulfillmentEnabled !== false;
  document.getElementById('outletStatus').value = outlet.status || 'ACTIVE';
}

async function saveOutlet(event) {
  event.preventDefault();
  try {
    const id = document.getElementById('outletEditId').value;
    const data = {
      partnerId: document.getElementById('outletPartnerId').value,
      name: document.getElementById('outletName').value.trim(),
      address: document.getElementById('outletAddress').value.trim() || null,
      serviceAreas: document.getElementById('outletAreas').value.split(',').map(v => v.trim()).filter(Boolean),
      fulfillmentEnabled: document.getElementById('outletFulfillment').checked,
      status: document.getElementById('outletStatus').value
    };
    if (id) await updateShopEazyOutlet(id, data);
    else await createShopEazyOutlet(data);
    [partners, outlets] = await Promise.all([getShopEazyPartners(), getShopEazyOutlets()]);
    selectedPartnerId = data.partnerId;
    render();
  } catch (error) {
    alert(error.message || 'Could not save outlet.');
  }
}
