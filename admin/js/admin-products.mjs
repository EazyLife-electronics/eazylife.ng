// admin/js/admin-products.mjs
// Products tab: add/edit form (with variants + upgrades), product list,
// and Excel export/import. Split out of admin-app.mjs.

import { addProduct, updateProduct, deleteProduct } from '../../js/store.mjs';
import { escapeHtml, updateImagePreview } from './admin-shared.mjs';

let allProducts = [];

/* ---------------- FORM ---------------- */

const productForm = document.getElementById('productForm');
let variantRowCounter = 0;
let upgradeRowCounter = 0;

function variantRowHTML(rowId, v = {}) {
  return `
    <div class="variant-row bg-white border border-gray-200 rounded-xl p-3" data-row-id="${rowId}">
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="v${rowId}_color" placeholder="Color" value="${escapeHtml(v.color || '')}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <input id="v${rowId}_processor" placeholder="Processor" value="${escapeHtml(v.processor || '')}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="v${rowId}_ram" placeholder="RAM (e.g. 16GB)" value="${escapeHtml(v.ram || '')}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <input id="v${rowId}_rom" placeholder="Storage (e.g. 512GB)" value="${escapeHtml(v.rom || '')}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="v${rowId}_price" type="number" placeholder="Price (₦)" value="${v.price || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <input id="v${rowId}_promo" type="number" placeholder="Promo price" value="${v.promoPrice || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      </div>
      <div class="flex gap-2 mb-2">
        <input id="v${rowId}_image" placeholder="Image URL" value="${escapeHtml(v.image || '')}" class="flex-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <button type="button" onclick="openImagePicker('products','v${rowId}_image')" class="bg-gray-100 text-gray-700 px-3 rounded-lg font-bold text-[10px] whitespace-nowrap">Browse</button>
      </div>
      <img id="v${rowId}_preview" class="${v.image ? '' : 'hidden'} mb-2 h-12 rounded-lg object-cover border border-gray-200" src="${v.image ? escapeHtml(v.image.startsWith('http') ? v.image : '../' + v.image) : ''}">
      <div class="mb-2">
        <input id="v${rowId}_deliveryFee" type="number" placeholder="Delivery fee for this variant (₦) — blank = use general" value="${v.deliveryFee != null ? v.deliveryFee : ''}" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <label class="flex items-center gap-2 text-[10px] font-bold text-gray-500 mt-1.5 px-1">
          <input type="checkbox" id="v${rowId}_deliveryGeneral" ${v.deliveryRoute === 'separate' ? '' : 'checked'}>
          Stack with general delivery route
        </label>
        <p class="text-[9px] text-gray-400 mt-1 px-1">Blank fee always uses the general route. With a custom fee set: checked = pools together with other general-route items for the discount; unchecked = this variant's own quantity discounts on its own, separately.</p>
      </div>
      <div class="mb-2 bg-gray-50 rounded-lg p-2 border border-gray-200">
        <label class="flex items-center gap-2 text-[11px] font-bold text-gray-600 mb-1.5">
          <input type="checkbox" id="v${rowId}_bulkEnabled" ${v.bulkSavingsEnabled ? 'checked' : ''}>
          Bulk savings
        </label>
        <div id="v${rowId}_bulkFields" class="${v.bulkSavingsEnabled ? '' : 'hidden'} space-y-1.5">
          <label class="flex items-center gap-3 text-[10px] font-bold text-gray-500">
            <span class="flex items-center gap-1"><input type="radio" name="v${rowId}_bulkMode" value="general" ${v.bulkSavingsMode === 'own' ? '' : 'checked'}> Inherit general</span>
            <span class="flex items-center gap-1"><input type="radio" name="v${rowId}_bulkMode" value="own" ${v.bulkSavingsMode === 'own' ? 'checked' : ''}> Own</span>
          </label>
          <div id="v${rowId}_bulkOwnFields" class="${v.bulkSavingsMode === 'own' ? '' : 'hidden'} grid grid-cols-2 gap-2">
            <input id="v${rowId}_bulkPercent" type="number" step="0.1" placeholder="Discount (%)" value="${v.bulkSavingsPercent != null ? v.bulkSavingsPercent : ''}" class="p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">
            <input id="v${rowId}_bulkMinQty" type="number" placeholder="Min quantity" value="${v.bulkSavingsMinQty != null ? v.bulkSavingsMinQty : ''}" class="p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">
          </div>
          <p class="text-[9px] text-gray-400 px-1">Flat % off this line's total once quantity hits the minimum — not tiered, not compounding. "Inherit general" uses the site-wide % and minimum quantity set in Settings.</p>
        </div>
      </div>
      <div class="flex justify-between items-center">
        <label class="flex items-center gap-2 text-[11px] font-bold text-gray-500">
          <input type="checkbox" id="v${rowId}_instock" ${v.inStock === false ? '' : 'checked'}> In stock
        </label>
        <button type="button" class="remove-variant-btn text-red-500 text-[11px] font-bold" data-row-id="${rowId}">Remove</button>
      </div>
    </div>`;
}

function upgradeRowHTML(rowId, u = {}) {
  return `
    <div class="upgrade-row bg-white border border-gray-200 rounded-xl p-3 flex gap-2 items-center" data-row-id="${rowId}">
      <input id="u${rowId}_name" placeholder="Upgrade name (e.g. RAM upgrade to 16GB)" value="${escapeHtml(u.name || '')}" class="flex-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      <input id="u${rowId}_price" type="number" placeholder="+₦" value="${u.price || ''}" class="w-24 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      <button type="button" class="remove-upgrade-btn text-red-500 text-[11px] font-bold" data-row-id="${rowId}">Remove</button>
    </div>`;
}

function addVariantRow(data) {
  variantRowCounter++;
  const rowId = variantRowCounter;
  document.getElementById('variantRows').insertAdjacentHTML('beforeend', variantRowHTML(rowId, data));
  document.getElementById(`v${rowId}_image`).addEventListener('input', () => updateImagePreview(`v${rowId}_image`, `v${rowId}_preview`));
  document.querySelector(`.remove-variant-btn[data-row-id="${rowId}"]`).addEventListener('click', () => {
    document.querySelector(`.variant-row[data-row-id="${rowId}"]`).remove();
  });
  document.getElementById(`v${rowId}_bulkEnabled`).addEventListener('change', (e) => {
    document.getElementById(`v${rowId}_bulkFields`).classList.toggle('hidden', !e.target.checked);
  });
  document.querySelectorAll(`input[name="v${rowId}_bulkMode"]`).forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById(`v${rowId}_bulkOwnFields`).classList.toggle('hidden', radio.value !== 'own' || !radio.checked);
    });
  });
}

function addUpgradeRow(data) {
  upgradeRowCounter++;
  const rowId = upgradeRowCounter;
  document.getElementById('upgradeRows').insertAdjacentHTML('beforeend', upgradeRowHTML(rowId, data));
  document.querySelector(`.remove-upgrade-btn[data-row-id="${rowId}"]`).addEventListener('click', () => {
    document.querySelector(`.upgrade-row[data-row-id="${rowId}"]`).remove();
  });
}

function collectVariants() {
  return [...document.querySelectorAll('.variant-row')].map(row => {
    const rowId = row.dataset.rowId;
    const deliveryFeeRaw = document.getElementById(`v${rowId}_deliveryFee`).value.trim();
    const bulkEnabled = document.getElementById(`v${rowId}_bulkEnabled`).checked;
    const bulkModeOwn = document.querySelector(`input[name="v${rowId}_bulkMode"][value="own"]`).checked;
    return {
      id: 'v' + Date.now() + '_' + rowId,
      color: document.getElementById(`v${rowId}_color`).value.trim(),
      processor: document.getElementById(`v${rowId}_processor`).value.trim(),
      ram: document.getElementById(`v${rowId}_ram`).value.trim(),
      rom: document.getElementById(`v${rowId}_rom`).value.trim(),
      price: parseInt(document.getElementById(`v${rowId}_price`).value, 10) || 0,
      promoPrice: parseInt(document.getElementById(`v${rowId}_promo`).value, 10) || 0,
      image: document.getElementById(`v${rowId}_image`).value.trim(),
      deliveryFee: deliveryFeeRaw === '' ? null : parseInt(deliveryFeeRaw, 10),
      deliveryRoute: document.getElementById(`v${rowId}_deliveryGeneral`).checked ? 'general' : 'separate',
      bulkSavingsEnabled: bulkEnabled,
      bulkSavingsMode: bulkModeOwn ? 'own' : 'general',
      bulkSavingsPercent: parseFloat(document.getElementById(`v${rowId}_bulkPercent`).value) || 0,
      bulkSavingsMinQty: parseInt(document.getElementById(`v${rowId}_bulkMinQty`).value, 10) || 0,
      inStock: document.getElementById(`v${rowId}_instock`).checked
    };
  });
}

function collectUpgrades() {
  return [...document.querySelectorAll('.upgrade-row')].map(row => {
    const rowId = row.dataset.rowId;
    return {
      id: 'u' + Date.now() + '_' + rowId,
      name: document.getElementById(`u${rowId}_name`).value.trim(),
      price: parseInt(document.getElementById(`u${rowId}_price`).value, 10) || 0
    };
  }).filter(u => u.name);
}

function resetForm() {
  productForm.reset();
  document.getElementById('editId').value = '';
  document.getElementById('formTitle').textContent = 'Add Product';
  document.getElementById('variantRows').innerHTML = '';
  document.getElementById('upgradeRows').innerHTML = '';
  document.getElementById('pInStock').checked = true;
  addVariantRow(); // always start with one empty variant row
}

function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('editId').value = p.id;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pBrand').value = p.brand || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pDesc').value = p.desc || '';
  document.getElementById('pInStock').checked = p.inStock !== false;

  document.getElementById('variantRows').innerHTML = '';
  document.getElementById('upgradeRows').innerHTML = '';
  (p.variants || []).forEach(v => addVariantRow(v));
  (p.upgrades || []).forEach(u => addUpgradeRow(u));
  if ((p.variants || []).length === 0) addVariantRow();

  document.getElementById('formTitle').textContent = 'Editing: ' + p.name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  await deleteProduct(id);
}

/* ---------------- LIST ---------------- */

function priceRangeLabel(p) {
  const prices = (p.variants || []).map(v => (v.promoPrice > 0 ? v.promoPrice : v.price) || 0).filter(Boolean);
  if (prices.length === 0) return '—';
  const min = Math.min(...prices), max = Math.max(...prices);
  return min === max ? `₦${min.toLocaleString()}` : `₦${min.toLocaleString()} – ₦${max.toLocaleString()}`;
}

function renderProductList() {
  const term = document.getElementById('productSearch').value.toLowerCase();
  const filtered = allProducts.filter(p => (p.name || '').toLowerCase().includes(term));
  document.getElementById('productCount').textContent = `${allProducts.length} items`;

  document.getElementById('productList').innerHTML = filtered.map(p => {
    const thumb = (p.variants && p.variants[0] && p.variants[0].image) || 'assets/pictures/placeholder.svg';
    const variantCount = (p.variants || []).length;
    return `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
      <img src="${thumb.startsWith('http') ? escapeHtml(thumb) : escapeHtml('../' + thumb)}" class="w-12 h-12 rounded-lg object-cover bg-gray-100">
      <div class="flex-grow min-w-0">
        <h4 class="font-bold text-xs text-gray-800 leading-tight truncate">${escapeHtml(p.name)}</h4>
        <p class="text-[10px] text-gray-400 font-bold uppercase">${p.brand ? escapeHtml(p.brand) + ' · ' : ''}${escapeHtml(p.category || '')} · ${priceRangeLabel(p)}
          ${p.inStock === false ? '<span class="text-red-400">· HIDDEN</span>' : ''}
        </p>
        <p class="text-[10px] text-gray-400">${variantCount} variant${variantCount === 1 ? '' : 's'}${(p.upgrades || []).length ? ` · ${p.upgrades.length} upgrade option${p.upgrades.length === 1 ? '' : 's'}` : ''}</p>
        <p class="text-[9px] text-gray-300 font-mono select-all">ID: ${escapeHtml(p.id)}</p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button data-edit="${escapeHtml(p.id)}" class="text-[10px] bg-gray-100 hover:bg-black hover:text-white px-3 py-1 rounded-md font-bold transition-all">EDIT</button>
        <button data-del="${escapeHtml(p.id)}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded-md font-bold transition-all">DEL</button>
      </div>
    </div>`;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No products yet — add your first one above.</p>`;

  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeProduct(b.dataset.del)));
}

/* ---------------- EXCEL EXPORT / IMPORT ---------------- */

function exportProductsToExcel() {
  const productRows = [];
  const upgradeRows = [];

  allProducts.forEach(p => {
    (p.variants || []).forEach(v => {
      productRows.push({
        'Product ID': p.id,
        'Product Name': p.name,
        'Brand': p.brand || '',
        'Category': p.category || '',
        'Description': p.desc || '',
        'Product In Stock': p.inStock !== false,
        'Variant ID': v.id,
        'Color': v.color || '',
        'RAM': v.ram || '',
        'Storage': v.rom || '',
        'Processor': v.processor || '',
        'Price': v.price || 0,
        'Promo Price': v.promoPrice || 0,
        'Delivery Fee (blank=general)': v.deliveryFee != null ? v.deliveryFee : '',
        'Delivery Route (general/separate)': v.deliveryRoute || 'general',
        'Bulk Savings Enabled': v.bulkSavingsEnabled ? true : false,
        'Bulk Savings Mode (own/general)': v.bulkSavingsMode || 'general',
        'Bulk Savings %': v.bulkSavingsPercent || 0,
        'Bulk Savings Min Qty': v.bulkSavingsMinQty || 0,
        'Image': v.image || '',
        'Variant In Stock': v.inStock !== false
      });
    });
    (p.upgrades || []).forEach(u => {
      upgradeRows.push({
        'Product ID': p.id,
        'Product Name': p.name,
        'Upgrade Name': u.name,
        'Upgrade Price': u.price || 0
      });
    });
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productRows), 'Products');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(upgradeRows), 'Upgrades');
  XLSX.writeFile(wb, `eazylife-products-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function showImportStatus(text) {
  const el = document.getElementById('importStatus');
  el.textContent = text;
  el.classList.remove('hidden');
}

function truthy(val) {
  return val !== false && val !== 'FALSE' && val !== 'false' && val !== 0;
}

// Mobile spreadsheet apps (Google Sheets, Excel mobile, WPS, etc.) often don't
// update a worksheet's stored !ref range when new rows/cols are typed in, which
// makes XLSX.utils.sheet_to_json() silently ignore anything outside the original
// exported range. Recompute the real used range from actual cell keys instead.
function getEffectiveRange(sheet) {
  let maxR = 0, maxC = 0;
  Object.keys(sheet).forEach(key => {
    if (key[0] === '!') return;
    const { r, c } = XLSX.utils.decode_cell(key);
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  });
  return { s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } };
}

async function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  showImportStatus('Reading file...');

  try {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const productSheet = wb.Sheets['Products'];
    const upgradeSheet = wb.Sheets['Upgrades'];
    if (!productSheet) throw new Error('No "Products" sheet found in this file.');

    const productRows = XLSX.utils.sheet_to_json(productSheet, { range: getEffectiveRange(productSheet) });
    const upgradeRows = upgradeSheet ? XLSX.utils.sheet_to_json(upgradeSheet, { range: getEffectiveRange(upgradeSheet) }) : [];
    showImportStatus(`Parsed ${productRows.length} product row(s), ${upgradeRows.length} upgrade row(s)...`);

    // Group rows into products, keyed by Product ID when present, otherwise by Product Name
    // (so multiple blank-ID rows sharing the same name become variants of one new product).
    const groups = new Map();
    productRows.forEach(row => {
      const id = (row['Product ID'] || '').toString().trim();
      const name = (row['Product Name'] || '').toString().trim();
      if (!name) return;
      const key = id || ('NEW::' + name);

      if (!groups.has(key)) {
        groups.set(key, {
          id: id || null,
          name,
          brand: (row['Brand'] || '').toString().trim(),
          category: (row['Category'] || '').toString().trim(),
          desc: (row['Description'] || '').toString().trim(),
          inStock: truthy(row['Product In Stock']),
          variants: [],
          upgrades: []
        });
      }
      const group = groups.get(key);
      const variantId = (row['Variant ID'] || '').toString().trim() || ('v' + Date.now() + '_' + Math.random().toString(36).slice(2, 8));
      const deliveryFeeRaw = row['Delivery Fee (blank=general)'];
      const deliveryFeeStr = (deliveryFeeRaw === undefined || deliveryFeeRaw === null) ? '' : deliveryFeeRaw.toString().trim();
      group.variants.push({
        id: variantId,
        color: (row['Color'] || '').toString().trim(),
        ram: (row['RAM'] || '').toString().trim(),
        rom: (row['Storage'] || '').toString().trim(),
        processor: (row['Processor'] || '').toString().trim(),
        price: parseInt(row['Price'], 10) || 0,
        promoPrice: parseInt(row['Promo Price'], 10) || 0,
        deliveryFee: deliveryFeeStr === '' ? null : parseInt(deliveryFeeStr, 10),
        deliveryRoute: (row['Delivery Route (general/separate)'] || '').toString().trim().toLowerCase() === 'separate' ? 'separate' : 'general',
        bulkSavingsEnabled: truthy(row['Bulk Savings Enabled']),
        bulkSavingsMode: (row['Bulk Savings Mode (own/general)'] || '').toString().trim().toLowerCase() === 'own' ? 'own' : 'general',
        bulkSavingsPercent: parseFloat(row['Bulk Savings %']) || 0,
        bulkSavingsMinQty: parseInt(row['Bulk Savings Min Qty'], 10) || 0,
        image: (row['Image'] || '').toString().trim(),
        inStock: truthy(row['Variant In Stock'])
      });
    });

    upgradeRows.forEach(row => {
      const id = (row['Product ID'] || '').toString().trim();
      const name = (row['Product Name'] || '').toString().trim();
      const key = id || ('NEW::' + name);
      const group = groups.get(key);
      if (!group) return; // upgrade refers to a product not present in the Products sheet
      const upgradeName = (row['Upgrade Name'] || '').toString().trim();
      if (!upgradeName) return;
      group.upgrades.push({
        id: 'u' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: upgradeName,
        price: parseInt(row['Upgrade Price'], 10) || 0
      });
    });

    let updated = 0, created = 0, failed = 0;
    let i = 0;
    for (const group of groups.values()) {
      i++;
      showImportStatus(`Saving ${i} of ${groups.size}...`);
      const productData = {
        name: group.name,
        brand: group.brand,
        category: group.category,
        desc: group.desc,
        inStock: group.inStock,
        variants: group.variants,
        upgrades: group.upgrades
      };
      try {
        if (group.id) {
          await updateProduct(group.id, productData);
          updated++;
        } else {
          await addProduct(productData);
          created++;
        }
      } catch (err) {
        console.error('Failed to save', group.name, err);
        failed++;
      }
    }

    showImportStatus(`Done: ${updated} updated, ${created} created${failed ? `, ${failed} failed (see console)` : ''}.`);
  } catch (err) {
    showImportStatus('Import failed: ' + err.message);
  } finally {
    e.target.value = ''; // allow re-importing the same file again later if needed
  }
}

/* ---------------- PUBLIC API ---------------- */

export function initProducts() {
  document.getElementById('addVariantBtn').addEventListener('click', () => addVariantRow());
  addVariantRow(); // start the form with one row visible instead of an empty box
  document.getElementById('addUpgradeBtn').addEventListener('click', () => addUpgradeRow());

  productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editId').value;

    const variants = collectVariants();
    if (variants.length === 0) return alert('Add at least one variant — that\'s what customers actually buy.');
    if (variants.some(v => !v.price)) return alert('Every variant needs a price.');

    const product = {
      name: document.getElementById('pName').value.trim(),
      brand: document.getElementById('pBrand').value.trim(),
      category: document.getElementById('pCategory').value.trim(),
      desc: document.getElementById('pDesc').value.trim(),
      inStock: document.getElementById('pInStock').checked,
      variants,
      upgrades: collectUpgrades()
    };

    try {
      if (editId) {
        await updateProduct(editId, product);
      } else {
        await addProduct(product);
      }
      resetForm();
    } catch (err) {
      alert('Failed to save product: ' + err.message);
    }
  });

  document.getElementById('resetFormBtn').addEventListener('click', resetForm);
  document.getElementById('productSearch').addEventListener('keyup', renderProductList);
  document.getElementById('exportExcelBtn').addEventListener('click', exportProductsToExcel);
  document.getElementById('importExcelInput').addEventListener('change', handleImportFile);
}

export function renderProducts(products) {
  allProducts = products;
  renderProductList();
}

export function getAllProducts() {
  return allProducts;
}
