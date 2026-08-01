// admin/js/admin-app.mjs
import { initFirebase } from '../../js/firebase.mjs';
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  watchProducts, addProduct, updateProduct, deleteProduct,
  watchOrders, updateOrderStatus,
  getSettings, saveSettings
} from '../../js/store.mjs';

const { auth } = initFirebase();

let allProducts = [];
let unsubProducts = null;
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
    if (unsubOrders) unsubOrders();
  }
});

function startDashboard() {
  unsubProducts = watchProducts((products) => {
    allProducts = products;
    renderProductList();
  });
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

/* ---------------- PRODUCTS ---------------- */

const productForm = document.getElementById('productForm');
productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = document.getElementById('editId').value;

  const product = {
    name: document.getElementById('pName').value.trim(),
    category: document.getElementById('pCategory').value.trim(),
    price: parseInt(document.getElementById('pPrice').value, 10),
    promoPrice: parseInt(document.getElementById('pPromoPrice').value, 10) || 0,
    image: document.getElementById('pImage').value.trim(),
    desc: document.getElementById('pDesc').value.trim(),
    inStock: document.getElementById('pInStock').value === 'true'
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
}

function editProduct(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('editId').value = p.id;
  document.getElementById('pName').value = p.name || '';
  document.getElementById('pCategory').value = p.category || '';
  document.getElementById('pPrice').value = p.price || '';
  document.getElementById('pPromoPrice').value = p.promoPrice || '';
  document.getElementById('pImage').value = p.image || '';
  document.getElementById('pDesc').value = p.desc || '';
  document.getElementById('pInStock').value = p.inStock === false ? 'false' : 'true';
  document.getElementById('formTitle').textContent = 'Editing: ' + p.name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removeProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  await deleteProduct(id);
}

function renderProductList() {
  const term = document.getElementById('productSearch').value.toLowerCase();
  const filtered = allProducts.filter(p => (p.name || '').toLowerCase().includes(term));
  document.getElementById('productCount').textContent = `${allProducts.length} items`;

  document.getElementById('productList').innerHTML = filtered.map(p => `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
      <img src="${p.image || 'https://via.placeholder.com/60'}" class="w-12 h-12 rounded-lg object-cover bg-gray-100">
      <div class="flex-grow min-w-0">
        <h4 class="font-bold text-xs text-gray-800 leading-tight truncate">${p.name}</h4>
        <p class="text-[10px] text-gray-400 font-bold uppercase">${p.category} · ₦${(p.price || 0).toLocaleString()}
          ${p.promoPrice > 0 ? `<span class="text-red-500">(promo ₦${p.promoPrice.toLocaleString()})</span>` : ''}
          ${p.inStock === false ? '<span class="text-red-400">· OUT OF STOCK</span>' : ''}
        </p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button data-edit="${p.id}" class="text-[10px] bg-gray-100 hover:bg-black hover:text-white px-3 py-1 rounded-md font-bold transition-all">EDIT</button>
        <button data-del="${p.id}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded-md font-bold transition-all">DEL</button>
      </div>
    </div>
  `).join('') || `<p class="text-center text-gray-400 text-sm py-10">No products yet — add your first one above.</p>`;

  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editProduct(b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => removeProduct(b.dataset.del)));
}

document.getElementById('productSearch').addEventListener('keyup', renderProductList);

/* ---------------- ORDERS ---------------- */

const STATUS_FLOW = ['new', 'confirmed', 'delivered'];
const STATUS_COLORS = { new: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', delivered: 'bg-green-100 text-green-700' };

function renderOrderList(orders) {
  document.getElementById('orderList').innerHTML = orders.map(o => {
    const itemsHtml = (o.items || []).map(i => `${i.name} × ${i.quantity}`).join(', ');
    const nextStatus = STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
    const created = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : '';
    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-bold text-sm text-gray-800">${o.customerName || 'Unknown'}</p>
            <p class="text-xs text-gray-400">${o.phone || ''} · ${created}</p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-500'}">${o.status || 'new'}</span>
        </div>
        <p class="text-xs text-gray-600 mb-1">${itemsHtml}</p>
        <p class="text-xs text-gray-400 mb-3">${o.address || ''}</p>
        <div class="flex justify-between items-center">
          <span class="font-black text-sm text-[#00B09B]">₦${(o.total || 0).toLocaleString()}</span>
          ${nextStatus ? `<button data-order="${o.id}" data-next="${nextStatus}" class="advance-order-btn text-[10px] bg-gray-900 text-white px-3 py-1.5 rounded-md font-bold">Mark ${nextStatus}</button>` : ''}
        </div>
      </div>
    `;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No orders yet.</p>`;

  document.querySelectorAll('.advance-order-btn').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.order, btn.dataset.next));
  });
}

/* ---------------- SETTINGS ---------------- */

async function loadSettingsForm() {
  const settings = await getSettings();
  document.getElementById('s_whatsapp').value = settings.whatsapp || '';
  document.getElementById('s_tagline').value = settings.tagline || '';
  document.getElementById('s_about').value = settings.aboutText || '';
}

document.getElementById('settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveSettings({
    whatsapp: document.getElementById('s_whatsapp').value.trim(),
    tagline: document.getElementById('s_tagline').value.trim(),
    aboutText: document.getElementById('s_about').value.trim()
  });
  const msg = document.getElementById('settingsMsg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
});
