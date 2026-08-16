// admin/js/admin-shared.mjs
// Small utilities shared across the admin dashboard sections: HTML escaping,
// tab switching, and the image picker used by both the Products and Heroes
// forms. Split out of admin-app.mjs so each dashboard section can import
// only what it needs instead of one 1000+ line file.

// Escapes user-supplied text before it's dropped into innerHTML templates.
// Anything that originates from a customer or public form submission (order
// name/phone/address, review text, sourcing-request details, etc.) MUST go
// through this before being interpolated — those fields come from public,
// unauthenticated writes and are rendered here with full admin privileges
// live in the page.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

/* ---------------- TABS ---------------- */

export function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
      btn.classList.add('tab-active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`panel-${tab}`).classList.remove('hidden');
    });
  });
}

/* ---------------- IMAGE PICKER (shared by Products + Heroes) ---------------- */
// Lists images from assets/products/ or assets/heroes/ on GitHub so a non-technical
// manager can click a thumbnail instead of typing/copying an image URL.

// Update BRANCH if you later switch which branch GitHub Pages deploys from.
const GITHUB_REPO = 'EazyLife-electronics/eazylife.ng';
const GITHUB_BRANCH = 'firebase-v2';

let pickerTargetInput = null;

export function updateImagePreview(inputId, previewId) {
  const val = document.getElementById(inputId).value.trim();
  const img = document.getElementById(previewId);
  if (val) {
    img.src = val.startsWith('http') ? val : '../' + val;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
  }
}

export async function openImagePicker(folder, targetInputId) {
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
      <button type="button" data-picker-path="${escapeHtml(f.path)}" data-picker-url="${escapeHtml(f.download_url)}"
              class="picker-thumb rounded-lg overflow-hidden border border-gray-200 hover:border-[#00B09B] aspect-square bg-gray-50">
        <img src="${escapeHtml(f.download_url)}" class="w-full h-full object-cover" loading="lazy">
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
    grid.innerHTML = `<p class="col-span-3 text-center text-red-400 text-sm py-10">Couldn't load images: ${escapeHtml(err.message)}</p>`;
  }
}

export function closeImagePicker() {
  document.getElementById('imagePickerModal').classList.add('hidden');
}

// Product/hero form markup calls these via inline onclick="..." attributes,
// so they need to be reachable on window regardless of module scoping.
window.openImagePicker = openImagePicker;
window.closeImagePicker = closeImagePicker;

export function initImagePicker() {
  document.getElementById('hImage').addEventListener('input', () => updateImagePreview('hImage', 'hImagePreview'));
}
