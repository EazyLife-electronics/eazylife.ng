// admin/js/admin-heroes.mjs
// Heroes tab: homepage carousel slide form and list. Split out of admin-app.mjs.

import { addHero, updateHero, deleteHero } from '../../js/store.mjs';
import { escapeHtml, updateImagePreview } from './admin-shared.mjs';

let allHeroes = [];
let allProducts = []; // only needed to populate the "link to product" dropdown

const heroForm = document.getElementById('heroForm');
const hLinkTypeEl = document.getElementById('hLinkType');
const hLinkValueCategoryEl = document.getElementById('hLinkValueCategory');
const hLinkValueProductEl = document.getElementById('hLinkValueProduct');
const hLinkValueUrlEl = document.getElementById('hLinkValueUrl');

function refreshHeroLinkOptions() {
  const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
  hLinkValueCategoryEl.innerHTML = categories.length
    ? categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')
    : `<option value="">No categories yet — add a product first</option>`;

  hLinkValueProductEl.innerHTML = allProducts.length
    ? allProducts.map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('')
    : `<option value="">No products yet</option>`;
}

function updateHeroLinkTypeVisibility() {
  const type = hLinkTypeEl.value;
  hLinkValueCategoryEl.classList.toggle('hidden', type !== 'category');
  hLinkValueProductEl.classList.toggle('hidden', type !== 'product');
  hLinkValueUrlEl.classList.toggle('hidden', type !== 'url');
}

function getHeroLinkValue() {
  const type = hLinkTypeEl.value;
  if (type === 'category') return hLinkValueCategoryEl.value;
  if (type === 'product') return hLinkValueProductEl.value;
  return hLinkValueUrlEl.value.trim();
}

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
      <img src="${h.image ? escapeHtml(h.image) : 'assets/pictures/placeholder.svg'}" class="w-16 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0">
      <div class="flex-grow min-w-0">
        <h4 class="font-bold text-xs text-gray-800 leading-tight truncate">${escapeHtml(h.title)}</h4>
        <p class="text-[10px] text-gray-400 font-bold uppercase">Order ${h.order ?? 0} · ${escapeHtml(h.linkType)} → ${escapeHtml(h.linkValue)}</p>
      </div>
      <div class="flex flex-col gap-1 flex-shrink-0">
        <button data-hedit="${escapeHtml(h.id)}" class="text-[10px] bg-gray-100 hover:bg-black hover:text-white px-3 py-1 rounded-md font-bold transition-all">EDIT</button>
        <button data-hdel="${escapeHtml(h.id)}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1 rounded-md font-bold transition-all">DEL</button>
      </div>
    </div>
  `).join('') || `<p class="text-center text-gray-400 text-sm py-10">No hero slides yet — add one above. The homepage carousel stays hidden until you add at least one.</p>`;

  document.querySelectorAll('[data-hedit]').forEach(b => b.addEventListener('click', () => editHero(b.dataset.hedit)));
  document.querySelectorAll('[data-hdel]').forEach(b => b.addEventListener('click', () => removeHero(b.dataset.hdel)));
}

/* ---------------- PUBLIC API ---------------- */

export function initHeroes() {
  hLinkTypeEl.addEventListener('change', updateHeroLinkTypeVisibility);
  updateHeroLinkTypeVisibility();

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
}

export function renderHeroes(heroes) {
  allHeroes = heroes;
  renderHeroList();
}

// Called whenever the product list changes, since the hero form's "link to
// category" / "link to product" dropdowns are built from it.
export function setProductsForHeroLinks(products) {
  allProducts = products;
  refreshHeroLinkOptions();
}
