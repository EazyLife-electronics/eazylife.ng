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

function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Finds an existing master supplier by name, or creates one when a new supplier
// is entered through Receive Purchase. This keeps purchase transactions and the
// Supplier Records collection synchronized without creating case-only duplicates.
export async function ensureSupplierRecord(name) {
  const cleanName = String(name || '').trim().replace(/\s+/g, ' ');
  if (!cleanName) throw new Error('Supplier name is required.');

  const key = normalizeName(cleanName);
  const snap = await getDocs(collection(db, 'suppliers'));
  const existing = snap.docs.find(d => normalizeName(d.data()?.name) === key);
  if (existing) return { id: existing.id, ...existing.data(), created: false };

  const now = serverTimestamp();
  const ref = await addDoc(collection(db, 'suppliers'), {
    name: cleanName,
    business: '',
    contactPerson: '',
    phone: '',
    whatsapp: '',
    email: '',
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
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
      <div>
        <h2 class="font-black text-lg">Supplier Records</h2>
        <p class="text-[11px] text-gray-400 max-w-2xl">Your supplier master. Purchase transactions are kept separately, while contact and business information is stored here and linked by supplier ID.</p>
      </div>
      <button id="newSupplierBtn" type="button" class="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-xs whitespace-nowrap">+ Add Supplier</button>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">Saved suppliers</p><p id="supplierCount" class="text-sm font-black mt-1">0</p></div>
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3"><p class="text-[9px] text-gray-400 uppercase font-bold">With contact</p><p id="supplierContactCount" class="text-sm font-black mt-1">0</p></div>
      <div class="rounded-xl bg-gray-50 border border-gray-100 p-3 col-span-2 md:col-span-1"><p class="text-[9px] text-gray-400 uppercase font-bold">Last updated</p><p id="supplierLastUpdated" class="text-sm font-black mt-1">—</p></div>
    </div>
    <div class="flex gap-2 mb-3">
      <input id="supplierRecordSearch" type="search" placeholder="Search saved suppliers..." class="flex-1 p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none">
      <button id="refreshSupplierRecords" type="button" class="bg-gray-100 text-gray-700 px-4 rounded-xl font-bold text-xs">Refresh</button>
    </div>
    <div id="supplierRecordRows" class="space-y-2"></div>`;
  directory.after(section);
  installed = true;

  document.getElementById('newSupplierBtn')?.addEventListener('click', () => openSupplierEditor());
  document.getElementById('refreshSupplierRecords')?.addEventListener('click', loadSuppliers);
  document.getElementById('supplierRecordSearch')?.addEventListener('input', render);
  return true;
}

function render() {
  const rows = document.getElementById('supplierRecordRows');
  if (!rows) return;

  const query = normalizeName(document.getElementById('supplierRecordSearch')?.value || '');
  const filtered = suppliers.filter(s => {
    if (!query) return true;
    return [s.name, s.business, s.contactPerson, s.phone, s.whatsapp, s.email, s.address]
      .some(value => normalizeName(value).includes(query));
  });

  const contactCount = suppliers.filter(s => [s.contactPerson, s.phone, s.whatsapp, s.email].some(v => String(v || '').trim())).length;
  const latest = suppliers.reduce((latestValue, s) => {
    const value = s.updatedAt?.toMillis?.() || s.createdAt?.toMillis?.() || 0;
    return value > latestValue ? value : latestValue;
  }, 0);
  document.getElementById('supplierCount').textContent = suppliers.length.toLocaleString();
  document.getElementById('supplierContactCount').textContent = contactCount.toLocaleString();
  document.getElementById('supplierLastUpdated').textContent = latest ? dateText(new Date(latest)) : '—';

  if (loading) {
    rows.innerHTML = '<div class="text-sm text-gray-400 py-4">Loading supplier records...</div>';
    return;
  }
  if (!filtered.length) {
    rows.innerHTML = `<div class="text-sm text-gray-400 py-8 text-center">${query ? 'No saved suppliers match your search.' : 'No supplier records yet. Receive a purchase or add a supplier manually.'}</div>`;
    return;
  }

  rows.innerHTML = filtered.map(s => {
    const phone = String(s.phone || '').trim();
    const whatsapp = String(s.whatsapp || '').trim();
    const contact = String(s.contactPerson || '').trim();
    const business = String(s.business || '').trim();
    const address = String(s.address || '').trim();
    return `
      <div class="border border-gray-100 rounded-xl p-3 bg-white hover:border-gray-200">
        <div class="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-black text-sm truncate">${escapeHtml(s.name || 'Unnamed supplier')}</p>
              ${s.source === 'purchase' ? '<span class="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">FROM PURCHASE</span>' : '<span class="text-[9px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500">SAVED</span>'}
            </div>
            <p class="text-xs text-gray-500 mt-1">${escapeHtml(contact || 'No contact person')}${business ? ` · ${escapeHtml(business)}` : ''}</p>
            <p class="text-[10px] text-gray-400 mt-1">${phone ? escapeHtml(phone) : 'No phone'}${whatsapp ? ` · WhatsApp ${escapeHtml(whatsapp)}` : ''}${s.email ? ` · ${escapeHtml(s.email)}` : ''}</p>
            ${address ? `<p class="text-[10px] text-gray-400 mt-1">${escapeHtml(address)}</p>` : ''}
            <p class="text-[10px] text-gray-400 mt-1">Updated ${dateText(s.updatedAt || s.createdAt)}</p>
          </div>
          <button class="editSupplierBtn text-xs font-bold px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 whitespace-nowrap" data-id="${escapeHtml(s.id)}">Edit</button>
        </div>
      </div>`;
  }).join('');

  rows.querySelectorAll('.editSupplierBtn').forEach(btn => btn.addEventListener('click', () => {
    const supplier = suppliers.find(s => s.id === btn.dataset.id);
    if (supplier) openSupplierEditor(supplier);
  }));
}

function openSupplierEditor(existing = null) {
  const old = document.getElementById('supplierEditorModal');
  old?.remove();
  const modal = document.createElement('div');
  modal.id = 'supplierEditorModal';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-end md:items-center justify-center p-0 md:p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-t-[24px] md:rounded-2xl p-5 w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">
      <div class="flex justify-between items-center mb-4">
        <div><h3 class="font-black text-lg">${existing ? 'Edit Supplier' : 'Add Supplier'}</h3><p class="text-[10px] text-gray-400 mt-1">Keep the master record separate from purchase transactions.</p></div>
        <button id="closeSupplierEditor" type="button" class="text-2xl text-gray-400">&times;</button>
      </div>
      <form id="supplierEditorForm" class="space-y-3">
        <div class="grid md:grid-cols-2 gap-3">
          <input name="name" required placeholder="Supplier / business name *" value="${escapeHtml(existing?.name)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
          <input name="business" placeholder="Registered business name" value="${escapeHtml(existing?.business)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
          <input name="contactPerson" placeholder="Contact person" value="${escapeHtml(existing?.contactPerson)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
          <input name="phone" type="tel" placeholder="Phone" value="${escapeHtml(existing?.phone)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
          <input name="whatsapp" type="tel" placeholder="WhatsApp number" value="${escapeHtml(existing?.whatsapp)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
          <input name="email" type="email" placeholder="Email" value="${escapeHtml(existing?.email)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
        </div>
        <input name="address" placeholder="Business / delivery address" value="${escapeHtml(existing?.address)}" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm">
        <textarea name="notes" rows="3" placeholder="Notes" class="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-3 text-sm resize-none">${escapeHtml(existing?.notes)}</textarea>
        <div class="flex gap-2 pt-1">
          <button id="cancelSupplierEditor" type="button" class="bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold text-sm">Cancel</button>
          <button id="saveSupplierEditor" class="flex-1 bg-gray-900 text-white rounded-xl py-3 font-bold text-sm">Save Supplier</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('closeSupplierEditor')?.addEventListener('click', () => modal.remove());
  document.getElementById('cancelSupplierEditor')?.addEventListener('click', () => modal.remove());

  document.getElementById('supplierEditorForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const saveButton = document.getElementById('saveSupplierEditor');
    if (saveButton) { saveButton.disabled = true; saveButton.textContent = 'Saving...'; }
    const form = new FormData(e.currentTarget);
    const name = String(form.get('name') || '').trim().replace(/\s+/g, ' ');
    const data = {
      name,
      business: String(form.get('business') || '').trim(),
      contactPerson: String(form.get('contactPerson') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      whatsapp: String(form.get('whatsapp') || '').trim(),
      email: String(form.get('email') || '').trim(),
      address: String(form.get('address') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
      updatedAt: serverTimestamp()
    };
    try {
      if (!name) throw new Error('Supplier name is required.');

      const duplicate = suppliers.find(s => s.id !== existing?.id && normalizeName(s.name) === normalizeName(name));
      if (duplicate) throw new Error(`A supplier named “${duplicate.name}” already exists. Edit that record instead.`);

      if (existing?.id) {
        await updateDoc(doc(db, 'suppliers', existing.id), data);
      } else {
        await addDoc(collection(db, 'suppliers'), { ...data, source: 'manual', createdAt: serverTimestamp(), createdBy: currentUser?.uid || null });
      }
      modal.remove();
      await loadSuppliers();
    } catch (err) {
      console.error('Supplier save failed:', err);
      alert(err?.message || 'Could not save supplier.');
      if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save Supplier'; }
    }
  });
}

async function loadSuppliers() {
  loading = true;
  render();
  try {
    const snap = await getDocs(collection(db, 'suppliers'));
    suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  } catch (err) {
    console.error('Supplier records load failed:', err);
    suppliers = [];
  } finally {
    loading = false;
    render();
  }
}

function boot() {
  if (!install()) return;
  onAuthStateChanged(auth, user => {
    currentUser = user;
    if (user) loadSuppliers();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();

export { boot as initSuppliers };
