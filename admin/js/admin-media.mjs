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

const MEDIA_FOLDERS = [
  { value: "/eazylife/products", label: "Products" },
  { value: "/eazylife/projects", label: "Projects" },
  { value: "/eazylife/reviews", label: "Reviews" },
  { value: "/eazylife/website", label: "Website" },
  { value: "/eazylife/general", label: "General" }
];
let mediaAssets = [];
let selectedMediaIds = new Set();
let mediaToolbarReady = false;

function mediaSize(bytes) {
  const n = Number(bytes) || 0;
  return n ? (n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB") : "";
}

function ensureMediaManagementUI() {
  if (mediaToolbarReady || !$("mediaGrid")) return;
  mediaToolbarReady = true;
  const toolbar = document.createElement("div");
  toolbar.id = "mediaManagementToolbar";
  toolbar.className = "space-y-3 mb-4";
  const folderOptions = MEDIA_FOLDERS.map(x => '<option value="' + x.value + '">' + x.label + '</option>').join("");
  toolbar.innerHTML =
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2">' +
      '<input id="mediaSearchInput" type="search" placeholder="Search filenames..." class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm">' +
      '<select id="mediaBrowseFolder" class="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm"><option value="all">All media folders</option>' + folderOptions + '</select>' +
    '</div>' +
    '<div class="flex flex-wrap items-center gap-2">' +
      '<select id="mediaSortSelect" class="flex-1 min-w-[145px] p-2.5 rounded-lg border border-gray-200 bg-white text-xs">' +
        '<option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option><option value="size-desc">Largest first</option><option value="size-asc">Smallest first</option>' +
      '</select><button id="mediaSelectAllBtn" type="button" class="px-3 py-2.5 rounded-lg border border-gray-200 text-xs font-bold">Select all</button><span id="mediaSelectionCount" class="text-xs text-gray-500">0 selected</span>' +
    '</div>' +
    '<div class="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">' +
      '<p class="text-[11px] font-bold text-gray-600">Actions for selected images</p>' +
      '<div class="grid grid-cols-1 sm:grid-cols-3 gap-2"><select id="mediaDestinationFolder" class="w-full min-w-0 p-2.5 rounded-lg border border-gray-200 bg-white text-xs">' + folderOptions + '</select>' +
      '<button id="mediaCopySelectedBtn" type="button" class="rounded-lg bg-teal-50 text-teal-800 py-2.5 text-xs font-bold">Copy to folder</button>' +
      '<button id="mediaMoveSelectedBtn" type="button" class="rounded-lg bg-amber-50 text-amber-800 py-2.5 text-xs font-bold">Move to folder</button></div>' +
      '<button id="mediaDeleteSelectedBtn" type="button" class="w-full rounded-lg bg-red-50 text-red-700 py-2.5 text-xs font-bold">Delete selected images</button>' +
      '<p class="text-[10px] text-gray-500">Copy is safest for images already used on the website. Moving or renaming changes image URLs. Deleting is permanent.</p>' +
    '</div>';
  $("mediaGrid").parentElement.insertBefore(toolbar, $("mediaGrid"));
  $("mediaSearchInput").addEventListener("input", renderMediaGrid);
  $("mediaBrowseFolder").addEventListener("change", loadMedia);
  $("mediaSortSelect").addEventListener("change", renderMediaGrid);
  $("mediaSelectAllBtn").addEventListener("click", () => {
    const visible = getVisibleMedia();
    const all = visible.length && visible.every(x => selectedMediaIds.has(x.fileId));
    visible.forEach(x => all ? selectedMediaIds.delete(x.fileId) : selectedMediaIds.add(x.fileId));
    renderMediaGrid();
  });
  $("mediaCopySelectedBtn").addEventListener("click", () => runBulkMediaAction("copy"));
  $("mediaMoveSelectedBtn").addEventListener("click", () => runBulkMediaAction("move"));
  $("mediaDeleteSelectedBtn").addEventListener("click", () => runBulkMediaAction("delete"));
}

function getVisibleMedia() {
  const query = ($("mediaSearchInput")?.value || "").trim().toLowerCase();
  const folder = $("mediaBrowseFolder")?.value || "all";
  const list = mediaAssets.filter(x => {
    const name = x.name || x.filePath?.split("/").pop() || "";
    return (!query || name.toLowerCase().includes(query)) && (folder === "all" || x.filePath?.startsWith(folder + "/"));
  });
  const sort = $("mediaSortSelect")?.value || "newest";
  list.sort((a, b) => {
    if (sort === "name-asc") return (a.name || "").localeCompare(b.name || "");
    if (sort === "name-desc") return (b.name || "").localeCompare(a.name || "");
    if (sort === "size-desc") return (Number(b.size) || 0) - (Number(a.size) || 0);
    if (sort === "size-asc") return (Number(a.size) || 0) - (Number(b.size) || 0);
    const da = new Date(a.createdAt || 0).getTime() || 0;
    const db = new Date(b.createdAt || 0).getTime() || 0;
    return sort === "oldest" ? da - db : db - da;
  });
  return list;
}

function createMediaCard(asset) {
  const url = asset.url || asset.thumbnail || "";
  const name = asset.name || asset.filePath?.split("/").pop() || "Image";
  if (!url || asset.type === "folder") return null;
  const card = document.createElement("article");
  card.className = "border border-gray-100 rounded-xl overflow-hidden bg-white";
  const image = document.createElement("img");
  image.src = asset.thumbnail || url;
  image.alt = name;
  image.loading = "lazy";
  image.className = "w-full aspect-square object-cover bg-gray-50";
  image.title = "Open full image";
  image.style.cursor = "zoom-in";
  image.addEventListener("click", () => window.open(url, "_blank", "noopener"));
  card.appendChild(image);
  const body = document.createElement("div");
  body.className = "p-2 space-y-2";
  const label = document.createElement("label");
  label.className = "flex items-center gap-2 text-[10px] font-bold text-gray-600";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = selectedMediaIds.has(asset.fileId);
  check.disabled = !asset.fileId;
  check.addEventListener("change", () => {
    if (check.checked) selectedMediaIds.add(asset.fileId);
    else selectedMediaIds.delete(asset.fileId);
    updateMediaSelectionCount();
  });
  label.append(check, document.createTextNode("Select"));
  body.appendChild(label);
  const title = document.createElement("p");
  title.className = "text-[11px] font-bold text-gray-700 break-words";
  title.textContent = name;
  body.appendChild(title);
  const folder = MEDIA_FOLDERS.find(x => asset.filePath?.startsWith(x.value + "/"));
  const meta = document.createElement("p");
  meta.className = "text-[10px] text-gray-400";
  meta.textContent = [folder?.label || asset.filePath || "", mediaSize(asset.size)].filter(Boolean).join(" · ");
  body.appendChild(meta);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy URL";
  copy.className = "w-full border border-gray-200 rounded-lg py-2 text-[10px] font-bold text-gray-600";
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(url); copy.textContent = "Copied!"; }
    catch { copy.textContent = "Copy unavailable"; }
  });
  body.appendChild(copy);
  const actions = document.createElement("div");
  actions.className = "grid grid-cols-2 gap-2";
  const rename = document.createElement("button");
  rename.type = "button";
  rename.textContent = "Rename";
  rename.className = "rounded-lg bg-gray-100 py-2 text-[10px] font-bold text-gray-700";
  rename.disabled = !asset.filePath;
  rename.addEventListener("click", () => renameMediaAsset(asset));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Delete";
  remove.className = "rounded-lg bg-red-50 py-2 text-[10px] font-bold text-red-700";
  remove.disabled = !asset.fileId;
  remove.addEventListener("click", () => deleteMediaAsset(asset));
  actions.append(rename, remove);
  body.appendChild(actions);
  card.appendChild(body);
  return card;
}

function updateMediaSelectionCount() {
  if ($("mediaSelectionCount")) $("mediaSelectionCount").textContent = selectedMediaIds.size + " selected";
}

function renderMediaGrid() {
  const grid = $("mediaGrid");
  if (!grid) return;
  const visible = getVisibleMedia();
  const cards = visible.map(createMediaCard).filter(Boolean);
  grid.replaceChildren(...cards);
  if (!cards.length) {
    const empty = document.createElement("p");
    empty.className = "col-span-full text-center text-sm text-gray-500 py-8";
    empty.textContent = mediaAssets.length ? "No images match your search or folder filter." : "No images found in the selected folders.";
    grid.appendChild(empty);
  }
  if ($("mediaSelectAllBtn")) $("mediaSelectAllBtn").textContent = visible.length && visible.every(x => selectedMediaIds.has(x.fileId)) ? "Clear selection" : "Select all";
  updateMediaSelectionCount();
  const folder = $("mediaBrowseFolder")?.value || "all";
  const label = folder === "all" ? "All media folders" : (MEDIA_FOLDERS.find(x => x.value === folder)?.label || folder);
  $("mediaFolderLabel").textContent = label + " · " + cards.length + " shown";
}

async function requestMediaAction(action, payload) {
  const token = await getIdToken();
  const response = await fetch(WORKER_URL + "/manage", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.error || "Media " + action + " failed (" + response.status + ").");
  return result;
}

async function renameMediaAsset(asset) {
  const oldName = asset.name || asset.filePath.split("/").pop();
  const newName = prompt("Enter the new filename, including its extension:", oldName);
  if (newName === null || !newName.trim() || newName.trim() === oldName) return;
  if (!confirm("Renaming changes this image URL. Website content using the old URL may stop displaying. Continue?")) return;
  try {
    setStatus("mediaLibraryStatus", "Renaming " + oldName + "…");
    await requestMediaAction("rename", { filePath: asset.filePath, newFileName: newName.trim() });
    selectedMediaIds.delete(asset.fileId);
    setStatus("mediaLibraryStatus", "Image renamed successfully.", "success");
    await loadMedia();
  } catch (error) {
    setStatus("mediaLibraryStatus", error.message || "Could not rename image.", "error");
  }
}

async function deleteMediaAsset(asset) {
  if (!confirm('Permanently delete "' + (asset.name || "this image") + '"? Website content using it will lose the image. This cannot be undone.')) return;
  try {
    setStatus("mediaLibraryStatus", "Deleting image…");
    await requestMediaAction("delete", { fileId: asset.fileId });
    selectedMediaIds.delete(asset.fileId);
    setStatus("mediaLibraryStatus", "Image deleted.", "success");
    await loadMedia();
  } catch (error) {
    setStatus("mediaLibraryStatus", error.message || "Could not delete image.", "error");
  }
}

async function runBulkMediaAction(action) {
  const selected = mediaAssets.filter(x => selectedMediaIds.has(x.fileId));
  if (!selected.length) {
    setStatus("mediaLibraryStatus", "Select at least one image first.", "error");
    return;
  }
  const destinationPath = $("mediaDestinationFolder").value;
  if (action === "delete") {
    if (!confirm("Permanently delete " + selected.length + " selected image(s)? Website content using them will lose those images. This cannot be undone.")) return;
  } else {
    if (selected.some(x => !x.filePath)) {
      setStatus("mediaLibraryStatus", "Some selected images are missing file paths. Refresh and try again.", "error");
      return;
    }
    if (action === "move" && selected.some(x => x.filePath.startsWith(destinationPath + "/"))) {
      setStatus("mediaLibraryStatus", "The destination is the same as a selected image's current folder. Choose another folder.", "error");
      return;
    }
    const warning = action === "move"
      ? "Moving changes image URLs and can break website content that uses them. Continue?"
      : "Copy " + selected.length + " image(s) to " + (MEDIA_FOLDERS.find(x => x.value === destinationPath)?.label || destinationPath) + "? Originals remain unchanged.";
    if (!confirm(warning)) return;
  }
  let done = 0;
  try {
    for (const asset of selected) {
      setStatus("mediaLibraryStatus", (action === "delete" ? "Deleting " : action === "move" ? "Moving " : "Copying ") + (done + 1) + " of " + selected.length + "…");
      if (action === "delete") await requestMediaAction("delete", { fileId: asset.fileId });
      else await requestMediaAction(action, { sourceFilePath: asset.filePath, destinationPath });
      done++;
    }
    selectedMediaIds.clear();
    setStatus("mediaLibraryStatus", done + " image(s) " + (action === "delete" ? "deleted" : action === "move" ? "moved" : "copied") + " successfully.", "success");
    await loadMedia();
  } catch (error) {
    setStatus("mediaLibraryStatus", done + " of " + selected.length + " completed. " + error.message, "error");
    await loadMedia();
  }
}

async function loadMedia() {
  if (!currentUser) {
    setStatus("mediaLibraryStatus", "Log in as an administrator to browse media.", "error");
    return;
  }
  ensureMediaManagementUI();
  $("mediaGrid").replaceChildren();
  setStatus("mediaLibraryStatus", "Loading media library…");
  try {
    const token = await getIdToken();
    const selectedFolder = $("mediaBrowseFolder")?.value || "all";
    const folders = selectedFolder === "all" ? MEDIA_FOLDERS : MEDIA_FOLDERS.filter(x => x.value === selectedFolder);
    const results = await Promise.all(folders.map(async folder => {
      const found = [];
      let skip = 0;
      while (true) {
        const response = await fetch(WORKER_URL + "/files?path=" + encodeURIComponent(folder.value) + "&limit=100&skip=" + skip, {
          headers: { Authorization: "Bearer " + token }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Could not load " + folder.label + " (" + response.status + ").");
        const batch = normalizeAssets(payload).filter(x => x.type !== "folder" && (x.fileType === "image" || !x.fileType));
        found.push(...batch);
        if (batch.length < 100) break;
        skip += batch.length;
      }
      return found;
    }));
    mediaAssets = results.flat();
    const valid = new Set(mediaAssets.map(x => x.fileId).filter(Boolean));
    selectedMediaIds = new Set([...selectedMediaIds].filter(id => valid.has(id)));
    renderMediaGrid();
    setStatus("mediaLibraryStatus", mediaAssets.length + " image(s) loaded from " + (folders.length === 1 ? folders[0].label : "all media folders") + ".", "success");
  } catch (error) {
    console.error("Media library loading failed:", error);
    setStatus("mediaLibraryStatus", error.message || "Could not load the media library.", "error");
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
    if ($('mediaBrowseFolder')) $('mediaBrowseFolder').value = 'all';
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
  const previewId = targetId === 'projectCover' ? 'projectCoverPreview' : targetId === 'hImage' ? 'hImagePreview' : variantMatch ? `${variantMatch[1]}_preview` : `${targetId}_preview`;
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

function openMediaPicker(targetId, multiple = false, folderOverride = '') {
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
  $('mediaPickerFolder').value = folderOverride || (targetId.startsWith('v') ? '/eazylife/products' : targetId.startsWith('rv') ? '/eazylife/reviews' : '/eazylife/projects');
  modal.classList.remove('hidden');
  loadPickerFolder();
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-media-pick]');
  if (button) openMediaPicker(button.dataset.mediaPick, button.dataset.mediaMultiple === 'true', button.dataset.mediaFolder || '');
});
$('projectCover')?.addEventListener('input', () => updateTargetPreview('projectCover'));
$('projectResetBtn')?.addEventListener('click', () => setTimeout(() => updateTargetPreview('projectCover'), 0));
$('projectForm')?.addEventListener('reset', () => setTimeout(() => updateTargetPreview('projectCover'), 0));
$('rvCoverImage')?.addEventListener('input', () => updateTargetPreview('rvCoverImage'));
$('hImage')?.addEventListener('input', () => updateTargetPreview('hImage'));
$('heroForm')?.addEventListener('reset', () => setTimeout(() => updateTargetPreview('hImage'), 0));
$('reviewAddForm')?.addEventListener('reset', () => setTimeout(() => updateTargetPreview('rvCoverImage'), 0));

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
