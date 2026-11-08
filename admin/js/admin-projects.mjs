// Admin project gallery manager.
import { addProject, updateProject, deleteProject } from '../../js/store.mjs';
import { escapeHtml } from './admin-shared.mjs';

let projects = [];
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
  $('projectCover').value = p.coverImage || '';
  $('projectImages').value = Array.isArray(p.images) ? p.images.join('\n') : '';
  $('projectVideo').value = p.videoUrl || '';
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
  const due = projects.filter(p => {
    if (p.status !== 'scheduled' || publishingDue.has(p.id)) return false;
    const date = p.publishAt?.toDate ? p.publishAt.toDate() : new Date(p.publishAt || 0);
    return Number.isFinite(date.getTime()) && date.getTime() <= now;
  });
  for (const p of due) {
    publishingDue.add(p.id);
    try {
      await updateProject(p.id, { status: 'published', publishedAt: new Date() });
    } catch (err) {
      console.error('Could not auto-publish scheduled project:', p.id, err);
      const notice = $('projectPublishNotice');
      if (notice) notice.textContent = 'A scheduled project is due but could not be published. Please check your connection and permissions.';
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
    const project = {
      title: $('projectTitle').value.trim(),
      category: $('projectCategory').value.trim(),
      summary: $('projectSummary').value.trim(),
      description: $('projectDescription').value.trim(),
      materials: $('projectMaterials').value.split(',').map(x => x.trim()).filter(Boolean),
      process: $('projectProcess').value.trim(),
      outcome: $('projectOutcome').value.trim(),
      coverImage: $('projectCover').value.trim(),
      images: $('projectImages').value.split('\n').map(x => x.trim()).filter(Boolean),
      videoUrl: $('projectVideo').value.trim(),
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
  resetForm();
}
export function renderProjects(items) {
  projects = items || [];
  render();
  publishDueProjects();
}
