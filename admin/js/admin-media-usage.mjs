// admin/js/admin-media-usage.mjs
// Firestore side of the "where is this image used?" guard for the admin Media
// Library. Read-only scans plus an explicit unlink action; nothing is written
// unless the administrator confirms it in the Media Library.
import { initFirebase } from '../../js/firebase.mjs';
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { buildIndex, prepareUnlink, probeUrl } from './image-usage-core.mjs';

const { db } = initFirebase();

// Collections that can hold image links. Orders are deliberately not scanned:
// they are history, and reading them all would cost many reads.
export const SCANNED_COLLECTIONS = ['products', 'projects', 'heroes', 'reviews', 'circuitComponents', 'quotationCatalogue', 'quotations', 'settings'];
const CACHE_MS = 2 * 60 * 1000;
let cache = null; // { at, index, failed }

// Returns { index: Map(fileName -> uses[]), failed: [collection names that could not be read], at }
export async function loadUsage({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const failed = [];
  const docs = [];
  await Promise.all(SCANNED_COLLECTIONS.map(async name => {
    try {
      const snap = await getDocs(collection(db, name));
      snap.forEach(d => docs.push({ collection: name, id: d.id, data: d.data() }));
    } catch (error) {
      console.warn('Image usage scan could not read', name, error);
      failed.push(name);
    }
  }));
  cache = { at: Date.now(), index: buildIndex(docs), failed };
  return cache;
}

// Removes every reference to `names` from the documents named in `uses`.
// All documents are read and checked first; if anything is embedded inside
// longer text (cannot be cleared automatically) nothing is written at all.
export async function unlinkImageFromContent(uses, names) {
  const targets = new Set(names.map(n => String(n).toLowerCase()));
  const keys = [...new Set(uses.map(u => u.collection + '/' + u.id))];
  const plan = [];
  for (const key of keys) {
    const [col, id] = key.split('/');
    const ref = doc(db, col, id);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    const { updates, manual } = prepareUnlink(snap.data(), targets);
    if (manual.length) throw new Error('"' + key + '" has the image inside longer text. Edit that text by hand first.');
    if (Object.keys(updates).length) plan.push({ ref, updates });
  }
  for (const step of plan) await updateDoc(step.ref, step.updates);
  cache = null;
  return plan.length;
}

function probe(url, timeoutMs = 15000) {
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => { img.onload = img.onerror = null; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

// Checks every distinct image link found in Firestore and returns the uses whose
// image fails to load. Links that are not absolute URLs are skipped.
export async function findBrokenReferences(index, onProgress) {
  const byUrl = new Map();
  for (const uses of index.values()) for (const u of uses) {
    if (!byUrl.has(u.url)) byUrl.set(u.url, []);
    byUrl.get(u.url).push(u);
  }
  const urls = [...byUrl.keys()].filter(u => probeUrl(u));
  const broken = [];
  let done = 0;
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++];
      const ok = await probe(probeUrl(url));
      if (!ok) broken.push(...byUrl.get(url));
      onProgress?.(++done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
  return { broken, checked: urls.length };
}
