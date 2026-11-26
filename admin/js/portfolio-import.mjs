import { initFirebase } from '../../js/firebase.mjs';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, getDocs, doc, writeBatch } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { portfolioProjects } from '../data/portfolio-projects.mjs';
import { verifyAdminAccess, redirectToAdminLogin } from './admin-auth.mjs';

const { auth, db } = initFirebase();
const $ = id => document.getElementById(id);
let existingTitles = new Set();
let selected = new Set();
let readyProjects = [];

$('login').addEventListener('click', async () => {
  $('loginError').textContent = '';
  try { await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value); }
  catch (error) { $('loginError').textContent = 'Sign-in failed. Check the email and password.'; }
});
$('logout').addEventListener('click', () => signOut(auth));
$('refresh').addEventListener('click', loadExisting);
$('selectReady').addEventListener('click', () => { selected = new Set(readyProjects.map(p => p.title)); render(); });
$('clearSelection').addEventListener('click', () => { selected.clear(); render(); });
$('import').addEventListener('click', importSelected);

onAuthStateChanged(auth, async user => {
  if (!user || !await verifyAdminAccess(user, db)) {
    $('loginPanel').classList.remove('hidden');
    $('app').classList.add('hidden');
    redirectToAdminLogin(auth, signOut, user, { loginPath: 'index.html' });
    return;
  }
  $('loginPanel').classList.add('hidden');
  $('app').classList.remove('hidden');
  loadExisting();
});

function key(value) { return String(value || '').trim().toLocaleLowerCase(); }

async function loadExisting() {
  $('status').textContent = 'Checking existing projects…';
  $('refresh').disabled = true;
  try {
    const snap = await getDocs(collection(db, 'projects'));
    existingTitles = new Set(snap.docs.map(d => key(d.data().title)));
    readyProjects = portfolioProjects.filter(p => !existingTitles.has(key(p.title)));
    selected = new Set([...selected].filter(title => readyProjects.some(p => p.title === title)));
    $('total').textContent = String(portfolioProjects.length);
    $('newCount').textContent = String(readyProjects.length);
    $('duplicateCount').textContent = String(portfolioProjects.length - readyProjects.length);
    $('status').textContent = readyProjects.length
      ? 'Duplicate check complete. Review the entries before importing.'
      : 'All portfolio titles already exist in the Projects collection. Nothing new to import.';
    render();
  } catch (error) {
    $('status').textContent = 'Could not read the Projects collection: ' + error.message;
  } finally { $('refresh').disabled = false; }
}

function render() {
  const readySet = new Set(readyProjects.map(p => p.title));
  $('projects').innerHTML = portfolioProjects.map((p, index) => {
    const duplicate = !readySet.has(p.title);
    const checked = selected.has(p.title);
    const materials = p.materials.length ? p.materials.join(', ') : 'Not specified in source portfolio';
    return `<article class="project-row">
      <div class="flex gap-3 items-start">
        <input type="checkbox" data-title="${escapeAttr(p.title)}" ${checked ? 'checked' : ''} ${duplicate ? 'disabled' : ''} class="mt-1">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap gap-2 items-center"><span class="text-xs text-gray-400 font-bold">${String(index + 1).padStart(2,'0')}</span><h3 class="font-bold">${escapeHtml(p.title)}</h3><span class="text-[10px] rounded-full px-2 py-1 ${duplicate ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}">${duplicate ? 'Already exists · skipped' : 'Ready as draft'}</span></div>
          <p class="text-xs text-teal-700 font-bold mt-1">${escapeHtml(p.category)}</p>
          <p class="text-sm mt-2">${escapeHtml(p.summary)}</p>
          <details class="mt-2 text-sm"><summary class="cursor-pointer text-xs font-bold text-gray-600">Preview full description and fields</summary>
            <p class="mt-2 whitespace-pre-line">${escapeHtml(p.description)}</p>
            <p class="mt-2 text-xs"><strong>Materials:</strong> ${escapeHtml(materials)}</p>
            <p class="mt-2 text-xs"><strong>Outcome:</strong> ${escapeHtml(p.outcome)}</p>
            <p class="mt-2 text-xs text-gray-500"><strong>Process:</strong> left blank for verified build notes and photographs.</p>
          </details>
        </div>
      </div>
    </article>`;
  }).join('');
  $('projects').querySelectorAll('input[type="checkbox"][data-title]').forEach(input => input.addEventListener('change', () => {
    const title = input.dataset.title;
    if (input.checked) selected.add(title); else selected.delete(title);
    updateCounts();
  }));
  updateCounts();
}
function updateCounts() {
  $('selectedCount').textContent = String(selected.size);
  $('import').disabled = selected.size === 0;
  $('import').textContent = selected.size ? `Import ${selected.size} selected as drafts` : 'Import selected as drafts';
}
async function importSelected() {
  const chosen = portfolioProjects.filter(p => selected.has(p.title) && !existingTitles.has(key(p.title)));
  if (!chosen.length) return;
  if (!confirm(`Import ${chosen.length} projects into the existing Firestore projects collection as unpublished drafts? Existing records will not be changed.`)) return;
  $('import').disabled = true;
  $('status').textContent = 'Importing drafts…';
  try {
    const batch = writeBatch(db);
    const refs = chosen.map(() => doc(collection(db, 'projects')));
    chosen.forEach((p, i) => {
      batch.set(refs[i], {
        title: p.title,
        category: p.category,
        summary: p.summary,
        description: p.description,
        materials: p.materials,
        process: p.process,
        outcome: p.outcome,
        coverImage: '',
        images: [],
        videoUrl: '',
        kitComponents: [],
        status: 'draft',
        publishAt: new Date('2999-01-01T00:00:00.000Z'),
        createdAt: new Date(),
        updatedAt: new Date(),
        portfolioSource: 'eazylife-portfolio-pdf-2026'
      });
    });
    await batch.commit();
    selected.clear();
    $('status').textContent = `Successfully imported ${chosen.length} project drafts. Open the normal admin Projects tab to add images, review details and publish when ready.`;
    await loadExisting();
  } catch (error) {
    $('status').textContent = 'Import failed. No success was reported: ' + error.message;
  } finally { updateCounts(); }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(value) { return escapeHtml(value); }
