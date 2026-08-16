// admin/js/admin-reviews.mjs
// Reviews tab: add a review directly, and approve/deactivate/delete
// public-submitted ones. Split out of admin-app.mjs.

import { addReview, updateReview, deleteReview } from '../../js/store.mjs';
import { escapeHtml } from './admin-shared.mjs';

let allReviews = [];

async function toggleReviewApproval(id, current) {
  await updateReview(id, { approved: !current });
}

async function removeReview(id) {
  if (!confirm('Delete this review permanently?')) return;
  await deleteReview(id);
}

function renderReviewList() {
  document.getElementById('reviewList').innerHTML = allReviews.map(r => {
    const stars = Math.max(0, Math.min(5, r.stars || 0));
    return `
    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-bold text-sm text-gray-800">${escapeHtml(r.name)}</p>
          <p class="text-xs text-gray-400">${escapeHtml(r.title || '')} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}</p>
        </div>
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${r.approved ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">${r.approved ? 'Live' : 'Hidden'}</span>
      </div>
      <p class="text-xs text-gray-600 mb-3">"${escapeHtml(r.text)}"</p>
      <div class="flex gap-2">
        <button data-toggle="${escapeHtml(r.id)}" data-current="${r.approved}" class="toggle-review-btn text-[10px] ${r.approved ? 'bg-gray-100 text-gray-600' : 'bg-gray-900 text-white'} px-3 py-1.5 rounded-md font-bold">
          ${r.approved ? 'Deactivate' : 'Approve'}
        </button>
        <button data-rvdel="${escapeHtml(r.id)}" class="text-[10px] bg-red-50 text-red-600 hover:bg-red-600 hover:text-white px-3 py-1.5 rounded-md font-bold transition-all">Delete</button>
      </div>
    </div>
  `;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No reviews yet — add one above.</p>`;

  document.querySelectorAll('.toggle-review-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleReviewApproval(btn.dataset.toggle, btn.dataset.current === 'true'));
  });
  document.querySelectorAll('[data-rvdel]').forEach(b => b.addEventListener('click', () => removeReview(b.dataset.rvdel)));
}

/* ---------------- PUBLIC API ---------------- */

export function initReviews() {
  document.getElementById('reviewAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const review = {
      name: document.getElementById('rvName').value.trim(),
      title: document.getElementById('rvTitle').value.trim(),
      stars: parseInt(document.getElementById('rvStars').value, 10),
      text: document.getElementById('rvText').value.trim(),
      approved: document.getElementById('rvApproved').checked
    };
    try {
      await addReview(review);
      e.target.reset();
      document.getElementById('rvApproved').checked = true;
    } catch (err) {
      alert('Failed to save review: ' + err.message);
    }
  });
}

export function renderReviews(reviews) {
  allReviews = reviews;
  renderReviewList();
}
