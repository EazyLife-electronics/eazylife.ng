// Supplier master records for the Purchases tab.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const { db, auth } = initFirebase();
let suppliers = [];
let purchases = [];
let currentUser = null;
let installed = false;
let loading = false;
let syncing = false;
let purchaseSupplierPickerInstalled = false;
let purchaseSupplierOutsideClickInstalled = false;

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function cleanName(v) { return String(v || '').trim().replace(/\s+/g, ' '); }
function normalizeName(v) { return cleanName(v).toLowerCase(); }
function money(v) { return `₦${Number(v || 0).toLocaleString('en-NG')}`; }
function dateText(value, time = false) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-NG', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
}

function findSupplierByName(name) {
  const key = normalizeName(name);
  return suppliers.find(s => normalizeName(s.name) === key) || null;
}

function purchaseMetrics() {
  const map = new Map();
  for (const p of purchases) {
    if (p.status === 'voided') continue;
    const key = p.supplierId || normalizeName(p.supplier);
    if (!key) continue;
    const m = map.get(key) || { purchases: 0, units: 0, value: 0, lastPurchase: null };
    m.purchases += 1;
    m.units += Number(p.quantity || 0);
    m.value += Number(p.totalCost || 0);
    const t = p.createdAt?.toMillis?.() || 0;
    if (t > (m.lastPurchase?.toMillis?.() || 0)) m.lastPurchase = p.createdAt;
    map.set(key, m);
  }
  return map;
}

function metricsFor(supplier, map) {
  return map.get(supplier.id) || map.get(normalizeName(supplier.name)) || { purchases: 0, units: 0, value: 0, lastPurchase: null };
}

export async function ensureSupplierRecord(name) {
  const clean = cleanName(name);
  if (!clean) throw new Error('Supplier name is required.');

  const local = findSupplierByName(clean);
  if (local) return { ...local, created: false };

  const snap = await getDocs(collection(db, 'suppliers'));
  const found = snap.docs.find(d => normalizeName(d.data()?.name) === normalizeName(clean));
  if (found) {
    const record = { id: found.id, ...found.data() };
    if (!suppliers.some(s => s.id === record.id)) suppliers.push(record);
    return { ...record, created: false };
  }

  const now = serverTimestamp();
  const ref = await addDoc(collection(db, 'suppliers'), {
    name: clean,
    normalizedName: normalizeName(clean),
    business: '', contactPerson: '', phone: '', whatsapp: '', email: '', address: '',
    notes: 'Automatically created from a received purchase. Add contact details in Supplier Records.',
    source: 'purchase', createdAt: now, updatedAt: now, createdBy: currentUser?.uid || null
  });
  const record = {
    id: ref.id, name: clean, normalizedName: normalizeName(clean), business: '', contactPerson: '',
    phone: '', whatsapp: '', email: '', address: '',
    notes: 'Automatically created from a received purchase. Add contact details in Supplier Records.',
    source: 'purchase', created: true
  };
  suppliers.push(record);
  renderSupplierOptions();
  return record;
}

function install() {
  if (installed) return true;
  const panel = document.getElementById('panel-purchases');
  const directory = document.getElementById('supplierRows')?.closest('.bg-white');
  if (!panel || !directory) return false;

  const section = document.createElement('div');
  section.id = 'supplierRecordsPanel';
  section.className = 'bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mt-4';
  section.innerHTML = `
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
      <div>
        <div class="flex flex-wrap items-center gap-2"><h2 class="font-black text-lg">Supplier Master</h2><span class="text-[9px] font-black uppercase tracking-wide bg-teal-50 text-teal-600 px-2 py-1 rounded-full">Master Records</span></div>
        <p class="text-[11px] text-gray-400 max-w-2xl mt-1">One supplier record for contact and business details. Purchases link to this record by Supplier ID; purchase history remains the source of totals.</p>
      </div>
      <div class="flex gap-2"><button id="syncSupplierRecords" type="button" class="bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-bold text-xs whitespace-nowrap">Sync Purchases</button><button id="newSupplierBtn" type="button" class="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-xs whitespace-nowrap">+ Add Supplier</button></div>
    </div>
    <div id="supplierSyncMessage" class="hidden mb-3 rounded-xl px-3 py-2 text-xs font-bold"></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Suppliers</p><p id="supplierCount" class="text-sm font-black mt-1">0</p></div>
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">With contact</p><p id="supplierContactCount" class="text-sm font-black mt-1">0</p></div>
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Purchase-linked</p><p id="supplierLinkedCount" class="text-sm font-black mt-1">0</p></div>
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Last updated</p><p id="supplierLastUpdated" class="text-sm font-black mt-1">—</p></div>
    </div>
    <div class="flex gap-2 mb-3"><input id="supplierRecordSearch" type="search" placeholder="Search name, contact, phone, email..." class="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none"><button id="refreshSupplierRecords" type="button" class="bg-gray-100 text-gray-700 px-4 rounded-xl font-bold text-xs">Refresh</button></div>
    <div id="supplierRecordRows" class="space-y-2"></div>`;
  directory.after(section);
  installed = true;

  document.getElementById('newSupplierBtn')?.addEventListener('click', () => openSupplierEditor());
  document.getElementById('syncSupplierRecords')?.addEventListener('click', syncPurchaseLinks);
  document.getElementById('refreshSupplierRecords')?.addEventListener('click', loadSuppliers);
  document.getElementById('supplierRecordSearch')?.addEventListener('input', render);
  return true;
}

function setPurchaseSupplierStatus(text, type = 'neutral') {
  const status = document.getElementById('purchaseSupplierStatus');
  if (!status) return;
  status.textContent = text;
  const classes = {
    linked: 'text-emerald-600',
    new: 'text-amber-600',
    neutral: 'text-gray-400'
  };
  status.className = `text-[10px] mt-1 px-1 ${classes[type] || classes.neutral}`;
}

function hidePurchaseSupplierDropdown() {
  document.getElementById('purchaseSupplierDropdown')?.classList.add('hidden');
}

function showPurchaseSupplierDropdown() {
  const dropdown = document.getElementById('purchaseSupplierDropdown');
  if (!dropdown) return;
  dropdown.classList.remove('hidden');
}

function renderPurchaseSupplierDropdown(query = '') {
  const dropdown = document.getElementById('purchaseSupplierDropdown');
  if (!dropdown) return;
  const key = normalizeName(query);
  const matches = suppliers
    .filter(s => !key || normalizeName(s.name).includes(key) || normalizeName(s.business).includes(key) || normalizeName(s.contactPerson).includes(key))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  const exact = findSupplierByName(query);
  let html = matches.map(s => `
    <button type="button" class="purchaseSupplierOption w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">
      <span class="block text-xs font-bold text-gray-800">${escapeHtml(s.name)}</span>
      <span class="block text-[10px] text-gray-400">${escapeHtml(s.contactPerson || s.business || 'Supplier Master record')}</span>
    </button>`).join('');

  if (!exact && cleanName(query)) {
    html += `<div class="px-3 py-2.5 bg-amber-50 border-t border-amber-100"><p class="text-[10px] font-bold text-amber-700">New supplier</p><p class="text-[10px] text-amber-600 mt-0.5">“${escapeHtml(cleanName(query))}” will be added to Supplier Master when the purchase is received.</p></div>`;
  }
  if (!html) html = '<p class="px-3 py-3 text-[10px] text-gray-400">No matching suppliers.</p>';
  dropdown.innerHTML = html;
  dropdown.querySelectorAll('.purchaseSupplierOption').forEach(option => {
    option.addEventListener('mousedown', event => event.preventDefault());
    option.addEventListener('click', () => {
      const input = document.getElementById('purchaseSupplier');
      const record = suppliers.find(s => s.id === option.dataset.id);
      if (input && record) {
        input.value = record.name;
        input.dataset.supplierId = record.id;
        setPurchaseSupplierStatus(`Linked to Supplier Master · ${record.contactPerson || record.business || 'record ready'}`, 'linked');
      }
      hidePurchaseSupplierDropdown();
    });
  });
}

function installPurchaseSupplierHelper() {
  const input = document.getElementById('purchaseSupplier');
  if (!input) return false;

  if (!purchaseSupplierPickerInstalled) {
    purchaseSupplierPickerInstalled = true;
    input.dataset.supplierMasterEnhanced = '1';
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'Select Supplier Master record or type a new supplier';

    const wrapper = input.parentElement;
    if (wrapper) {
      wrapper.classList.add('relative');
      const status = document.createElement('p');
      status.id = 'purchaseSupplierStatus';
      status.className = 'text-[10px] mt-1 px-1 text-gray-400';
      status.textContent = 'Choose an existing supplier or type a new name.';
      input.insertAdjacentElement('afterend', status);

      const dropdown = document.createElement('div');
      dropdown.id = 'purchaseSupplierDropdown';
      dropdown.className = 'hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto';
      status.insertAdjacentElement('afterend', dropdown);
    }

    input.addEventListener('focus', () => {
      renderPurchaseSupplierDropdown(input.value);
      showPurchaseSupplierDropdown();
    });
    input.addEventListener('input', () => {
      const record = findSupplierByName(input.value);
      if (record) {
        input.value = record.name;
        input.dataset.supplierId = record.id;
        setPurchaseSupplierStatus(`Linked to Supplier Master · ${record.contactPerson || record.business || 'record ready'}`, 'linked');
      } else {
        delete input.dataset.supplierId;
        setPurchaseSupplierStatus(cleanName(input.value) ? 'New supplier — it will be created in Supplier Master when received.' : 'Choose an existing supplier or type a new name.', cleanName(input.value) ? 'new' : 'neutral');
      }
      renderPurchaseSupplierDropdown(input.value);
      showPurchaseSupplierDropdown();
    });
    input.addEventListener('change', () => {
      const record = findSupplierByName(input.value);
      if (record) {
        input.value = record.name;
        input.dataset.supplierId = record.id;
        setPurchaseSupplierStatus(`Linked to Supplier Master · ${record.contactPerson || record.business || 'record ready'}`, 'linked');
      }
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') hidePurchaseSupplierDropdown();
    });
  }

  renderSupplierOptions();
  if (!purchaseSupplierOutsideClickInstalled) {
    purchaseSupplierOutsideClickInstalled = true;
    document.addEventListener('click', event => {
      const input = document.getElementById('purchaseSupplier');
      const dropdown = document.getElementById('purchaseSupplierDropdown');
      if (input && dropdown && !input.contains(event.target) && !dropdown.contains(event.target)) hidePurchaseSupplierDropdown();
    });
  }
  return true;
}

function renderSupplierOptions() {
  const input = document.getElementById('purchaseSupplier');
  if (!input) return;
  let list = document.getElementById('supplierMasterOptions');
  if (!list) {
    list = document.createElement('datalist');
    list.id = 'supplierMasterOptions';
    input.insertAdjacentElement('afterend', list);
  }
  input.setAttribute('list', 'supplierMasterOptions');
  list.innerHTML = suppliers.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.contactPerson || s.business || '')}</option>`).join('');
  if (document.activeElement === input) renderPurchaseSupplierDropdown(input.value);
}

function render() {
  const rows = document.getElementById('supplierRecordRows');
  if (!rows) return;
  installPurchaseSupplierHelper();
  const query = normalizeName(document.getElementById('supplierRecordSearch')?.value || '');
  const map = purchaseMetrics();
  const filtered = suppliers.filter(s => !query || [s.name, s.business, s.contactPerson, s.phone, s.whatsapp, s.email, s.address, s.notes].some(v => normalizeName(v).includes(query)));
  const contactCount = suppliers.filter(s => [s.contactPerson, s.phone, s.whatsapp, s.email].some(v => String(v || '').trim())).length;
  const linkedIds = new Set(purchases.filter(p => p.status !== 'voided' && p.supplierId).map(p => p.supplierId));
  const latest = suppliers.reduce((n, s) => Math.max(n, s.updatedAt?.toMillis?.() || s.createdAt?.toMillis?.() || 0), 0);
  document.getElementById('supplierCount').textContent = suppliers.length.toLocaleString();
  document.getElementById('supplierContactCount').textContent = contactCount.toLocaleString();
  document.getElementById('supplierLinkedCount').textContent = linkedIds.size.toLocaleString();
  document.getElementById('supplierLastUpdated').textContent = latest ? dateText(new Date(latest)) : '—';

  if (loading) { rows.innerHTML = '<div class="text-sm text-gray-400 py-4">Loading supplier records...</div>'; return; }
  if (!filtered.length) { rows.innerHTML = `<div class="text-sm text-gray-400 py-8 text-center">${query ? 'No supplier records match your search.' : 'No supplier records yet. Receive a purchase or add a supplier manually.'}</div>`; return; }

  rows.innerHTML = filtered.map(s => {
    const m = metricsFor(s, map);
    const phone = String(s.phone || '').trim();
    const whatsapp = String(s.whatsapp || '').trim();
    const contact = String(s.contactPerson || '').trim();
    const business = String(s.business || '').trim();
    const address = String(s.address || '').trim();
    const linked = purchases.some(p => p.status !== 'voided' && p.supplierId === s.id);
    const hasDetails = contact || phone || whatsapp || s.email || address || business;
    return `<div class="border border-gray-100 rounded-2xl p-4 bg-white hover:border-gray-200 transition">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-3"><div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2"><p class="font-black text-sm">${escapeHtml(s.name || 'Unnamed supplier')}</p>${s.source === 'purchase' ? '<span class="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">FROM PURCHASE</span>' : '<span class="text-[9px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">SAVED</span>'}${linked ? '<span class="text-[9px] font-bold px-2 py-1 rounded-full bg-blue-50 text-blue-600">LINKED</span>' : ''}</div>
        <p class="text-xs text-gray-500 mt-1">${escapeHtml(contact || 'No contact person')}${business ? ` · ${escapeHtml(business)}` : ''}</p>
        <p class="text-[10px] text-gray-400 mt-1">${phone ? escapeHtml(phone) : 'No phone'}${whatsapp ? ` · WhatsApp ${escapeHtml(whatsapp)}` : ''}${s.email ? ` · ${escapeHtml(s.email)}` : ''}</p>
        ${address ? `<p class="text-[10px] text-gray-400 mt-1">${escapeHtml(address)}</p>` : ''}${!hasDetails ? '<p class="text-[10px] text-amber-500 mt-1">Contact details not filled yet.</p>' : ''}
        <p class="text-[10px] text-gray-400 mt-2">Updated ${dateText(s.updatedAt || s.createdAt)}</p>
      </div><button class="editSupplierBtn text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 whitespace-nowrap" data-id="${escapeHtml(s.id)}">Edit</button></div>
      <div class="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-50"><div><p class="text-[9px] uppercase font-bold text-gray-400">Purchases</p><p class="text-xs font-black mt-1">${m.purchases}</p></div><div><p class="text-[9px] uppercase font-bold text-gray-400">Units</p><p class="text-xs font-black mt-1">${m.units.toLocaleString()}</p></div><div><p class="text-[9px] uppercase font-bold text-gray-400">Purchase value</p><p class="text-xs font-black mt-1">${money(m.value)}</p></div></div>
      ${m.lastPurchase ? `<p class="text-[9px] text-gray-400 mt-2">Last purchase: ${dateText(m.lastPurchase, true)}</p>` : ''}</div>`;
  }).join('');
  rows.querySelectorAll('.editSupplierBtn').forEach(btn => btn.addEventListener('click', () => { const s = suppliers.find(x => x.id === btn.dataset.id); if (s) openSupplierEditor(s); }));
}

function showSyncMessage(text, error = false) {
  const el = document.getElementById('supplierSyncMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `mb-3 rounded-xl px-3 py-2 text-xs font-bold ${error ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`;
  el.classList.remove('hidden');
}

async function syncPurchaseLinks() {
  if (syncing) return;
  syncing = true;
  const button = document.getElementById('syncSupplierRecords');
  if (button) { button.disabled = true; button.textContent = 'Syncing...'; }
  try {
    const snap = await getDocs(collection(db, 'purchases'));
    let linked = 0, created = 0, skipped = 0;
    for (const purchaseDoc of snap.docs) {
      const p = purchaseDoc.data();
      if (p.status === 'voided' || p.supplierId) { skipped += 1; continue; }
      const name = cleanName(p.supplier);
      if (!name) { skipped += 1; continue; }
      const record = await ensureSupplierRecord(name);
      await updateDoc(doc(db, 'purchases', purchaseDoc.id), { supplier: record.name, supplierId: record.id, supplierSyncedAt: serverTimestamp() });
      linked += 1;
      if (record.created) created += 1;
    }
    await loadSuppliers();
    showSyncMessage(`Sync complete: ${linked} purchase${linked === 1 ? '' : 's'} linked, ${created} supplier master record${created === 1 ? '' : 's'} created${skipped ? `, ${skipped} skipped` : ''}.`);
  } catch (err) {
    console.error('Supplier purchase sync failed:', err);
    showSyncMessage(err?.message || 'Supplier sync failed.', true);
  } finally {
    syncing = false;
    if (button) { button.disabled = false; button.textContent = 'Sync Purchases'; }
  }
}

function openSupplierEditor(existing = null) {
  document.getElementById('supplierEditorModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'supplierEditorModal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end md:items-center justify-center p-0 md:p-4';
  modal.innerHTML = `<div class="bg-white rounded-t-[24px] md:rounded-2xl p-5 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
    <div class="flex justify-between items-center mb-4"><div><h3 class="font-black text-lg">${existing ? 'Edit Supplier' : 'Add Supplier'}</h3><p class="text-[10px] text-gray-400 mt-1">This is the supplier master. Purchase transactions are not edited here.</p></div><button id="closeSupplierEditor" type="button" class="text-2xl text-gray-400">&times;</button></div>
    <form id="supplierEditorForm" class="space-y-3"><div class="grid md:grid-cols-2 gap-3">
      <input name="name" required placeholder="Supplier / business name *" value="${escapeHtml(existing?.name)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
      <input name="business" placeholder="Registered business name" value="${escapeHtml(existing?.business)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
      <input name="contactPerson" placeholder="Contact person" value="${escapeHtml(existing?.contactPerson)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
      <input name="phone" type="tel" placeholder="Phone" value="${escapeHtml(existing?.phone)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
      <input name="whatsapp" type="tel" placeholder="WhatsApp number" value="${escapeHtml(existing?.whatsapp)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
      <input name="email" type="email" placeholder="Email" value="${escapeHtml(existing?.email)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
    </div><input name="address" placeholder="Business / delivery address" value="${escapeHtml(existing?.address)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm"><textarea name="notes" rows="3" placeholder="Notes" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm resize-none">${escapeHtml(existing?.notes)}</textarea>
    ${existing ? `<div class="rounded-xl bg-gray-50 p-3 text-[10px] text-gray-500">Supplier ID: <span class="font-mono">${escapeHtml(existing.id)}</span><br>Source: <span class="font-bold">${escapeHtml(existing.source || 'unknown')}</span></div>` : ''}
    <div class="flex gap-2 pt-1"><button id="cancelSupplierEditor" type="button" class="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-sm">Cancel</button><button id="saveSupplierEditor" class="flex-1 bg-gray-900 text-white rounded-xl py-3 font-bold text-sm">Save Supplier</button></div></form></div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById('closeSupplierEditor')?.addEventListener('click', close);
  document.getElementById('cancelSupplierEditor')?.addEventListener('click', close);
  document.getElementById('supplierEditorForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const save = document.getElementById('saveSupplierEditor');
    if (save) { save.disabled = true; save.textContent = 'Saving...'; }
    const form = new FormData(e.currentTarget);
    const name = cleanName(form.get('name'));
    const data = { name, normalizedName: normalizeName(name), business: String(form.get('business') || '').trim(), contactPerson: String(form.get('contactPerson') || '').trim(), phone: String(form.get('phone') || '').trim(), whatsapp: String(form.get('whatsapp') || '').trim(), email: String(form.get('email') || '').trim(), address: String(form.get('address') || '').trim(), notes: String(form.get('notes') || '').trim(), updatedAt: serverTimestamp() };
    try {
      if (!name) throw new Error('Supplier name is required.');
      const duplicate = suppliers.find(s => s.id !== existing?.id && normalizeName(s.name) === normalizeName(name));
      if (duplicate) throw new Error(`A supplier named “${duplicate.name}” already exists. Edit that record instead.`);
      if (existing?.id) await updateDoc(doc(db, 'suppliers', existing.id), data);
      else await addDoc(collection(db, 'suppliers'), { ...data, source: 'manual', createdAt: serverTimestamp(), createdBy: currentUser?.uid || null });
      close();
      await loadSuppliers();
    } catch (err) {
      console.error('Supplier save failed:', err);
      alert(err?.message || 'Could not save supplier.');
      if (save) { save.disabled = false; save.textContent = 'Save Supplier'; }
    }
  });
}

async function loadSuppliers() {
  loading = true;
  render();
  try {
    const [supplierSnap, purchaseSnap] = await Promise.all([getDocs(collection(db, 'suppliers')), getDocs(collection(db, 'purchases'))]);
    suppliers = supplierSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    purchases = purchaseSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSupplierOptions();
  } catch (err) {
    console.error('Supplier records load failed:', err);
    suppliers = []; purchases = [];
    showSyncMessage(`Could not load supplier records: ${err?.message || 'Unknown error'}`, true);
  } finally {
    loading = false;
    render();
  }
}

function boot() {
  if (!install()) return;
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) { loadSuppliers(); installPurchaseSupplierHelper(); }
  });
}

const observer = new MutationObserver(() => {
  if (!installed) install();
  installPurchaseSupplierHelper();
});
observer.observe(document.body, { childList: true, subtree: true });

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

export { boot as initSuppliers };
