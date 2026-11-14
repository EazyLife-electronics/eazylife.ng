// admin/js/admin-reviews.mjs
// Admin-managed review stories. Reviewer-submitted text remains unchanged;
// EazyLife admins may add summaries, categories, photos and optional project context.

import { addReview, updateReview, setReviewApproval, markReviewHandled, deleteReview } from '../../js/store.mjs';
import { escapeHtml } from './admin-shared.mjs';

let allReviews = [];
let editingId = null;
const byId = id => document.getElementById(id);
const value = id => (byId(id)?.value || '').trim();

function formPayload() {
  const project = {
    title: value('rvProjectTitle'),
    description: value('rvProjectDescription'),
    materials: value('rvProjectMaterials').split(',').map(x => x.trim()).filter(Boolean),
    process: value('rvProjectProcess'),
    outcome: value('rvProjectOutcome')
  };
  const hasProject = Boolean(project.title || project.description || project.materials.length || project.process || project.outcome);
  return {
    name: value('rvName'),
    title: value('rvTitle'),
    stars: parseInt(byId('rvStars').value, 10) || 0,
    text: value('rvText'),
    summary: value('rvSummary'),
    categories: value('rvCategory').split(',').map(x => x.trim()).filter(Boolean),
    coverImage: value('rvCoverImage'),
    images: value('rvImages').split('\n').map(x => x.trim()).filter(Boolean),
    featured: byId('rvFeatured').checked,
    ...(hasProject ? { project } : { project: null }),
    approved: byId('rvApproved').checked
  };
}

function resetForm() {
  byId('reviewAddForm').reset();
  editingId = null;
  byId('rvEditId').value = '';
  byId('rvSaveBtn').textContent = 'Save Review';
  byId('rvCancelEdit').classList.add('hidden');
  byId('rvApproved').checked = false;
}

function editReview(id) {
  const r = allReviews.find(x => x.id === id);
  if (!r) return;
  editingId = id;
  byId('rvEditId').value = id;
  byId('rvName').value = r.name || '';
  byId('rvTitle').value = r.title || '';
  byId('rvStars').value = String(r.stars || 5);
  byId('rvText').value = r.text || '';
  byId('rvSummary').value = r.summary || '';
  byId('rvCategory').value = (r.categories || []).join(', ');
  byId('rvCoverImage').value = r.coverImage || '';
  byId('rvCoverImage').dispatchEvent(new Event('input', { bubbles: true }));
  byId('rvImages').value = (r.images || []).join('\n');
  byId('rvFeatured').checked = r.featured === true;
  byId('rvApproved').checked = r.approved === true;
  const p = r.project || {};
  byId('rvProjectTitle').value = p.title || '';
  byId('rvProjectDescription').value = p.description || '';
  byId('rvProjectMaterials').value = (p.materials || []).join(', ');
  byId('rvProjectProcess').value = p.process || '';
  byId('rvProjectOutcome').value = p.outcome || '';
  byId('rvSaveBtn').textContent = 'Update Review Story';
  byId('rvCancelEdit').classList.remove('hidden');
  byId('reviewAddForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function toggleReviewApproval(id, current) {
  await setReviewApproval(id, !current);
}

async function markReviewAsHandled(id) {
  await markReviewHandled(id);
}

async function removeReview(id) {
  if (!confirm('Delete this review permanently?')) return;
  await deleteReview(id);
}

function renderReviewList() {
  byId('reviewList').innerHTML = allReviews.map(r => {
    const stars = Math.max(0, Math.min(5, r.stars || 0));
    const photoCount = (r.coverImage ? 1 : 0) + (Array.isArray(r.images) ? r.images.length : 0);
    return `<div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div class="flex justify-between items-start mb-2"><div>
        <p class="font-bold text-sm text-gray-800">${escapeHtml(r.name)}</p>
        <p class="text-xs text-gray-400">${escapeHtml(r.title || '')} · ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</p>
      </div><span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${r.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${r.approved ? 'Live' : 'Hidden'}</span></div>
      <p class="text-xs text-gray-600 mb-2">“${escapeHtml(r.text)}”</p>
      <p class="text-[10px] text-gray-400 mb-3">${photoCount} photo(s) · ${escapeHtml((r.categories || []).join(', ') || 'Uncategorised')}${r.project?.title ? ' · Project: ' + escapeHtml(r.project.title) : ''}${r.featured ? ' · Homepage feature' : ''}</p>
      <div class="flex flex-wrap gap-2">
        <button data-edit="${escapeHtml(r.id)}" class="bg-teal-50 text-teal-700 px-3 py-1.5 rounded-md text-[10px] font-bold">Manage story & photos</button>
        <button data-toggle="${escapeHtml(r.id)}" data-current="${r.approved}" class="text-[10px] ${r.approved ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-white'} px-3 py-1.5 rounded-md font-bold">${r.approved ? 'Hide' : 'Approve'}</button>
        ${r.approved !== true && r.adminReviewed !== true ? `<button data-review-handled="${escapeHtml(r.id)}" class="text-[10px] bg-amber-50 text-amber-800 px-3 py-1.5 rounded-md font-bold">Mark handled</button>` : `<span class="text-[10px] text-green-700 font-bold px-2 py-1.5">Handled</span>`}
        <button data-rvdel="${escapeHtml(r.id)}" class="text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-bold">Delete</button>
      </div></div>`;
  }).join('') || '<p class="text-center text-gray-400 text-sm py-10">No reviews yet - add one above.</p>';

  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => editReview(b.dataset.edit)));
  document.querySelectorAll('.toggle-review-btn,[data-toggle]').forEach(b => b.addEventListener('click', () => toggleReviewApproval(b.dataset.toggle, b.dataset.current === 'true')));
  document.querySelectorAll('[data-review-handled]').forEach(b => b.addEventListener('click', async () => {
    b.disabled = true;
    try { await markReviewAsHandled(b.dataset.reviewHandled); }
    catch (err) { b.disabled = false; alert('Could not mark review handled: ' + err.message); }
  }));
  document.querySelectorAll('[data-rvdel]').forEach(b => b.addEventListener('click', () => removeReview(b.dataset.rvdel)));
}

export function initReviews() {
  byId('reviewAddForm').addEventListener('submit', async e => {
    e.preventDefault();
    const payload = formPayload();
    try {
      if (editingId) {
        // Keep the submitted review text intact unless an admin explicitly edits it.
        await updateReview(editingId, payload);
      } else {
        await addReview(payload);
      }
      resetForm();
    } catch (err) {
      alert('Failed to save review: ' + err.message);
    }
  });
  byId('rvCancelEdit').addEventListener('click', resetForm);
}

export function renderReviews(reviews) {
  allReviews = reviews;
  renderReviewList();
}
