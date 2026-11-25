// admin/js/image-usage-core.mjs
// Pure helpers (no Firebase, no DOM) for finding where ImageKit images are used
// inside Firestore documents, and for removing a reference safely.
// Kept separate so it can be unit-tested in Node: tests/image-usage-core.test.mjs

export const REMOVE = Symbol('remove-reference');

const IMAGE_NAME_RE = /([^\/?#\s"'()<>]+\.(?:jpe?g|png|webp|gif|avif|svg))(?=[?#"'\s)<>]|$)/gi;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;
}

// A string counts as an ImageKit/managed image reference when it points at
// ik.imagekit.io or at the /eazylife/ media folder.
export function looksLikeManagedImage(s) {
  return typeof s === 'string' && (s.includes('imagekit.io') || /(^|\/)eazylife\//i.test(s));
}

// Lower-cased file names found in a string. Transformation segments such as
// /tr:w-640/ and query strings such as ?updatedAt=123 are ignored.
export function extractFilenames(s) {
  if (!looksLikeManagedImage(s)) return [];
  const out = [];
  IMAGE_NAME_RE.lastIndex = 0;
  let m;
  while ((m = IMAGE_NAME_RE.exec(s))) {
    let name = m[1];
    try { name = decodeURIComponent(name); } catch (_) {}
    out.push(name.toLowerCase());
  }
  return out;
}

// A "pure" reference is just a URL/path (no surrounding text), so it can be
// cleared safely. Text that merely contains a URL must be edited by hand.
export function isPureReference(s) {
  return !/\s/.test(String(s).trim());
}

export function labelOf(data, id) {
  for (const k of ['name', 'title', 'headline', 'label', 'productName', 'customerName', 'clientName']) {
    if (typeof data?.[k] === 'string' && data[k].trim()) return data[k].trim();
  }
  return id;
}

// All image references inside one document's data.
export function collectUses(data) {
  const uses = [];
  (function walk(v, path) {
    if (typeof v === 'string') {
      const names = extractFilenames(v);
      if (names.length) uses.push({ path, names, url: v, pure: isPureReference(v) });
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, path + '[' + i + ']'));
    } else if (isPlainObject(v)) {
      for (const [k, x] of Object.entries(v)) walk(x, path ? path + '.' + k : k);
    }
  })(data, '');
  return uses;
}

// docs: [{ collection, id, data }] -> Map(fileName -> [{collection,id,label,path,url,pure,name}])
export function buildIndex(docs) {
  const index = new Map();
  for (const d of docs) {
    const label = labelOf(d.data, d.id);
    for (const u of collectUses(d.data)) {
      for (const name of u.names) {
        if (!index.has(name)) index.set(name, []);
        index.get(name).push({ collection: d.collection, id: d.id, label, path: u.path, url: u.url, pure: u.pure, name });
      }
    }
  }
  return index;
}

function strip(value, targets) {
  if (typeof value === 'string') {
    const hit = extractFilenames(value).some(n => targets.has(n));
    if (!hit) return { value, changed: false, manual: [] };
    if (isPureReference(value)) return { value: REMOVE, changed: true, manual: [] };
    return { value, changed: false, manual: [value.slice(0, 60)] }; // embedded in text
  }
  if (Array.isArray(value)) {
    const out = [];
    let changed = false;
    const manual = [];
    for (const item of value) {
      const r = strip(item, targets);
      manual.push(...r.manual);
      if (r.value === REMOVE) { changed = true; continue; }
      if (r.changed) changed = true;
      out.push(r.value);
    }
    return { value: changed ? out : value, changed, manual };
  }
  if (isPlainObject(value)) {
    const out = {};
    let changed = false;
    const manual = [];
    for (const [k, v] of Object.entries(value)) {
      const r = strip(v, targets);
      manual.push(...r.manual);
      if (r.value === REMOVE) { out[k] = ''; changed = true; continue; }
      if (r.changed) changed = true;
      out[k] = r.value;
    }
    return { value: changed ? out : value, changed, manual };
  }
  return { value, changed: false, manual: [] };
}

// Returns { updates, manual }. `updates` holds only the top-level fields that
// changed (a matching image field becomes '', a matching array entry is removed).
// `manual` lists references embedded inside longer text, which are never touched.
export function prepareUnlink(data, targetNames) {
  const targets = targetNames instanceof Set ? targetNames : new Set(targetNames);
  const updates = {};
  const manual = [];
  for (const [k, v] of Object.entries(data || {})) {
    const r = strip(v, targets);
    manual.push(...r.manual);
    if (r.value === REMOVE) updates[k] = '';
    else if (r.changed) updates[k] = r.value;
  }
  return { updates, manual };
}

// ImageKit URL used only to test whether a file still exists: ask for a tiny
// version so a check of many images does not download full-size originals.
export function probeUrl(url) {
  let u;
  try { u = new URL(url); } catch (_) { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (!u.pathname.includes('/tr:') && !u.searchParams.has('tr')) u.searchParams.set('tr', 'w-32,q-30');
  return u.toString();
}
