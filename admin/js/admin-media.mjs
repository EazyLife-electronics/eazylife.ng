// admin/js/admin-media.mjs
// Admin-only ImageKit media manager. Uploads go directly from the browser
// to ImageKit using short-lived credentials issued by the Cloudflare Worker.
// The ImageKit private key never enters this file or the browser.
import { initFirebase } from '../../js/firebase.mjs';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const WORKER_URL = 'https://eazylife-media.damzyeazy.workers.dev';
const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

const { auth } = initFirebase();
let currentUser = null;
let loadedOnce = false;

const $ = (id) => document.getElementById(id);
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

function setStatus(id, message, kind = 'muted') {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.className = 'text-xs ' + (kind === 'error' ? 'text-red-600' : kind === 'success' ? 'text-green-700' : 'text-gray-500');
}

async function getIdToken() {
  if (!currentUser) throw new Error('Please log in as an administrator first.');
  return currentUser.getIdToken();
}

async function getUploadAuth() {
  const idToken = await getIdToken();
  const response = await fetch(`${WORKER_URL}/auth`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Could not get upload authorization (${response.status}).`);
  if (!data.token || !data.signature || !data.expire || !data.publicKey) {
    throw new Error('The media service returned incomplete upload credentials.');
  }
  return data;
}

function normalizeAssets(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.images)) return payload.images;
  if (Array.isArray(payload?.files)) return payload.files;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function createMediaCard(asset) {
  const url = asset.url || asset.thumbnail || '';
  const name = asset.name || asset.filePath?.split('/').pop() || 'Image';
  if (!url || asset.type === 'folder') return null;

  const card = document.createElement('article');
  card.className = 'border border-gray-100 rounded-xl overflow-hidden bg-white';

  const image = document.createElement('img');
  image.src = asset.thumbnail || url;
  image.alt = name;
  image.loading = 'lazy';
  image.className = 'w-full aspect-square object-cover bg-gray-50';
  card.appendChild(image);

  const body = document.createElement('div');
  body.className = 'p-2';
  const title = document.createElement('p');
  title.className = 'text-[11px] font-bold text-gray-700 truncate';
  title.textContent = name;
  body.appendChild(title);

  const copy = document.createElement('button');
  copy.type = 'button';
  copy.textContent = 'Copy image URL';
  copy.className = 'mt-2 w-full border border-gray-200 rounded-lg py-2 text-[10px] font-bold text-gray-600';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      copy.textContent = 'Copied!';
    } catch {
      copy.textContent = 'Copy unavailable';
    }
  });
  body.appendChild(copy);
  card.appendChild(body);
  return card;
}

async function loadMedia() {
  if (!currentUser) {
    setStatus('mediaLibraryStatus', 'Log in as an administrator to browse media.', 'error');
    return;
  }

  const folder = $('mediaFolder').value;
  const folderName = $('mediaFolder').selectedOptions[0]?.textContent || folder;
  $('mediaFolderLabel').textContent = folderName;
  $('mediaGrid').replaceChildren();
  setStatus('mediaLibraryStatus', 'Loading images…');

  try {
    const idToken = await getIdToken();
    const response = await fetch(`${WORKER_URL}/files?path=${encodeURIComponent(folder)}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Could not load folder (${response.status}).`);

    const assets = normalizeAssets(payload).filter(item => item.type !== 'folder' && (item.fileType === 'image' || !item.fileType));
    const cards = assets.map(createMediaCard).filter(Boolean);
    if (!cards.length) {
      setStatus('mediaLibraryStatus', 'No images found in this folder yet.');
      return;
    }
    $('mediaGrid').replaceChildren(...cards);
    setStatus('mediaLibraryStatus', `${cards.length} image(s) loaded.`, 'success');
  } catch (error) {
    console.error('Media library loading failed:', error);
    setStatus('mediaLibraryStatus', error.message || 'Could not load this folder.', 'error');
  }
}

async function uploadSelectedImage() {
  const file = $('mediaFileInput').files?.[0];
  if (!file) {
    setStatus('mediaUploadStatus', 'Choose an image first.', 'error');
    return;
  }
  if (!allowedTypes.has(file.type)) {
    setStatus('mediaUploadStatus', 'Please choose a JPG, PNG, WebP, GIF or AVIF image.', 'error');
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    setStatus('mediaUploadStatus', 'This image is larger than 25 MB. Please resize it before uploading.', 'error');
    return;
  }

  const button = $('mediaUploadBtn');
  button.disabled = true;
  button.textContent = 'Uploading…';
  setStatus('mediaUploadStatus', 'Getting secure upload authorization…');

  try {
    const authParams = await getUploadAuth();
    const form = new FormData();
    form.append('file', file);
    form.append('fileName', file.name);
    form.append('folder', $('mediaFolder').value);
    form.append('publicKey', authParams.publicKey);
    form.append('token', authParams.token);
    form.append('expire', String(authParams.expire));
    form.append('signature', authParams.signature);
    form.append('useUniqueFileName', 'true');

    setStatus('mediaUploadStatus', 'Sending image securely to ImageKit…');
    const response = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.message || result.error || `ImageKit upload failed (${response.status}).`);
    }

    $('mediaFileInput').value = '';
    setStatus('mediaUploadStatus', `Uploaded successfully: ${result.name || file.name}`, 'success');
    await loadMedia();
  } catch (error) {
    console.error('ImageKit upload failed:', error);
    setStatus('mediaUploadStatus', error.message || 'Upload failed. Please try again.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Upload image';
  }
}


/* ---------------- IMAGE PICKER FOR CONTENT EDITORS ---------------- */
let pickerElement = null;
let pickerTarget = null;
let pickerMultiple = false;
let pickerAssets = [];
let pickerSelected = new Set();

function ensureMediaPicker() {
  if (pickerElement) return pickerElement;
  pickerElement = document.createElement('div');
  pickerElement.className = 'hidden fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm p-3 flex items-end sm:items-center justify-center';
  pickerElement.innerHTML = `
    <section class="bg-white w-full max-w-2xl rounded-t-2xl sm:rounded-2xl p-4 max-h-[88vh] flex flex-col">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div><h3 class="font-black text-base text-gray-800">Choose from ImageKit</h3><p id="mediaPickerHint" class="text-[11px] text-gray-500">Select an image</p></div>
        <button type="button" id="mediaPickerClose" class="text-gray-500 text-2xl px-2" aria-label="Close">&times;</button>
      </div>
      <select id="mediaPickerFolder" class="w-full p-3 mb-3 rounded-lg border border-gray-200 bg-gray-50 text-sm">
        <option value="/eazylife/projects">Projects</option>
        <option value="/eazylife/products">Products</option>
        <option value="/eazylife/reviews">Reviews</option>
        <option value="/eazylife/website">Website</option>
        <option value="/eazylife/general">General</option>
      </select>
      <div id="mediaPickerGrid" class="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto min-h-0" style="flex:1"></div>
      <div class="flex gap-2 pt-3">
        <button type="button" id="mediaPickerCancel" class="flex-1 py-3 rounded-lg bg-gray-100 text-gray-700 text-sm font-bold">Cancel</button>
        <button type="button" id="mediaPickerApply" class="flex-1 py-3 rounded-lg bg-gray-900 text-white text-sm font-bold hidden">Add selected images</button>
      </div>
    </section>`;
  document.body.appendChild(pickerElement);
  const close = () => pickerElement.classList.add('hidden');
  pickerElement.querySelector('#mediaPickerClose').addEventListener('click', close);
  pickerElement.querySelector('#mediaPickerCancel').addEventListener('click', close);
  pickerElement.addEventListener('click', event => { if (event.target === pickerElement) close(); });
  pickerElement.querySelector('#mediaPickerFolder').addEventListener('change', loadPickerFolder);
  pickerElement.querySelector('#mediaPickerApply').addEventListener('click', () => applyPickerSelection());
  return pickerElement;
}

function closeMediaPicker() {
  if (pickerElement) pickerElement.classList.add('hidden');
}

function applyPickerSelection(urls) {
  const target = $(pickerTarget);
  if (!target) return closeMediaPicker();
  if (pickerMultiple) {
    const existing = target.value.split('\n').map(value => value.trim()).filter(Boolean);
    const combined = [...existing];
    (urls || [...pickerSelected]).forEach(url => { if (url && !combined.includes(url)) combined.push(url); });
    target.value = combined.join('\n');
  } else {
    target.value = (urls || [pickerSelected.values().next().value])[0] || '';
    updateTargetPreview(pickerTarget);
  }
  target.dispatchEvent(new Event('input', { bubbles: true }));
  closeMediaPicker();
}

function updateTargetPreview(targetId) {
  const input = $(targetId);
  const variantMatch = targetId.match(/^(v\d+)_image$/);
  const previewId = targetId === 'projectCover' ? 'projectCoverPreview' : variantMatch ? `${variantMatch[1]}_preview` : `${targetId}_preview`;
  const preview = $(previewId);
  if (!input || !preview) return;
  const value = input.value.trim();
  if (!value) {
    preview.classList.add('hidden');
    preview.removeAttribute('src');
    return;
  }
  preview.src = /^https?:\/\//i.test(value) || value.startsWith('../') ? value : '../' + value;
  preview.classList.remove('hidden');
}

async function loadPickerFolder() {
  const grid = $('mediaPickerGrid');
  const folder = $('mediaPickerFolder').value;
  grid.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'col-span-full text-center text-sm text-gray-500 py-8';
  loading.textContent = 'Loading images…';
  grid.appendChild(loading);
  try {
    const idToken = await getIdToken();
    const response = await fetch(`${WORKER_URL}/files?path=${encodeURIComponent(folder)}`, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Could not load images (${response.status}).`);
    pickerAssets = normalizeAssets(payload).filter(item => item.type !== 'folder' && (item.fileType === 'image' || !item.fileType) && (item.url || item.thumbnail));
    grid.replaceChildren();
    if (!pickerAssets.length) {
      const empty = document.createElement('p');
      empty.className = 'col-span-full text-center text-sm text-gray-500 py-8';
      empty.textContent = 'No images found in this folder.';
      grid.appendChild(empty);
      return;
    }
    pickerAssets.forEach((asset, index) => {
      const url = asset.url || asset.thumbnail;
      const name = asset.name || asset.filePath?.split('/').pop() || 'Image';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'text-left border rounded-xl overflow-hidden bg-white';
      card.setAttribute('aria-label', `Select ${name}`);
      const img = document.createElement('img');
      img.src = asset.thumbnail || url;
      img.alt = name;
      img.loading = 'lazy';
      img.className = 'w-full aspect-square object-cover bg-gray-50';
      const label = document.createElement('span');
      label.className = 'block p-2 text-[10px] font-bold text-gray-700 truncate';
      label.textContent = name;
      card.append(img, label);
      const refreshSelected = () => {
        const chosen = pickerSelected.has(url);
        card.classList.toggle('border-teal-500', chosen);
        card.classList.toggle('ring-2', chosen);
        card.classList.toggle('ring-teal-300', chosen);
      };
      card.addEventListener('click', () => {
        if (pickerMultiple) {
          if (pickerSelected.has(url)) pickerSelected.delete(url);
          else pickerSelected.add(url);
          refreshSelected();
          $('mediaPickerApply').textContent = `Add selected images (${pickerSelected.size})`;
          $('mediaPickerApply').disabled = pickerSelected.size === 0;
        } else {
          applyPickerSelection([url]);
        }
      });
      refreshSelected();
      grid.appendChild(card);
    });
  } catch (error) {
    grid.replaceChildren();
    const message = document.createElement('p');
    message.className = 'col-span-full text-center text-sm text-red-600 py-8';
    message.textContent = error.message || 'Could not load images.';
    grid.appendChild(message);
  }
}

function openMediaPicker(targetId, multiple = false) {
  if (!currentUser) {
    alert('Please log in as an administrator first.');
    return;
  }
  pickerTarget = targetId;
  pickerMultiple = multiple;
  pickerSelected = new Set();
  const modal = ensureMediaPicker();
  $('mediaPickerHint').textContent = multiple ? 'Tap images to select several, then add them to the gallery.' : 'Choose one image for this image field.';
  $('mediaPickerApply').classList.toggle('hidden', !multiple);
  $('mediaPickerApply').disabled = true;
  $('mediaPickerApply').textContent = 'Add selected images';
  $('mediaPickerFolder').value = targetId.startsWith('v') ? '/eazylife/products' : '/eazylife/projects';
  modal.classList.remove('hidden');
  loadPickerFolder();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-media-pick]');
  if (button) openMediaPicker(button.dataset.mediaPick, button.dataset.mediaMultiple === 'true');
});
$('projectCover')?.addEventListener('input', () => updateTargetPreview('projectCover'));
$('projectResetBtn')?.addEventListener('click', () => setTimeout(() => updateTargetPreview('projectCover'), 0));
$('projectForm')?.addEventListener('reset', () => setTimeout(() => updateTargetPreview('projectCover'), 0));

$('mediaUploadBtn')?.addEventListener('click', uploadSelectedImage);
$('mediaRefreshBtn')?.addEventListener('click', loadMedia);
$('mediaFolder')?.addEventListener('change', loadMedia);
document.querySelector('[data-tab="media"]')?.addEventListener('click', () => {
  if (currentUser) loadMedia();
});

onAuthStateChanged(auth, user => {
  currentUser = user;
  if (!user) {
    loadedOnce = false;
    setStatus('mediaLibraryStatus', 'Log in as an administrator to browse media.');
  } else if (!loadedOnce) {
    loadedOnce = true;
  }
});
