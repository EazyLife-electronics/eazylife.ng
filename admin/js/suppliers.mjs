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
    <div id="supplierRecordRows" class="space-y-2"></div>`;
  directory.after(section);
  installed = true;
  document.getElementById('newSupplierBtn')?.addEventListener('click', () => openSupplierEditor());
  return true;
}

function render() {
  const rows = document.getElementById('supplierRecordRows');
  if (!rows) return;
  if (loading) {
    rows.innerHTML = '<div class="text-sm text-gray-400 py-4">Loading supplier records...</div>';
    return;
  }
  if (!suppliers.length) {
    rows.innerHTML = '<div class="text-sm text-gray-400 py-4">No supplier records yet.</div>';
    return;
  }
  rows.innerHTML = suppliers.map(s => `
    <div class="border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div class="font-bold text-sm">${escapeHtml(s.name || 'Unnamed supplier')}</div>
        <div class="text-xs text-gray-500">${escapeHtml(s.phone || 'No phone')} · ${escapeHtml(s.email || 'No email')}</div>
        <div class="text-[10px] text-gray-400 mt-1">${escapeHtml(s.business || 'No business name')} · Updated ${dateText(s.updatedAt || s.createdAt)}</div>
      </div>
      <button class="editSupplierBtn text-xs font-bold px-3 py-2 rounded-lg border" data-id="${escapeHtml(s.id)}">Edit</button>
    </div>`).join('');
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
  modal.className = 'fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl p-5 w-full max-w-md shadow-2xl">
      <div class="flex justify-between items-center mb-4">
        <h3 class="font-black text-lg">${existing ? 'Edit Supplier' : 'Add Supplier'}</h3>
        <button id="closeSupplierEditor" class="text-2xl text-gray-400">&times;</button>
      </div>
      <form id="supplierEditorForm" class="space-y-3">
        <input name="name" required placeholder="Supplier name" value="${escapeHtml(existing?.name)}" class="w-full border rounded-xl px-3 py-3 text-sm">
        <input name="business" placeholder="Business name" value="${escapeHtml(existing?.business)}" class="w-full border rounded-xl px-3 py-3 text-sm">
        <input name="phone" placeholder="Phone" value="${escapeHtml(existing?.phone)}" class="w-full border rounded-xl px-3 py-3 text-sm">
        <input name="email" type="email" placeholder="Email" value="${escapeHtml(existing?.email)}" class="w-full border rounded-xl px-3 py-3 text-sm">
        <input name="address" placeholder="Address" value="${escapeHtml(existing?.address)}" class="w-full border rounded-xl px-3 py-3 text-sm">
        <button class="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold text-sm">Save Supplier</button>
      </form>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('closeSupplierEditor')?.addEventListener('click', () => modal.remove());
  document.getElementById('supplierEditorForm')?.addEventListener('submit', async e => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      name: String(form.get('name') || '').trim(),
      business: String(form.get('business') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      email: String(form.get('email') || '').trim(),
      address: String(form.get('address') || '').trim(),
      updatedAt: serverTimestamp()
    };
    try {
      if (existing?.id) await updateDoc(doc(db, 'suppliers', existing.id), data);
      else await addDoc(collection(db, 'suppliers'), { ...data, createdAt: serverTimestamp(), createdBy: currentUser?.uid || null });
      modal.remove();
      await loadSuppliers();
    } catch (err) {
      console.error('Supplier save failed:', err);
      alert(err?.message || 'Could not save supplier.');
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
