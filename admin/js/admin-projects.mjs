// Admin project gallery manager.
import { addProject, updateProject, deleteProject } from '../../js/store.mjs';
import { escapeHtml } from './admin-shared.mjs';

let projects = [];
let kitProducts = [];
let kitRowCounter = 0;

function kitVariantLabel(v, index) {
  const parts = [v?.processor, v?.ram, v?.rom, v?.color].filter(Boolean);
  return parts.length ? parts.join(' / ') : `Variant ${index + 1}`;
}
function addKitRow(data = {}) {
  const host = $('projectKitRows');
  if (!host) return;
  const id = ++kitRowCounter;
  const productOptions = ['<option value="">Not linked to store / manual item</option>', ...kitProducts.map(p => `<option value="${escapeHtml(p.id)}" ${p.id === data.productId ? 'selected' : ''}>${escapeHtml(p.name || 'Unnamed product')}</option>`)].join('');
  const row = document.createElement('div');
  row.className = 'bg-white border border-gray-100 rounded-xl p-3 space-y-2';
  row.dataset.kitRow = String(id);
  row.innerHTML = `<select data-kit-product class="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs">${productOptions}</select>
    <input data-kit-manual value="${escapeHtml(data.name || '')}" placeholder="Manual component name (if not linked)" class="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs ${data.productId ? 'hidden' : ''}">
    <select data-kit-variant class="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs"></select>
    <div class="flex items-center gap-2"><input data-kit-qty type="number" min="1" step="1" value="${Math.max(1,Number(data.quantity)||1)}" class="w-20 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs" aria-label="Quantity"><label class="flex items-center gap-1 text-[11px] text-gray-600"><input data-kit-required type="checkbox" ${data.required !== false ? 'checked' : ''}> Required</label><button type="button" data-kit-remove class="ml-auto text-red-500 text-[11px] font-bold">Remove</button></div>`;
  host.appendChild(row);
  const productSelect=row.querySelector('[data-kit-product]'), variantSelect=row.querySelector('[data-kit-variant]'), manual=row.querySelector('[data-kit-manual]');
  const refreshVariants=()=>{
    const p=kitProducts.find(x=>x.id===productSelect.value);
    manual.classList.toggle('hidden',!!p);
    const variants=Array.isArray(p?.variants)?p.variants:[];
    const oldVariant = variants.find(v=>v.id===data.variantId) || (data.variant ? variants.find((v,i)=>kitVariantLabel(v,i)===data.variant) : null);
    variantSelect.innerHTML=variants.map((v,i)=>`<option value="${escapeHtml(v.id||'')}" ${(v.id===oldVariant?.id)?'selected':''}>${escapeHtml(kitVariantLabel(v,i))} · ₦${Number(v.promoPrice>0?v.promoPrice:v.price||0).toLocaleString()}${v.inStock===false?' · Currently unavailable':''}</option>`).join('');
    variantSelect.classList.toggle('hidden',!p || !variants.length);
    if(p && !variants.length) variantSelect.innerHTML='<option value="">No variants configured</option>';
  };
  productSelect.addEventListener('change',()=>{data.variantId=null;refreshVariants();});
  row.querySelector('[data-kit-remove]').addEventListener('click',()=>row.remove());
  refreshVariants();
}
function collectKitComponents() {
  return [...document.querySelectorAll('#projectKitRows [data-kit-row]')].map(row=>{
    const productId=row.querySelector('[data-kit-product]').value;
    const product=kitProducts.find(p=>p.id===productId);
    const variantId=row.querySelector('[data-kit-variant]').value || null;
    const variant=(product?.variants||[]).find(v=>v.id===variantId);
    return {
      productId: product?.id || null,
      productName: product?.name || null,
      variantId: variant?.id || null,
      variant: variant ? kitVariantLabel(variant,(product.variants||[]).indexOf(variant)) : '',
      name: product ? product.name : row.querySelector('[data-kit-manual]').value.trim(),
      quantity: Math.max(1,parseInt(row.querySelector('[data-kit-qty]').value,10)||1),
      required: row.querySelector('[data-kit-required]').checked
    };
  }).filter(x=>x.name);
}
function renderKitComponents(items=[]) {
  const host=$('projectKitRows'); if(!host) return;
  host.innerHTML=''; kitRowCounter=0;
  (items||[]).forEach(addKitRow);
}
export function setProjectKitProducts(items) { kitProducts=items||[]; }

const publishingDue = new Set();
const $ = id => document.getElementById(id);
const form = $('projectForm');

function resetForm() {
  form.reset();
  $('projectEditId').value = '';
  $('projectFormTitle').textContent = 'Add Engineering Project';
  $('projectSaveBtn').textContent = 'Save Project';
  $('projectStatus').value = 'draft';
  $('projectPublishAt').value = '';
}
function editProject(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  $('projectEditId').value = p.id;
  $('projectTitle').value = p.title || '';
  $('projectCategory').value = p.category || '';
  $('projectSummary').value = p.summary || '';
  $('projectDescription').value = p.description || '';
  $('projectMaterials').value = Array.isArray(p.materials) ? p.materials.join(', ') : '';
  $('projectProcess').value = p.process || '';
  $('projectOutcome').value = p.outcome || '';
  $('projectServiceLinks').value = (Array.isArray(p.serviceLinks) ? p.serviceLinks : []).map(x => `${x.label || ''} | ${x.url || ''}`).join('\n');
  $('projectCover').value = p.coverImage || '';
  $('projectCover').dispatchEvent(new Event('input', { bubbles: true }));
  $('projectImages').value = Array.isArray(p.images) ? p.images.join('\n') : '';
  $('projectVideo').value = p.videoUrl || '';
  renderKitComponents(p.kitComponents || []);
  const savedPublishDate = p.publishAt?.toDate ? p.publishAt.toDate() : new Date(p.publishAt || 0);
  const isFutureSchedule = p.status === 'scheduled';
  $('projectStatus').value = p.status === 'published' ? 'published' : (isFutureSchedule ? 'scheduled' : 'draft');
  $('projectScheduleWrap').classList.toggle('hidden', !isFutureSchedule);
  $('projectPublishAt').value = p.publishAt?.toDate ? new Date(p.publishAt.toDate().getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : (p.publishAt instanceof Date ? new Date(p.publishAt.getTime() - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16) : '');
  $('projectFormTitle').textContent = 'Edit: ' + p.title;
  $('projectSaveBtn').textContent = 'Update Project';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function removeProject(id) {
  if (!confirm('Permanently delete this project? This cannot be undone.')) return;
  await deleteProject(id);
}
function projectState(p) {
  if (p.status === 'scheduled') return 'Scheduled';
  if (p.status === 'published') return 'Published';
  return 'Draft / Unpublished';
}

// Runs in the authenticated admin dashboard only. Due scheduled projects are
// promoted using the admin's existing Firestore write permission.
async function publishDueProjects() {
  const now = Date.now();
  const tasks = projects.filter(p => {
    if (publishingDue.has(p.id)) return false;
    const date = p.publishAt?.toDate ? p.publishAt.toDate() : new Date(p.publishAt || 0);
    if (!Number.isFinite(date.getTime())) return false;
    // Migrate older scheduled entries, which were stored as "published" with
    // a future publishAt, into the new private "scheduled" state.
    if (p.status === 'published' && date.getTime() > now) return true;
    // Publish a scheduled entry once its due time has arrived.
    if (p.status === 'scheduled' && date.getTime() <= now) return true;
    return false;
  });
  for (const p of tasks) {
    publishingDue.add(p.id);
    const date = p.publishAt?.toDate ? p.publishAt.toDate() : new Date(p.publishAt || 0);
    const nextStatus = date.getTime() > now ? 'scheduled' : 'published';
    try {
      await updateProject(p.id, {
        status: nextStatus,
        ...(nextStatus === 'published' ? { publishedAt: new Date() } : {})
      });
    } catch (err) {
      console.error('Could not update scheduled project:', p.id, err);
      const notice = $('projectPublishNotice');
      if (notice) notice.textContent = 'A scheduled project could not be updated. Please check your connection and permissions.';
    } finally {
      publishingDue.delete(p.id);
    }
  }
}
function render() {
  $('projectList').innerHTML = projects.map(p => {
    const state = projectState(p);
    const colour = state === 'Published' ? 'text-green-700 bg-green-50' : state === 'Scheduled' ? 'text-amber-700 bg-amber-50' : 'text-gray-600 bg-gray-100';
    const rawImage = p.coverImage || '../assets/pictures/placeholder.svg';
    const previewImage = /^https?:\/\//i.test(rawImage) || rawImage.startsWith('../') ? rawImage : '../' + rawImage;
    return `<article class="bg-white p-4 rounded-2xl border border-gray-100 flex gap-3 items-start shadow-sm">
      <img src="${escapeHtml(previewImage)}" class="w-20 h-20 rounded-xl object-cover bg-gray-100" alt="">
      <div class="flex-1 min-w-0"><div class="flex flex-wrap gap-2 items-center mb-1"><h3 class="font-bold text-sm">${escapeHtml(p.title)}</h3><span class="text-[10px] px-2 py-1 rounded-full font-bold ${colour}">${state}</span></div>
      <p class="text-xs text-gray-500">${escapeHtml(p.category || 'Engineering project')}</p><p class="text-xs text-gray-600 mt-1 line-clamp-2">${escapeHtml(p.summary || '')}</p>
      <div class="flex flex-wrap gap-2 mt-3">
        <button type="button" data-pedit="${escapeHtml(p.id)}" class="text-[10px] bg-gray-100 px-3 py-2 rounded-lg font-bold">EDIT</button>
        ${p.status === 'published' ? `<button type="button" data-punpublish="${escapeHtml(p.id)}" class="text-[10px] bg-amber-50 text-amber-700 px-3 py-2 rounded-lg font-bold">UNPUBLISH</button>` : `<button type="button" data-ppublish="${escapeHtml(p.id)}" class="text-[10px] bg-green-50 text-green-700 px-3 py-2 rounded-lg font-bold">PUBLISH NOW</button>`}
        <button type="button" data-pdelete="${escapeHtml(p.id)}" class="text-[10px] bg-red-50 text-red-600 px-3 py-2 rounded-lg font-bold">DELETE</button>
      </div></div></article>`;
  }).join('') || '<p class="text-center text-gray-400 text-sm py-10">No projects yet. Add your first engineering project above.</p>';
  document.querySelectorAll('[data-pedit]').forEach(b => b.addEventListener('click', () => editProject(b.dataset.pedit)));
  document.querySelectorAll('[data-pdelete]').forEach(b => b.addEventListener('click', () => removeProject(b.dataset.pdelete)));
  document.querySelectorAll('[data-punpublish]').forEach(b => b.addEventListener('click', async () => updateProject(b.dataset.punpublish, { status: 'draft' })));
  document.querySelectorAll('[data-ppublish]').forEach(b => b.addEventListener('click', async () => updateProject(b.dataset.ppublish, { status: 'published', publishAt: new Date() })));
}
async function createStarterDrafts() {
  if (projects.length) return alert('Starter drafts are only available when the project list is empty.');
  if (!confirm('Create three editable draft entries based on the projects you shared? They will not appear on the public website until you publish them.')) return;
  const starters = [
    {
      title: 'Robotic Drawing Machine',
      category: 'Robotics & Mechanical Design',
      summary: 'A servo-driven drawing mechanism built to explore coordinated movement and automated pen control.',
      description: 'This prototype uses linked mechanical arms and servo actuation to move a pen across paper. The build explores how mechanical geometry and controlled movement can be combined to produce a drawing.',
      materials: [], process: 'A mechanical linkage and servo arrangement was assembled and tested with a pen on paper.', outcome: 'The prototype produced a portrait-style drawing on paper.',
      coverImage: '', images: [], videoUrl: ''
    },
    {
      title: 'Ultrasonic Robot Vehicle',
      category: 'Robotics & Embedded Systems',
      summary: 'A small mobile robot prototype combining custom electronics and ultrasonic sensing.',
      description: 'The vehicle brings together a wheeled chassis, ultrasonic sensor modules, microcontroller boards and hand-assembled electronics. A recorded test shows the vehicle moving.',
      materials: [], process: 'The electronic modules were assembled on prototyping boards and fitted to a mobile chassis for testing.', outcome: 'A moving robot vehicle prototype was demonstrated.',
      coverImage: '', images: [], videoUrl: ''
    },
    {
      title: 'Servo-Driven Robotic Arm',
      category: 'Robotics & Mechanical Design',
      summary: 'A linkage-based robotic arm prototype using servo actuators to explore controlled mechanical movement.',
      description: 'This build explores a multi-link mechanical structure and servo actuation. The frame and linkages provide a practical platform for studying movement, alignment and mechanical design.',
      materials: [], process: 'The arm structure was assembled from linked sections with servo actuation at key joints.', outcome: 'A physical robotic arm prototype was assembled for further development.',
      coverImage: '', images: [], videoUrl: ''
    }
  ];
  try {
    for (const item of starters) await addProject({ ...item, status: 'draft', publishAt: new Date('2999-01-01T00:00:00Z'), createdAt: new Date(), updatedAt: new Date() });
    alert('Three starter drafts created. Add the project photos and video links, review the descriptions, then publish when ready.');
  } catch (err) { alert('Could not create starter drafts: ' + err.message); }
}
export function initProjects() {
  $('projectStatus').addEventListener('change', () => {
    $('projectScheduleWrap').classList.toggle('hidden', $('projectStatus').value !== 'scheduled');
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const statusChoice = $('projectStatus').value;
    let publishAt = new Date();
    if (statusChoice === 'scheduled') {
      if (!$('projectPublishAt').value) return alert('Choose a publication date and time.');
      publishAt = new Date($('projectPublishAt').value);
      if (Number.isNaN(publishAt.getTime()) || publishAt <= new Date()) return alert('Choose a future publication date and time.');
    }
    const kitComponents = collectKitComponents();
    if (kitComponents.some(item => item.productId && !item.variantId)) return alert('Choose a valid store variant for each linked product, or remove the product link and enter it as a manual component.');
    const project = {
      title: $('projectTitle').value.trim(),
      category: $('projectCategory').value.trim(),
      summary: $('projectSummary').value.trim(),
      description: $('projectDescription').value.trim(),
      materials: $('projectMaterials').value.split(',').map(x => x.trim()).filter(Boolean),
      process: $('projectProcess').value.trim(),
      outcome: $('projectOutcome').value.trim(),
      serviceLinks: $('projectServiceLinks').value.split('\n').map(line => { const [label, ...urlParts] = line.split('|'); return { label: label.trim(), url: urlParts.join('|').trim() }; }).filter(x => x.label && /^https:\/\//i.test(x.url)),
      coverImage: $('projectCover').value.trim(),
      images: $('projectImages').value.split('\n').map(x => x.trim()).filter(Boolean),
      videoUrl: $('projectVideo').value.trim(),
      kitComponents,
      status: statusChoice,
      publishAt: statusChoice === 'draft' ? new Date('2999-01-01T00:00:00Z') : publishAt,
      updatedAt: new Date()
    };
    if (!project.title || !project.summary) return alert('Project title and short summary are required.');
    try {
      const id = $('projectEditId').value;
      if (id) await updateProject(id, project);
      else await addProject({ ...project, createdAt: new Date() });
      resetForm();
      $('projectScheduleWrap').classList.add('hidden');
    } catch (err) { alert('Could not save project: ' + err.message); }
  });
  $('projectResetBtn').addEventListener('click', resetForm);
  $('projectStarterBtn').addEventListener('click', createStarterDrafts);
  $('projectKitAddBtn')?.addEventListener('click', () => addKitRow());
  resetForm();
}
export function renderProjects(items) {
  projects = items || [];
  render();
  publishDueProjects();
}

export function checkDueProjectPublications() {
  publishDueProjects();
}
