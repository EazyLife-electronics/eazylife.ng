import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildIndex, prepareUnlink } from '/home/claude/verify/admin/js/image-usage-core.mjs';

const IK = 'https://ik.imagekit.io/eazylife/eazylife/products/';
// Firestore-like content: tb.jpg is used by a product + a project; free.jpg is unused
const content = [
  { collection: 'products', id: 'p1', data: { name: 'TB6612FNG Motor Driver', variants: [{ id: 'v1', image: IK + 'tb.jpg?updatedAt=1' }] } },
  { collection: 'projects', id: 'pr1', data: { title: 'Line Follower', coverImage: IK + 'tb.jpg', images: [IK + 'tb.jpg', IK + 'keep.jpg'] } },
  { collection: 'products', id: 'p2', data: { name: 'Kept', variants: [{ id: 'v1', image: IK + 'keep.jpg' }] } },
  { collection: 'reviews', id: 'r1', data: { name: 'Ada', text: 'photo ' + IK + 'embedded.jpg' } },
];
let failedCollections = [];
const calls = { unlink: [], deleted: [], alerts: [] };

const dom = new JSDOM(`<body><button data-tab="media" id="tabBtn">Media</button><div><div id="mediaGrid"></div></div><p id="mediaFolderLabel"></p><p id="mediaLibraryStatus"></p></body>`, { url: 'https://eazylife.ng/admin/index.html' });
const w = dom.window;
Object.assign(globalThis, { window: w, document: w.document, Image: w.Image, location: w.location });
globalThis.alert = m => calls.alerts.push(m);
let confirmAnswers = [], promptAnswers = [], confirmLog = [];
globalThis.confirm = m => { confirmLog.push(m); return confirmAnswers.length ? confirmAnswers.shift() : true; };
globalThis.prompt = () => promptAnswers.shift() ?? null;

const assets = ['tb.jpg', 'keep.jpg', 'free.jpg', 'embedded.jpg'].map((n, i) => ({ fileId: 'id' + i, name: n, filePath: '/eazylife/products/' + n, url: IK + n, type: 'file', fileType: 'image', size: 1000, createdAt: '2026-11-01' }));
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('/files?')) return { ok: true, json: async () => (u.includes('products') ? { files: assets.filter(a => !calls.deleted.includes(a.fileId)) } : { files: [] }) };
  if (u.includes('/manage')) { const b = JSON.parse(opts.body); if (b.action === 'delete') calls.deleted.push(b.fileId); return { ok: true, json: async () => ({ success: true }) }; }
  throw new Error('unexpected fetch ' + u);
};

// stub the three imports, keep the real index/unlink logic
let authCb;
globalThis.__stubs = {
  initFirebase: () => ({ auth: {} }),
  onAuthStateChanged: (a, cb) => { authCb = cb; },
  loadUsage: async () => ({ at: Date.now(), index: buildIndex(content), failed: failedCollections }),
  unlinkImageFromContent: async (uses, names) => {
    const targets = new Set(names);
    const keys = [...new Set(uses.map(u => u.collection + '/' + u.id))];
    for (const k of keys) {
      const d = content.find(c => c.collection + '/' + c.id === k);
      const { updates, manual } = prepareUnlink(d.data, targets);
      if (manual.length) throw new Error('embedded text in ' + k);
      Object.assign(d.data, updates);
    }
    calls.unlink.push([...names]);
  },
  findBrokenReferences: async () => ({ broken: [], checked: 0 }),
};
let src = fs.readFileSync('/home/claude/verify/admin/js/admin-media.mjs', 'utf8');
src = src.replace(/^import \{ initFirebase \}.*$/m, 'const { initFirebase } = globalThis.__stubs;')
  .replace(/^import \{ onAuthStateChanged \}.*$/m, 'const { onAuthStateChanged } = globalThis.__stubs;')
  .replace(/^import \{ loadUsage.*$/m, 'const { loadUsage, unlinkImageFromContent, findBrokenReferences } = globalThis.__stubs;');
assert.ok(!/^import /m.test(src), 'all imports stubbed');
fs.writeFileSync('/tmp/admin-media.testable.mjs', src);
await import('/tmp/admin-media.testable.mjs');

const tick = () => new Promise(r => setTimeout(r, 30));
const status = () => document.getElementById('mediaLibraryStatus').textContent;
const cards = () => [...document.querySelectorAll('#mediaGrid article')];
const card = name => cards().find(c => c.querySelector('p.font-bold')?.textContent === name || c.textContent.includes(name));
const click = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const btn = (c, t) => [...c.querySelectorAll('button')].find(b => b.textContent === t);

authCb({ getIdToken: async () => 'tok' }); click(document.getElementById('tabBtn'));
await tick();
// badges
assert.equal(cards().length, 4);
assert.match(card('tb.jpg').textContent, /Used in 3 places/);
assert.match(card('tb.jpg').textContent, /TB6612FNG Motor Driver \(variants\[0\]\.image\)/);
assert.match(card('keep.jpg').textContent, /Used in 2 places/);
assert.match(card('free.jpg').textContent, /Unused/);
assert.match(status(), /1 unused/);
console.log('✓ badges + where-used list');

// filter
document.getElementById('mediaUsageFilter').value = 'unused';
document.getElementById('mediaUsageFilter').dispatchEvent(new w.Event('change'));
assert.deepEqual(cards().map(c => c.querySelector('p.font-bold').textContent), ['free.jpg']);
document.getElementById('mediaUsageFilter').value = 'all';
document.getElementById('mediaUsageFilter').dispatchEvent(new w.Event('change'));
console.log('✓ unused filter');

// single delete of UNUSED image: one confirm, deletes
confirmLog = [];
click(btn(card('free.jpg'), 'Delete')); await tick();
assert.deepEqual(calls.deleted, ['id2']);
assert.match(confirmLog[0], /not used by any/);
console.log('✓ unused image deletes with one confirm');

// single delete of IN-USE image, cancel at first confirm: nothing changes
confirmAnswers = [false]; confirmLog = [];
click(btn(card('tb.jpg'), 'Delete')); await tick();
assert.equal(calls.deleted.length, 1); assert.equal(calls.unlink.length, 0);
assert.match(confirmLog[0], /used in 3 place/);
console.log('✓ in-use: cancel keeps everything');

// in-use, OK then wrong typed word: nothing changes
confirmAnswers = [true]; promptAnswers = ['nope'];
click(btn(card('tb.jpg'), 'Delete')); await tick();
assert.equal(calls.deleted.length, 1); assert.equal(calls.unlink.length, 0);
assert.match(status(), /Nothing was deleted/);
console.log('✓ in-use: wrong confirmation word keeps everything');

// in-use, full confirm: unlink then delete
confirmAnswers = [true]; promptAnswers = ['DELETE'];
click(btn(card('tb.jpg'), 'Delete')); await tick();
assert.deepEqual(calls.unlink, [['tb.jpg']]);
assert.deepEqual(calls.deleted, ['id2', 'id0']);
assert.equal(content[0].data.variants[0].image, '');                 // product cleared -> placeholder
assert.equal(content[1].data.coverImage, '');                        // project cover cleared
assert.deepEqual(content[1].data.images, [IK + 'keep.jpg']);         // gallery entry removed, other kept
assert.equal(content[2].data.variants[0].image, IK + 'keep.jpg');    // unrelated product untouched
console.log('✓ in-use: typed DELETE unlinks every place, then deletes');

// embedded-in-text image: refuses, changes nothing
const before = calls.deleted.length;
click(btn(card('embedded.jpg'), 'Delete')); await tick();
assert.equal(calls.deleted.length, before);
assert.match(calls.alerts.at(-1), /longer text/);
console.log('✓ embedded in text: refused, nothing changed');

// bulk: select keep.jpg (in use) -> nothing deletable
const sel = c => { const cb = c.querySelector('input[type=checkbox]'); cb.checked = true; cb.dispatchEvent(new w.Event('change')); };
sel(card('keep.jpg'));
click(document.getElementById('mediaDeleteSelectedBtn')); await tick();
assert.equal(calls.deleted.length, before);
assert.match(status(), /in use, so nothing was deleted/);
console.log('✓ bulk: in-use images are skipped');

// usage check incomplete -> bulk paused, single gets strong warning
failedCollections = ['reviews'];
click(document.getElementById('mediaRecheckBtn')); await tick();
click(document.getElementById('mediaDeleteSelectedBtn')); await tick();
assert.match(status(), /paused/);
console.log('✓ incomplete usage check pauses bulk delete');
console.log('\nall media-library smoke tests passed');
process.exit(0);
