// Purchase supplier selector UI.
// Supplier Master is the source of supplier identity for receiving purchases.

import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const clean = value => String(value || '').trim().replace(/\s+/g, ' ');
const norm = value => clean(value).toLowerCase();
const esc = value => String(value ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));

export function initPurchaseSupplierUI({ db, auth } = {}) {
  if (!db || !auth || window.__purchaseSupplierUIBooted) return;
  window.__purchaseSupplierUIBooted = true;

  let suppliers = [];
  let unsubscribe = null;

  const findSupplier = value => suppliers.find(s => norm(s.name) === norm(value));

  const install = input => {
    if (!input || input.dataset.supplierUiInstalled === '1') return;
    input.dataset.supplierUiInstalled = '1';
    input.setAttribute('autocomplete', 'off');
    input.placeholder = 'Select supplier or add a new one';

    const wrapper = input.parentElement;
    if (!wrapper) return;
    wrapper.classList.add('relative');

    const status = document.createElement('p');
    status.id = 'purchaseSupplierStatus';
    status.className = 'text-[10px] mt-1 px-1 text-gray-400';
    status.textContent = 'Select an existing supplier or create a new one.';
    input.insertAdjacentElement('afterend', status);

    const dropdown = document.createElement('div');
    dropdown.id = 'purchaseSupplierDropdown';
    dropdown.className = 'hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden';
    input.insertAdjacentElement('afterend', dropdown);

    const setStatus = (text, type = 'neutral') => {
      const classes = { linked:'text-emerald-600', new:'text-amber-600', neutral:'text-gray-400' };
      status.textContent = text;
      status.className = `text-[10px] mt-1 px-1 ${classes[type]}`;
    };

    const render = () => {
      const query = norm(input.value);
      const matches = suppliers
        .filter(s => !query || norm(s.name).includes(query) || norm(s.business).includes(query) || norm(s.contactPerson).includes(query))
        .sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));

      let html = `<div class="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between"><span class="text-[9px] font-black uppercase tracking-wide text-gray-400">Supplier Master</span><span class="text-[9px] text-gray-400">${matches.length} match${matches.length === 1 ? '' : 'es'}</span></div>`;
      html += matches.map(s => `<button type="button" data-id="${esc(s.id)}" class="purchaseSupplierOption w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-50"><span class="flex items-center justify-between gap-2"><span class="text-xs font-black text-gray-800">${esc(s.name)}</span><span class="text-[9px] font-bold text-emerald-600">MASTER</span></span><span class="block text-[10px] text-gray-400 mt-0.5">${esc(s.contactPerson || s.business || 'No contact details')}</span></button>`).join('');

      if (clean(input.value) && !findSupplier(input.value)) {
        html += `<button type="button" id="purchaseSupplierNew" class="w-full text-left px-3 py-3 bg-amber-50 hover:bg-amber-100 border-t border-amber-100"><span class="flex items-center gap-2"><span class="inline-flex w-6 h-6 rounded-full bg-amber-100 text-amber-700 items-center justify-center font-black">+</span><span><span class="block text-xs font-black text-amber-800">Add “${esc(clean(input.value))}” as new supplier</span><span class="block text-[10px] text-amber-600 mt-0.5">A Supplier Master record will be created when the purchase is received.</span></span></span></button>`;
      }
      if (!matches.length && !clean(input.value)) html += '<div class="px-3 py-4 text-xs text-gray-400 text-center">No suppliers saved yet.</div>';
      dropdown.innerHTML = html;

      dropdown.querySelectorAll('.purchaseSupplierOption').forEach(button => {
        button.addEventListener('mousedown', e => e.preventDefault());
        button.addEventListener('click', () => {
          const record = suppliers.find(s => s.id === button.dataset.id);
          if (!record) return;
          input.value = record.name;
          input.dataset.supplierId = record.id;
          setStatus(`✓ Linked to Supplier Master · ${record.contactPerson || record.business || 'record ready'}`, 'linked');
          dropdown.classList.add('hidden');
        });
      });
      dropdown.querySelector('#purchaseSupplierNew')?.addEventListener('mousedown', e => e.preventDefault());
      dropdown.querySelector('#purchaseSupplierNew')?.addEventListener('click', () => {
        delete input.dataset.supplierId;
        setStatus(`New supplier — “${clean(input.value)}” will be added to Supplier Master when received.`, 'new');
        dropdown.classList.add('hidden');
      });
    };

    input.addEventListener('focus', () => { render(); dropdown.classList.remove('hidden'); });
    input.addEventListener('input', () => {
      const record = findSupplier(input.value);
      if (record) {
        input.dataset.supplierId = record.id;
        setStatus(`✓ Linked to Supplier Master · ${record.contactPerson || record.business || 'record ready'}`, 'linked');
      } else {
        delete input.dataset.supplierId;
        setStatus(clean(input.value) ? `New supplier — “${clean(input.value)}” will be added to Supplier Master when received.` : 'Select an existing supplier or create a new one.', clean(input.value) ? 'new' : 'neutral');
      }
      render();
      dropdown.classList.remove('hidden');
    });
    input.addEventListener('keydown', e => { if (e.key === 'Escape') dropdown.classList.add('hidden'); });
    document.addEventListener('click', e => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden');
    });
  };

  const watchForPurchaseField = () => {
    const input = document.getElementById('purchaseSupplier');
    if (input) install(input);
    if (input?.dataset.supplierUiInstalled === '1') observer.disconnect();
  };

  const observer = new MutationObserver(watchForPurchaseField);
  observer.observe(document.body, { childList: true, subtree: true });

  onAuthStateChanged(auth, user => {
    if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    if (!user) return;
    unsubscribe = onSnapshot(collection(db, 'suppliers'), snap => {
      suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      watchForPurchaseField();
    }, err => console.warn('Purchase supplier UI could not load suppliers:', err));
    watchForPurchaseField();
  });
}
