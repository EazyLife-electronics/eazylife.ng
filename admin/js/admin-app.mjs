// admin/js/admin-app.mjs
import { initFirebase } from '../../js/firebase.mjs';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  watchProducts, addProduct, updateProduct, deleteProduct,
  watchHeroes, addHero, updateHero, deleteHero,
  watchReviews, addReview, updateReview, deleteReview,
  watchRequests, updateRequestStatus,
  watchOrders, updateOrderStatus, cancelOrder,
  getSettings, saveSettings
} from '../../js/store.mjs';

const { auth } = initFirebase();

// Used by the image picker to list files from assets/products/ and assets/heroes/ on GitHub.
// Update BRANCH if you later switch which branch GitHub Pages deploys from.
const GITHUB_REPO = 'EazyLife-electronics/eazylife.ng';
const GITHUB_BRANCH = 'firebase-v2';

let allProducts = [];
let allHeroes = [];
let allReviews = [];
let unsubProducts = null;
let unsubHeroes = null;
let unsubReviews = null;
let unsubRequests = null;
let unsubOrders = null;

/* ---------------- AUTH ---------------- */

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  errorEl.classList.add('hidden');
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    errorEl.textContent = 'Login failed — check email and password.';
    errorEl.classList.remove('hidden');
  }
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    startDashboard();
  } else {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    if (unsubProducts) unsubProducts();
    if (unsubHeroes) unsubHeroes();
    if (unsubReviews) unsubReviews();
    if (unsubRequests) unsubRequests();
    if (unsubOrders) unsubOrders();
  }
});

function startDashboard() {
  unsubProducts = watchProducts((products) => {
    allProducts = products;
    renderProductList();
    refreshHeroLinkOptions();
  });
  unsubHeroes = watchHeroes((heroes) => {
    allHeroes = heroes;
    renderHeroList();
  });
  unsubReviews = watchReviews((reviews) => {
    allReviews = reviews;
    renderReviewList();
  });
  unsubRequests = watchRequests(renderRequestList);
  unsubOrders = watchOrders(renderOrderList);
  loadSettingsForm();
}

/* ---------------- TABS ---------------- */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
    btn.classList.add('tab-active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`panel-${tab}`).classList.remove('hidden');
  });
});

/* ---------------- IMAGE PICKER (shared by Products + Heroes) ---------------- */
// Lists images from assets/products/ or assets/heroes/ on GitHub so a non-technical
// manager can click a thumbnail instead of typing/copying an image URL.

let pickerTargetInput = null;

function updateImagePreview(inputId, previewId) {
  const val = document.getElementById(inputId).value.trim();
  const img = document.getElementById(previewId);
  if (val) {
    img.src = val.startsWith('http') ? val : '../' + val;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }
}

document.getElementById('hImage').addEventListener('input', () => updateImagePreview('hImage', 'hImagePreview'));

async function openImagePicker(folder, targetInputId) {
  pickerTargetInput = targetInputId;
  const modal = document.getElementById('imagePickerModal');
  const grid = document.getElementById('pickerGrid');
  const hint = document.getElementById('pickerHint');
  hint.textContent = `Showing images from assets/${folder}/ — upload more there on GitHub anytime.`;
  grid.innerHTML = `<p class="col-span-3 text-center text-gray-400 text-sm py-10">Loading images...</p>`;
  modal.classList.remove('hidden');

  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/assets/${folder}?ref=${GITHUB_BRANCH}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Folder not found — has it been created yet?');
    const files = (await res.json()).filter(f => f.type === 'file' && /\.(jpe?g|png|webp|gif)$/i.test(f.name));

    if (files.length === 0) {
      grid.innerHTML = `<p class="col-span-3 text-center text-gray-400 text-sm py-10">No images in assets/${folder}/ yet. Upload some on GitHub, then come back.</p>`;
      return;
    }

    grid.innerHTML = files.map(f => `
      <button type="button" data-picker-path="${f.path}" data-picker-url="${f.download_url}"
              class="picker-thumb rounded-lg overflow-hidden border border-gray-200 hover:border-[#00B09B] aspect-square bg-gray-50">
        <img src="${f.download_url}" class="w-full h-full object-cover" loading="lazy">
      </button>
    `).join('');

    document.querySelectorAll('.picker-thumb').forEach(btn => {
      btn.addEventListener('click', () => {
        const path = btn.dataset.pickerPath; // e.g. assets/products/laptop1.jpg — works directly from index.html/shop.html
        document.getElementById(pickerTargetInput).value = path;
        const previewId = pickerTargetInput.endsWith('_image')
          ? pickerTargetInput.replace('_image', '_preview')
          : 'hImagePreview';
        updateImagePreview(pickerTargetInput, previewId);
        closeImagePicker();
      });
    });
  } catch (err) {
    grid.innerHTML = `<p class="col-span-3 text-center text-red-400 text-sm py-10">Couldn't load images: ${err.message}</p>`;
  }
}

function closeImagePicker() {
  document.getElementById('imagePickerModal').classList.add('hidden');
}

window.openImagePicker = openImagePicker;
window.closeImagePicker = closeImagePicker;

/* ---------------- PRODUCTS ---------------- */

const productForm = document.getElementById('productForm');
let variantRowCounter = 0;
let upgradeRowCounter = 0;

function variantRowHTML(rowId, v = {}) {
  return `
    <div class="variant-row bg-white border border-gray-200 rounded-xl p-3" data-row-id="${rowId}">
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="v${rowId}_color" placeholder="Color" value="${v.color || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <input id="v${rowId}_processor" placeholder="Processor" value="${v.processor || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="v${rowId}_ram" placeholder="RAM (e.g. 16GB)" value="${v.ram || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <input id="v${rowId}_rom" placeholder="Storage (e.g. 512GB)" value="${v.rom || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <input id="v${rowId}_price" type="number" placeholder="Price (₦)" value="${v.price || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <input id="v${rowId}_promo" type="number" placeholder="Promo price" value="${v.promoPrice || ''}" class="p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      </div>
      <div class="flex gap-2 mb-2">
        <input id="v${rowId}_image" placeholder="Image URL" value="${v.image || ''}" class="flex-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
        <button type="button" onclick="openImagePicker('products','v${rowId}_image')" class="bg-gray-100 text-gray-700 px-3 rounded-lg font-bold text-[10px] whitespace-nowrap">Browse</button>
      </div>
      <img id="v${rowId}_preview" class="${v.image ? '' : 'hidden'} mb-2 h-12 rounded-lg object-cover border border-gray-200" src="${v.image ? (v.image.startsWith('http') ? v.image : '../' + v.image) : ''}">
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
      <input id="u${rowId}_name" placeholder="Upgrade name (e.g. RAM upgrade to 16GB)" value="${u.name || ''}" class="flex-1 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      <input id="u${rowId}_price" type="number" placeholder="+₦" value="${u.price || ''}" class="w-24 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
      <button type="button" class="remove-upgrade-btn text-red-500 text-[11px] font-bold" data-row-id="${rowId}">Remove</button>
    </div>`;
}

function addVariantRow(data) {
  variantRowCounter++;
  const rowId = variantRowCounter;
  document.getElementById('variantRows').insertAdjacentHTML('beforeend', variantRowHTML(rowId, data));
  document.getElementById(`v${rowId}_image`).addEventListener('input', () => updateImagePreview(`v${rowId}_image`, `v${rowId}_preview`));
  document.querySelector(`.remove-variant-btn[data-row-id="${rowId}"]`).addEventListener('click', (e) => {
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

document.getElementById('addVariantBtn').addEventListener('click', () => addVariantRow());
addVariantRow(); // start the form with one row visible instead of an empty box
document.getElementById('addUpgradeBtn').addEventListener('click', () => addUpgradeRow());

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
    const thumb = (p.variants && p.variants[0] && p.variants[0].image) || 'https://via.placeholder.com/60';
    const variantCount = (p.variants || []).length;
    return `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
      <img src="${thumb.startsWith('http') ? thumb : '../' + thumb}" class="w-12 h-12 rounded-lg object-cover bg-gray-100">
      <div class="flex-grow min-w-0">
        <h4 class="font-bold text-xs text-gray-800 leading-tight truncate">${p.name}</h4>
        <p class="text-[10px] text-gray-400 font-bold uppercase">${p.brand ? p.brand + ' · ' : ''}${p.category} · ${priceRangeLabel(p)}
          ${p.inStock === false ? '<span class="text-red-400">· HIDDEN</span>' : ''}
        </p>
        <p class="text-[10px] text-gray-400">${variantCount} variant${variantCount === 1 ? '' : 's'}${(p.upgrades || []).length ? ` · ${p.upgrades.length} upgrade option${p.upgrades.length === 1 ? '' : 's'}` : ''}</p>
        <p class="text-[9px] text-gray-300 font-mono select-all">ID: ${p.id}</p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button data-edit="${p.id}" class="text-[10px] bg-gray-100 hover:bg-black hover:text-white px-3 py-1 rounded-md font-bold transition-all">EDIT</button>
        <button data-del="${p.id}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded-md font-bold transition-all">DEL</button>
      </div>
    </div>`;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No products yet — add your first one above.</p>`;

  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeProduct(b.dataset.del)));
}

document.getElementById('productSearch').addEventListener('keyup', renderProductList);

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

document.getElementById('exportExcelBtn').addEventListener('click', exportProductsToExcel);

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

document.getElementById('importExcelInput').addEventListener('change', async (e) => {
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
});

/* ---------------- HEROES ---------------- */

const heroForm = document.getElementById('heroForm');
const hLinkTypeEl = document.getElementById('hLinkType');
const hLinkValueCategoryEl = document.getElementById('hLinkValueCategory');
const hLinkValueProductEl = document.getElementById('hLinkValueProduct');
const hLinkValueUrlEl = document.getElementById('hLinkValueUrl');

function refreshHeroLinkOptions() {
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
  hLinkValueCategoryEl.innerHTML = categories.length
    ? categories.map(c => `<option value="${c}">${c}</option>`).join('')
    : `<option value="">No categories yet — add a product first</option>`;

  hLinkValueProductEl.innerHTML = allProducts.length
    ? allProducts.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
    : `<option value="">No products yet</option>`;
}

function updateHeroLinkTypeVisibility() {
  const type = hLinkTypeEl.value;
  hLinkValueCategoryEl.classList.toggle('hidden', type !== 'category');
  hLinkValueProductEl.classList.toggle('hidden', type !== 'product');
  hLinkValueUrlEl.classList.toggle('hidden', type !== 'url');
}
hLinkTypeEl.addEventListener('change', updateHeroLinkTypeVisibility);
updateHeroLinkTypeVisibility();

function getHeroLinkValue() {
  const type = hLinkTypeEl.value;
  if (type === 'category') return hLinkValueCategoryEl.value;
  if (type === 'product') return hLinkValueProductEl.value;
  return hLinkValueUrlEl.value.trim();
}

heroForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('heroEditId').value;

  const hero = {
    title: document.getElementById('hTitle').value.trim(),
    subtitle: document.getElementById('hSubtitle').value.trim(),
    image: document.getElementById('hImage').value.trim(),
    ctaText: document.getElementById('hCtaText').value.trim(),
    linkType: hLinkTypeEl.value,
    linkValue: getHeroLinkValue(),
    order: parseInt(document.getElementById('hOrder').value, 10) || 0
  };

  try {
    if (editId) {
      await updateHero(editId, hero);
    } else {
      await addHero(hero);
    }
    resetHeroForm();
  } catch (err) {
    alert('Failed to save hero slide: ' + err.message);
  }
});

document.getElementById('heroResetBtn').addEventListener('click', resetHeroForm);

function resetHeroForm() {
  heroForm.reset();
  document.getElementById('heroEditId').value = '';
  document.getElementById('heroFormTitle').textContent = 'Add Hero Slide';
  updateHeroLinkTypeVisibility();
  updateImagePreview('hImage', 'hImagePreview');
}

function editHero(id) {
  const h = allHeroes.find(x => x.id === id);
  if (!h) return;
  document.getElementById('heroEditId').value = h.id;
  document.getElementById('hTitle').value = h.title || '';
  document.getElementById('hSubtitle').value = h.subtitle || '';
  document.getElementById('hImage').value = h.image || '';
  document.getElementById('hCtaText').value = h.ctaText || '';
  hLinkTypeEl.value = h.linkType || 'category';
  updateHeroLinkTypeVisibility();
  if (h.linkType === 'product') hLinkValueProductEl.value = h.linkValue || '';
  else if (h.linkType === 'url') hLinkValueUrlEl.value = h.linkValue || '';
  else hLinkValueCategoryEl.value = h.linkValue || '';
  document.getElementById('hOrder').value = h.order ?? 0;
  document.getElementById('heroFormTitle').textContent = 'Editing: ' + h.title;
  updateImagePreview('hImage', 'hImagePreview');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeHero(id) {
  if (!confirm('Delete this hero slide?')) return;
  await deleteHero(id);
}

function renderHeroList() {
  document.getElementById('heroList').innerHTML = allHeroes.map(h => `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
      <img src="${h.image || 'https://via.placeholder.com/60x40'}" class="w-16 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0">
      <div class="flex-grow min-w-0">
        <h4 class="font-bold text-xs text-gray-800 leading-tight truncate">${h.title}</h4>
        <p class="text-[10px] text-gray-400 font-bold uppercase">Order ${h.order ?? 0} · ${h.linkType} → ${h.linkValue}</p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button data-hedit="${h.id}" class="text-[10px] bg-gray-100 hover:bg-black hover:text-white px-3 py-1 rounded-md font-bold transition-all">EDIT</button>
        <button data-hdel="${h.id}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded-md font-bold transition-all">DEL</button>
      </div>
    </div>
  `).join('') || `<p class="text-center text-gray-400 text-sm py-10">No hero slides yet — add one above. The homepage carousel stays hidden until you add at least one.</p>`;

  document.querySelectorAll('[data-hedit]').forEach(b => b.addEventListener('click', () => editHero(b.dataset.hedit)));
  document.querySelectorAll('[data-hdel]').forEach(b => b.addEventListener('click', () => removeHero(b.dataset.hdel)));
}

/* ---------------- REVIEWS ---------------- */

document.getElementById('reviewAddForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const review = {
    name: document.getElementById('rvName').value.trim(),
    title: document.getElementById('rvTitle').value.trim(),
    stars: parseInt(document.getElementById('rvStars').value, 10),
    text: document.getElementById('rvText').value.trim(),
    approved: document.getElementById('rvApproved').checked
  };
  try {
    await addReview(review);
    e.target.reset();
    document.getElementById('rvApproved').checked = true;
  } catch (err) {
    alert('Failed to save review: ' + err.message);
  }
});

async function toggleReviewApproval(id, current) {
  await updateReview(id, { approved: !current });
}

async function removeReview(id) {
  if (!confirm('Delete this review permanently?')) return;
  await deleteReview(id);
}

function renderReviewList() {
  document.getElementById('reviewList').innerHTML = allReviews.map(r => `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-bold text-sm text-gray-800">${r.name}</p>
          <p class="text-xs text-gray-400">${r.title || ''} · ${'★'.repeat(r.stars || 0)}${'☆'.repeat(5 - (r.stars || 0))}</p>
        </div>
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${r.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${r.approved ? 'Live' : 'Hidden'}</span>
      </div>
      <p class="text-xs text-gray-600 mb-3">"${r.text}"</p>
      <div class="flex gap-2">
        <button data-toggle="${r.id}" data-current="${r.approved}" class="toggle-review-btn text-[10px] ${r.approved ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-white'} px-3 py-1.5 rounded-md font-bold">
          ${r.approved ? 'Deactivate' : 'Approve'}
        </button>
        <button data-rvdel="${r.id}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-md font-bold transition-all">Delete</button>
      </div>
    </div>
  `).join('') || `<p class="text-center text-gray-400 text-sm py-10">No reviews yet — add one above.</p>`;

  document.querySelectorAll('.toggle-review-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleReviewApproval(btn.dataset.toggle, btn.dataset.current === 'true'));
  });
  document.querySelectorAll('[data-rvdel]').forEach(b => b.addEventListener('click', () => removeReview(b.dataset.rvdel)));
}

/* ---------------- SOURCING REQUESTS ---------------- */

const REQ_STATUS_FLOW = ['new', 'contacted', 'fulfilled'];
const REQ_STATUS_COLORS = { new: 'bg-yellow-100 text-yellow-700', contacted: 'bg-blue-100 text-blue-700', fulfilled: 'bg-green-100 text-green-700' };

function renderRequestList(requests) {
  document.getElementById('requestList').innerHTML = requests.map(r => {
    const nextStatus = REQ_STATUS_FLOW[REQ_STATUS_FLOW.indexOf(r.status) + 1];
    const created = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : '';
    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-bold text-sm text-gray-800">${r.name || 'Unknown'}</p>
            <p class="text-xs text-gray-400">${r.phone || ''} · ${created}</p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${REQ_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}">${r.status || 'new'}</span>
        </div>
        <p class="text-xs text-gray-600 mb-1"><b>Needs:</b> ${r.need || ''}</p>
        ${r.category ? `<p class="text-xs text-gray-400 mb-1"><b>Category:</b> ${r.category}</p>` : ''}
        ${r.budget ? `<p class="text-xs text-gray-400 mb-3"><b>Budget:</b> ₦${Number(r.budget).toLocaleString()}</p>` : '<div class="mb-3"></div>'}
        <div class="flex justify-end">
          ${nextStatus ? `<button data-req="${r.id}" data-next="${nextStatus}" class="advance-req-btn text-[10px] bg-gray-900 text-white px-3 py-1.5 rounded-md font-bold">Mark ${nextStatus}</button>` : ''}
        </div>
      </div>
    `;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No requests yet.</p>`;

  document.querySelectorAll('.advance-req-btn').forEach(btn => {
    btn.addEventListener('click', () => updateRequestStatus(btn.dataset.req, btn.dataset.next));
  });
}

/* ---------------- ORDERS ---------------- */

const STATUS_FLOW = ['new', 'confirmed', 'delivered'];
const STATUS_COLORS = { new: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

const CANCEL_REASONS = {
  out_of_stock: 'Out of stock',
  payment_failed: 'Payment could not be confirmed'
};

// What the customer is told, if anything. 'other' uses the admin's own wording;
// a null reason means the customer just sees "cancelled" with no explanation.
function cancelReasonLabel(order) {
  if (!order.cancelReason) return null;
  if (order.cancelReason === 'other') return order.cancelCustomerNote || 'Other';
  return CANCEL_REASONS[order.cancelReason] || null;
}

// Nigerian numbers can arrive as 0805..., 234805..., or +234805... — WhatsApp's wa.me links
// need the country-code form with no plus and no leading zero.
function normalizeForWhatsApp(phone) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '234' + digits.slice(1);
  else if (!digits.startsWith('234') && digits.length === 10) digits = '234' + digits;
  return digits;
}

function orderMessageTemplate(order) {
  const name = order.customerName || 'there';
  const code = order.trackingCode || order.id;
  const itemsList = (order.items || []).map(i => i.name).join(', ');
  const trackUrl = `https://eazylife.ng/track.html?code=${code}`;
  if (order.status === 'cancelled') {
    const reasonLabel = cancelReasonLabel(order);
    return reasonLabel
      ? `Hi ${name}, unfortunately we're unable to fulfill your order (${code}) for ${itemsList} — ${reasonLabel.toLowerCase()}. We're sorry for the inconvenience — reach out to us if you have any questions.`
      : `Hi ${name}, unfortunately we're unable to fulfill your order (${code}) for ${itemsList} at this time. We're sorry for the inconvenience — reach out to us if you'd like to know more or place a new order.`;
  }
  const templates = {
    new: `Hi ${name}, thanks for your order with EazyLife! We're confirming your order (${code}) for ${itemsList} and will update you shortly. Track anytime: ${trackUrl}`,
    confirmed: `Hi ${name}, good news — your order (${code}) is confirmed and on its way! We'll reach out again once it's close to delivery. Track: ${trackUrl}`,
    delivered: `Hi ${name}, your order (${code}) has been delivered. Thank you for shopping with EazyLife — we'd love a quick review if you have a moment!`
  };
  return templates[order.status] || templates.new;
}

function renderOrderList(orders) {
  document.getElementById('orderList').innerHTML = orders.map(o => {
    const itemsHtml = (o.items || []).map(i => `${i.name} × ${i.quantity}`).join(', ');
    const isCancelled = o.status === 'cancelled';
    const canCancel = !isCancelled && o.status !== 'delivered';
    const nextStatus = isCancelled ? null : STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
    const created = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : '';
    const reasonLabel = cancelReasonLabel(o);
    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-bold text-sm text-gray-800">${o.customerName || 'Unknown'}</p>
            <p class="text-xs text-gray-400">${o.phone || ''} · ${created}</p>
            <p class="text-[10px] font-mono text-teal-600 font-bold mt-0.5">${o.trackingCode || o.id}</p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-500'}">${o.status || 'new'}</span>
        </div>
        <p class="text-xs text-gray-600 mb-1">${itemsHtml}</p>
        <p class="text-xs text-gray-400 mb-3">${o.address || ''}</p>
        ${isCancelled ? `
          <div class="bg-red-50 border border-red-100 rounded-lg p-2.5 mb-3">
            <p class="text-[11px] text-red-700"><b>Customer was told:</b> ${reasonLabel ? reasonLabel : 'No reason given'}</p>
            ${o.cancelInternalNote ? `<p class="text-[11px] text-gray-500 mt-1"><b>Internal note:</b> ${o.cancelInternalNote}</p>` : ''}
          </div>
        ` : ''}
        <div class="flex justify-between items-center mb-2">
          <span class="font-black text-sm text-[#00B09B]">₦${(o.total || 0).toLocaleString()}</span>
          <div class="flex gap-2 flex-wrap justify-end">
            <button data-msg-toggle="${o.id}" class="text-[10px] bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md font-bold"><i class="fas fa-comment-dots"></i> Message</button>
            ${nextStatus ? `<button data-order="${o.id}" data-next="${nextStatus}" class="advance-order-btn text-[10px] bg-gray-900 text-white px-3 py-1.5 rounded-md font-bold">Mark ${nextStatus}</button>` : ''}
            ${canCancel ? `<button data-reject-toggle="${o.id}" class="text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-bold"><i class="fas fa-ban"></i> Reject</button>` : ''}
          </div>
        </div>
        ${canCancel ? `
        <div id="rejectBox-${o.id}" class="hidden mt-3 pt-3 border-t border-gray-100 space-y-2">
          <label class="block text-[10px] font-bold uppercase text-gray-400">Reason (shown to customer)</label>
          <select id="rejectReason-${o.id}" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
            <option value="out_of_stock">Out of stock</option>
            <option value="payment_failed">Payment could not be confirmed</option>
            <option value="other">Other — I'll explain below</option>
            <option value="">Don't give the customer a reason</option>
          </select>
          <input id="rejectCustomerNote-${o.id}" placeholder="What to tell the customer" class="hidden w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
          <textarea id="rejectInternalNote-${o.id}" rows="2" placeholder="Internal note (optional, not shown to customer) — e.g. price changed with supplier" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none"></textarea>
          <button data-reject-confirm="${o.id}" class="w-full bg-red-600 text-white text-[11px] font-bold py-2 rounded-lg">Confirm Rejection</button>
        </div>
        ` : ''}
        <div id="msgBox-${o.id}" class="hidden mt-3 pt-3 border-t border-gray-100">
          <textarea id="msgText-${o.id}" rows="4" class="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none mb-2">${orderMessageTemplate(o)}</textarea>
          <div class="flex gap-2">
            <button data-wa-send="${o.id}" data-phone="${o.phone || ''}" class="flex-1 bg-[#25D366] text-white text-[11px] font-bold py-2 rounded-lg"><i class="fab fa-whatsapp"></i> WhatsApp</button>
            <button data-sms-send="${o.id}" data-phone="${o.phone || ''}" class="flex-1 bg-gray-700 text-white text-[11px] font-bold py-2 rounded-lg"><i class="fas fa-comment-sms"></i> SMS</button>
          </div>
        </div>
      </div>
    `;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No orders yet.</p>`;

  document.querySelectorAll('.advance-order-btn').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.order, btn.dataset.next));
  });

  document.querySelectorAll('[data-msg-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`msgBox-${btn.dataset.msgToggle}`).classList.toggle('hidden');
    });
  });

  document.querySelectorAll('[data-reject-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`rejectBox-${btn.dataset.rejectToggle}`).classList.toggle('hidden');
    });
  });

  document.querySelectorAll('select[id^="rejectReason-"]').forEach(select => {
    select.addEventListener('change', () => {
      const id = select.id.replace('rejectReason-', '');
      document.getElementById(`rejectCustomerNote-${id}`).classList.toggle('hidden', select.value !== 'other');
    });
  });

  document.querySelectorAll('[data-reject-confirm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectConfirm;
      const reasonSelect = document.getElementById(`rejectReason-${id}`);
      const reason = reasonSelect.value || null;
      const customerNote = reason === 'other' ? document.getElementById(`rejectCustomerNote-${id}`).value.trim() : null;
      const internalNote = document.getElementById(`rejectInternalNote-${id}`).value.trim();
      if (reason === 'other' && !customerNote) return alert("Please describe what to tell the customer, or pick a different reason.");
      if (!confirm('Reject this order? This cannot be undone from here.')) return;
      btn.disabled = true;
      btn.textContent = 'Rejecting...';
      try {
        await cancelOrder(id, { reason, customerNote: customerNote || null, internalNote: internalNote || null });
      } catch (e) {
        console.error(e);
        alert('Something went wrong rejecting this order.');
        btn.disabled = false;
        btn.textContent = 'Confirm Rejection';
      }
    });
  });

  document.querySelectorAll('[data-wa-send]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = document.getElementById(`msgText-${btn.dataset.waSend}`).value;
      const phone = normalizeForWhatsApp(btn.dataset.phone);
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    });
  });

  document.querySelectorAll('[data-sms-send]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = document.getElementById(`msgText-${btn.dataset.smsSend}`).value;
      const phone = btn.dataset.phone.trim();
      // sms: URI body param isn't perfectly standardized across iOS/Android — if it opens
      // the messages app without the text pre-filled on a given phone, that's a platform quirk,
      // not a bug here; the composed text above is still there to copy-paste manually.
      window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
    });
  });
}

/* ---------------- SETTINGS ---------------- */

async function loadSettingsForm() {
  const settings = await getSettings();
  document.getElementById('s_whatsapp').value = settings.whatsapp || '';
  document.getElementById('s_tagline').value = settings.tagline || '';
  document.getElementById('s_about').value = settings.aboutText || '';
  document.getElementById('s_referralMode').checked = settings.referralMode !== false; // defaults to true
  document.getElementById('s_deliveryFee').value = settings.deliveryFeePerItem ?? 750;
  document.getElementById('s_deliveryDiscount').value = settings.deliveryDiscountPercent ?? 10;
  document.getElementById('s_bulkSavingsPercent').value = settings.bulkSavingsPercent ?? '';
  document.getElementById('s_bulkSavingsMinQty').value = settings.bulkSavingsMinQty ?? '';
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings({
    whatsapp: document.getElementById('s_whatsapp').value.trim(),
    tagline: document.getElementById('s_tagline').value.trim(),
    aboutText: document.getElementById('s_about').value.trim(),
    referralMode: document.getElementById('s_referralMode').checked,
    deliveryFeePerItem: parseInt(document.getElementById('s_deliveryFee').value, 10) || 0,
    deliveryDiscountPercent: parseFloat(document.getElementById('s_deliveryDiscount').value) || 0,
    bulkSavingsPercent: parseFloat(document.getElementById('s_bulkSavingsPercent').value) || 0,
    bulkSavingsMinQty: parseInt(document.getElementById('s_bulkSavingsMinQty').value, 10) || 0
  });
  const msg = document.getElementById('settingsMsg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
});
