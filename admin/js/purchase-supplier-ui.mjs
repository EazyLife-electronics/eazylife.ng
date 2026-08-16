// Purchase supplier selector UI enhancement.
// Keeps Supplier Master as the source of supplier identity while leaving purchase logic unchanged.

function clean(v) { return String(v || '').trim().replace(/\s+/g, ' '); }
function norm(v) { return clean(v).toLowerCase(); }
function esc(v) { return String(v ?? '').replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c])); }

export function installPurchaseSupplierUI({ getSuppliers, findSupplierByName, ensureSupplierRecord } = {}) {
  const input = document.getElementById('purchaseSupplier');
  if (!input || typeof getSuppliers !== 'function') return false;
  if (input.dataset.supplierUiInstalled === '1') return true;
  input.dataset.supplierUiInstalled = '1';
  input.setAttribute('autocomplete', 'off');
  input.placeholder = 'Select supplier or add a new one';

  const wrapper = input.parentElement;
  if (!wrapper) return false;
  wrapper.classList.add('relative');

  const label = document.createElement('div');
  label.className = 'absolute -top-2 left-3 bg-white px-1 text-[9px] font-black uppercase tracking-wide text-gray-400 z-10';
  label.textContent = 'Supplier';
  wrapper.insertBefore(label, input);

  const status = document.createElement('p');
  status.id = 'purchaseSupplierStatus';
  status.className = 'text-[10px] mt-1 px-1 text-gray-400';
  status.textContent = 'Select an existing supplier or create a new one.';
  input.insertAdjacentElement('afterend', status);

  const dropdown = document.createElement('div');
  dropdown.id = 'purchaseSupplierDropdown';
  dropdown.className = 'hidden absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden';
  dropdown.innerHTML = '<div class="p-3 text-xs text-gray-400">Loading suppliers...</div>';
  status.insertAdjacentElement('afterend', dropdown);

  const setStatus = (text, type='neutral') => {
    const cls = { linked:'text-emerald-600', new:'text-amber-600', neutral:'text-gray-400' };
    status.textContent = text;
    status.className = `text-[10px] mt-1 px-1 ${cls[type] || cls.neutral}`;
  };
  const hide = () => dropdown.classList.add('hidden');
  const show = () => dropdown.classList.remove('hidden');

  const choose = record => {
    input.value = record.name;
    input.dataset.supplierId = record.id;
    setStatus(`✓ Linked to Supplier Master · ${record.contactPerson || record.business || 'record ready'}`, 'linked');
    hide();
  };

  const render = () => {
    const query = norm(input.value);
    const suppliers = getSuppliers() || [];
    const matches = suppliers
      .filter(s => !query || norm(s.name).includes(query) || norm(s.business).includes(query) || norm(s.contactPerson).includes(query))
      .sort((a,b) => String(a.name || '').localeCompare(String(b.name || '')));

    let html = `
      <div class="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <span class="text-[9px] font-black uppercase tracking-wide text-gray-400">Supplier Master</span>
        <span class="text-[9px] text-gray-400">${matches.length} match${matches.length === 1 ? '' : 'es'}</span>
      </div>`;

    html += matches.map(s => `
      <button type="button" data-supplier-id="${esc(s.id)}" class="supplier-ui-option w-full text-left px-3 py-3 hover:bg-gray-50 border-b border-gray-50">
        <span class="flex items-center justify-between gap-2"><span class="text-xs font-black text-gray-800">${esc(s.name)}</span><span class="text-[9px] font-bold text-emerald-600">MASTER</span></span>
        <span class="block text-[10px] text-gray-400 mt-0.5">${esc(s.contactPerson || s.business || 'No contact details')}</span>
      </button>`).join('');

    const exact = typeof findSupplierByName === 'function' ? findSupplierByName(input.value) : null;
    if (!exact && clean(input.value)) {
      html += `
        <button type="button" id="purchaseSupplierCreateOption" class="w-full text-left px-3 py-3 bg-amber-50 hover:bg-amber-100 border-t border-amber-100">
          <span class="flex items-center gap-2"><span class="inline-flex w-6 h-6 rounded-full bg-amber-100 text-amber-700 items-center justify-center font-black">+</span><span><span class="block text-xs font-black text-amber-800">Add “${esc(clean(input.value))}” as new supplier</span><span class="block text-[10px] text-amber-600 mt-0.5">A Supplier Master record will be created when you receive the purchase.</span></span></span>
        </button>`;
    }
    if (!matches.length && !clean(input.value)) html += '<div class="px-3 py-4 text-xs text-gray-400 text-center">No suppliers saved yet.</div>';
    dropdown.innerHTML = html;

    dropdown.querySelectorAll('.supplier-ui-option').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => {
        const record = suppliers.find(s => s.id === btn.dataset.supplierId);
        if (record) choose(record);
      });
    });
    dropdown.querySelector('#purchaseSupplierCreateOption')?.addEventListener('mousedown', e => e.preventDefault());
    dropdown.querySelector('#purchaseSupplierCreateOption')?.addEventListener('click', () => {
      delete input.dataset.supplierId;
      setStatus(`New supplier — “${clean(input.value)}” will be added to Supplier Master when received.`, 'new');
      hide();
    });
  };

  input.addEventListener('focus', () => { render(); show(); });
  input.addEventListener('input', () => {
    const record = typeof findSupplierByName === 'function' ? findSupplierByName(input.value) : null;
    if (record) choose(record);
    else {
      delete input.dataset.supplierId;
      setStatus(clean(input.value) ? `New supplier — “${clean(input.value)}” will be added to Supplier Master when received.` : 'Select an existing supplier or create a new one.', clean(input.value) ? 'new' : 'neutral');
      render(); show();
    }
  });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) hide();
  });

  return true;
}
