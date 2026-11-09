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
