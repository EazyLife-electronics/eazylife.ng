import assert from 'node:assert/strict';
import { extractFilenames, collectUses, buildIndex, prepareUnlink, probeUrl, isPureReference } from '../admin/js/image-usage-core.mjs';

const IK = 'https://ik.imagekit.io/eazylife/eazylife/products/';
// --- extraction
assert.deepEqual(extractFilenames(IK + '258505_KiTBETDZbh.jpg?updatedAt=1794226816736'), ['258505_kitbetdzbh.jpg']);
assert.deepEqual(extractFilenames('https://ik.imagekit.io/eazylife/tr:w-640,q-80/eazylife/products/a%20b.PNG'), ['a b.png']);
assert.deepEqual(extractFilenames('assets/pictures/placeholder.svg'), []);          // local asset: not managed
assert.deepEqual(extractFilenames('https://eazylife.ng/assets/pictures/og-image.png'), []);
assert.deepEqual(extractFilenames('hello world'), []);
assert.equal(isPureReference(IK + 'a.jpg'), true);
assert.equal(isPureReference('see ' + IK + 'a.jpg here'), false);

// --- index across product/project/hero shaped docs
const docs = [
  { collection: 'products', id: 'p1', data: { name: 'TB6612FNG Motor Driver', variants: [{ id: 'v1', image: IK + 'tb.jpg?updatedAt=1' }, { id: 'v2', image: IK + 'other.jpg' }] } },
  { collection: 'projects', id: 'pr1', data: { title: 'Line Follower', coverImage: IK + 'tb.jpg', images: [IK + 'x.jpg', IK + 'tb.jpg', IK + 'y.jpg'] } },
  { collection: 'heroes', id: 'h1', data: { headline: 'Welcome', image: IK + 'tb.jpg' } },
  { collection: 'reviews', id: 'r1', data: { name: 'Ada', text: 'Great! photo: ' + IK + 'tb.jpg', stars: 5 } },
];
const idx = buildIndex(docs);
assert.equal(idx.get('tb.jpg').length, 5);
assert.equal(idx.get('tb.jpg').filter(u => !u.pure).length, 1);                      // the review text embed
assert.ok(idx.get('tb.jpg').some(u => u.path === 'variants[0].image' && u.label === 'TB6612FNG Motor Driver'));
assert.equal(idx.get('other.jpg').length, 1);
assert.equal(idx.has('nothing.jpg'), false);

// --- unlink: product variant image cleared, other variant untouched
let r = prepareUnlink(docs[0].data, ['tb.jpg']);
assert.deepEqual(Object.keys(r.updates), ['variants']);
assert.equal(r.updates.variants[0].image, '');
assert.equal(r.updates.variants[0].id, 'v1');
assert.equal(r.updates.variants[1].image, IK + 'other.jpg');
assert.equal(docs[0].data.variants[0].image, IK + 'tb.jpg?updatedAt=1');             // input not mutated
assert.deepEqual(r.manual, []);

// --- unlink: project cover cleared, gallery entry removed, others kept in order
r = prepareUnlink(docs[1].data, ['tb.jpg']);
assert.equal(r.updates.coverImage, '');
assert.deepEqual(r.updates.images, [IK + 'x.jpg', IK + 'y.jpg']);
assert.equal('title' in r.updates, false);

// --- unlink: hero
r = prepareUnlink(docs[2].data, ['tb.jpg']);
assert.deepEqual(r.updates, { image: '' });

// --- embedded-in-text is never modified, but reported
r = prepareUnlink(docs[3].data, ['tb.jpg']);
assert.deepEqual(r.updates, {});
assert.equal(r.manual.length, 1);

// --- unrelated doc: nothing to do
r = prepareUnlink({ name: 'x', variants: [{ image: IK + 'other.jpg' }] }, ['tb.jpg']);
assert.deepEqual(r.updates, {});

// --- non-plain values (e.g. Firestore Timestamps) are left alone
class Ts { constructor() { this.seconds = 1; } }
const ts = new Ts();
r = prepareUnlink({ createdAt: ts, image: IK + 'tb.jpg' }, ['tb.jpg']);
assert.deepEqual(r.updates, { image: '' });
assert.equal(collectUses({ createdAt: ts }).length, 0);

// --- probe URL
assert.match(probeUrl(IK + 'a.jpg?updatedAt=1'), /tr=w-32%2Cq-30/);
assert.equal(probeUrl('https://ik.imagekit.io/eazylife/tr:w-640/a.jpg'), 'https://ik.imagekit.io/eazylife/tr:w-640/a.jpg');
assert.equal(probeUrl('eazylife/products/a.jpg'), null);

console.log('image-usage-core: all tests passed');
