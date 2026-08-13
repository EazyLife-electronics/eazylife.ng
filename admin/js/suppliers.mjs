// admin/js/suppliers.mjs
// Supplier master records for the Purchases tab.
// Purchase history remains the source of transaction totals; this collection stores supplier details.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, getDocs, addDoc, updateDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import './purchase-void.mjs';

const { db, auth } = initFirebase();
let suppliers = [];
let currentUser = null;
let installed = false;
let loading = false;

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function dateText(value) {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-NG', { dateStyle: 'medium' });
}

// Finds an existing master supplier by name, or creates one when a new supplier
// is entered through Receive Purchase. This keeps purchase transactions and the
// Supplier Records collection synchronized without creating case-only duplicates.
export async function ensureSupplierRecord(name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Supplier name is required.');

  const key = cleanName.toLowerCase();
  const snap = await getDocs(collection(db, 'suppliers'));
  const existing = snap.docs.find(d => String(d.data()?.name || '').trim().toLowerCase() === key);
  if (existing) return { id: existing.id, ...existing.data(), created: false };

  const now = serverTimestamp();
  const ref = await addDoc(collection(db, 'suppliers'), {
    name: cleanName,
    contactPerson: '',
    phone: '',
    whatsapp: '',
    address: '',
    notes: 'Automatically created from a received purchase. Add contact details in Supplier Records.',
    source: 'purchase',
    createdAt: now,
    updatedAt: now
  });
  return { id: ref.id, name: cleanName, created: true };
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
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="font-black text-lg">Supplier Records</h2>
        <p class="text-[11px] text-gray-400">Supplier names entered while receiving purchases are automatically added here. Store contact and business details separately from purchase transactions.</p>
      </div>
      <button id="newSupplierBtn" class="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-xs">+ Add Supplier</button>
    </div>
    <div id="supplierFormWrap" class="hidden bg-gray-50 rounded-xl border border-gray-200 p-3 mb-4">
      <div class="flex justify-between items-center mb-3">
        <h3 id="supplierFormTitle" class="text-sm font-black">Add Supplier</h3>
        <button id="cancelSupplierBtn" class="text-xs text-gray-400 font-bold">Cancel</button>
      </div>
      <div class="grid md:grid-cols-2 gap-2">
        <input id="supplierRecordName" placeholder="Supplier / business name *" class="p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none">
        <input id="supplierContactPerson" placeholder="Contact person" class="p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none">
        <input id="supplierPhone" type="tel" placeholder="Phone" class="p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none">
        <input id="supplierWhatsapp" type="tel" placeholder="WhatsApp" class="p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none">
        <input id="supplierAddress" placeholder="Address" class="p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none md:col-span-2">
        <textarea id="supplierNotes" rows="2" placeholder="Notes" class="p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none md:col-span-2"></textarea>
      </div>
      <div class="flex gap-2 mt-3">
        <button id="saveSupplierBtn" class="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">Save Supplier</button>
        <button id="resetSupplierBtn" class="bg-white border border-gray-200 text-gray-500 px-4 rounded-xl font-bold text-sm">Clear</button>
      </div>
      <p id="supplierRecordMessage" class="text-xs mt-3 hidden"></p>
    </div>
    <div class="flex gap-2 mb-3">
      <input id="supplierRecordSearch" placeholder="Search saved suppliers..." class="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <button id="supplierRecordRefresh" class="bg-gray-100 text-gray-600 px-4 rounded-xl font-bold text-xs">Refresh</button>
    </div>
    <div id="supplierRecordRows" class="grid gap-2"><p class="text-xs text-gray-400">Loading suppliers...</p></div>`;

  directory.insertAdjacentElement('afterend', section);
  installed = true;

  document.getElementById('newSupplierBtn').onclick = () => openForm();
  document.getElementById('cancelSupplierBtn').onclick = closeForm;
  document.getElementById('resetSupplierBtn').onclick = resetForm;
  document.getElementById('saveSupplierBtn').onclick = saveSupplier;
  document.getElementById('supplierRecordRefresh').onclick = loadSuppliers;
  document.getElementById('supplierRecordSearch').addEventListener('input', render);
  loadSuppliers();
  return true;
}

function openForm(supplier = null) {
  document.getElementById('supplierFormWrap')?.classList.remove('hidden');
  document.getElementById('supplierFormTitle').textContent = supplier ? 'Edit Supplier' : 'Add Supplier';
  document.getElementById('supplierFormWrap').dataset.editId = supplier?.id || '';
  document.getElementById('supplierRecordName').value = supplier?.name || '';
  document.getElementById('supplierContactPerson').value = supplier?.contactPerson || '';
  document.getElementById('supplierPhone').value = supplier?.phone || '';
  document.getElementById('supplierWhatsapp').value = supplier?.whatsapp || '';
  document.getElementById('supplierAddress').value = supplier?.address || '';
  document.getElementById('supplierNotes').value = supplier?.notes || '';
  document.getElementById('supplierRecordName')?.focus();
}

function closeForm() {
  document.getElementById('supplierFormWrap')?.classList.add('hidden');
  resetForm();
}

function resetForm() {
  const wrap = document.getElementById('supplierFormWrap');
  if (!wrap) return;
  wrap.dataset.editId = '';
  document.getElementById('supplierFormTitle').textContent = 'Add Supplier';
  ['supplierRecordName','supplierContactPerson','supplierPhone','supplierWhatsapp','supplierAddress','supplierNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const message = document.getElementById('supplierRecordMessage');
  if (message) message.className = 'text-xs mt-3 hidden';
}

function message(text, error = false) {
  const el = document.getElementById('supplierRecordMessage');
  if (!el) return;
  el.textContent = text;
  el.className = `text-xs mt-3 ${error ? 'text-red-500' : 'text-green-600'}`;
  el.classList.remove('hidden');
}

async function saveSupplier() {
  if (!currentUser) return message('Please log in first.', true);
  const name = document.getElementById('supplierRecordName').value.trim();
  if (!name) return message('Supplier name is required.', true);

  const data = {
    name,
    contactPerson: document.getElementById('supplierContactPerson').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    whatsapp: document.getElementById('supplierWhatsapp').value.trim(),
    address: document.getElementById('supplierAddress').value.trim(),
    notes: document.getElementById('supplierNotes').value.trim(),
    updatedAt: serverTimestamp()
  };

  const editId = document.getElementById('supplierFormWrap').dataset.editId;
  try {
    if (editId) {
      await updateDoc(doc(db, 'suppliers', editId), data);
      message('Supplier updated successfully.');
    } else {
      const duplicate = suppliers.some(s => String(s.name || '').trim().toLowerCase() === name.toLowerCase());
      if (duplicate) return message('A saved supplier with this name already exists.', true);
      await addDoc(collection(db, 'suppliers'), { ...data, createdAt: serverTimestamp() });
      message('Supplier saved successfully.');
    }
    await loadSuppliers();
    setTimeout(closeForm, 350);
  } catch (e) {
    message(e.message || 'Could not save supplier.', true);
  }
}

async function loadSuppliers() {
  if (!currentUser || loading) return;
  const el = document.getElementById('supplierRecordRows');
  if (!el) return;
  loading = true;
  el.innerHTML = '<p class="text-xs text-gray-400 py-3">Loading saved suppliers...</p>';
  try {
    const snap = await getDocs(collection(db, 'suppliers'));
    suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    render();
  } catch (e) {
    el.innerHTML = `<p class="text-xs text-red-500 py-3">Could not load supplier records: ${escapeHtml(e.message)}</p>`;
  } finally {
    loading = false;
  }
}

function render() {
  const el = document.getElementById('supplierRecordRows');
  if (!el) return;
  const query = String(document.getElementById('supplierRecordSearch')?.value || '').trim().toLowerCase();
  const filtered = suppliers.filter(s => [s.name, s.contactPerson, s.phone, s.whatsapp, s.address, s.notes].some(v => String(v || '').toLowerCase().includes(query)));
  if (!filtered.length) {
    el.innerHTML = `<div class="py-8 text-center text-xs text-gray-400">${query ? 'No saved suppliers match your search.' : 'No saved supplier records yet. Add your first supplier above.'}</div>`;
    return;
  }
  el.innerHTML = filtered.map(s => `
    <div class="border border-gray-100 rounded-xl p-3">
      <div class="flex flex-col md:flex-row md:items-start gap-3">
        <div class="flex-grow min-w-0">
          <div class="flex items-center gap-2">
            <p class="text-sm font-black truncate">${escapeHtml(s.name)}</p>
            <span class="text-[9px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-600">SAVED</span>
          </div>
          <p class="text-[10px] text-gray-400 mt-1">${escapeHtml(s.contactPerson || 'No contact person')} · ${escapeHtml(s.phone || 'No phone')}</p>
          ${s.whatsapp ? `<p class="text-[10px] text-gray-400 mt-1">WhatsApp: ${escapeHtml(s.whatsapp)}</p>` : ''}
          ${s.address ? `<p class="text-[10px] text-gray-400 mt-1">${escapeHtml(s.address)}</p>` : ''}
          ${s.notes ? `<p class="text-[10px] text-gray-500 mt-2">${escapeHtml(s.notes)}</p>` : ''}
          <p class="text-[9px] text-gray-300 mt-2">Updated ${dateText(s.updatedAt || s.createdAt)}</p>
        </div>
        <button type="button" data-id="${escapeHtml(s.id)}" class="edit-supplier bg-gray-100 text-gray-600 px-4 py-2 rounded-lg font-bold text-xs">Edit</button>
      </div>
    </div>`).join('');

  el.querySelectorAll('.edit-supplier').forEach(btn => btn.addEventListener('click', () => {
    const supplier = suppliers.find(s => s.id === btn.dataset.id);
    if (supplier) openForm(supplier);
  }));
}

function boot() {
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (!user) {
      suppliers = [];
      const rows = document.getElementById('supplierRecordRows');
      if (rows) rows.innerHTML = '<p class="text-xs text-gray-400 py-3">Log in to manage supplier records.</p>';
      return;
    }
    install();
    loadSuppliers();
  });
}

const observer = new MutationObserver(() => {
  if (currentUser) install();
});
if (document.body) observer.observe(document.body, { childList: true, subtree: true });
boot();