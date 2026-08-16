// admin/js/admin-requests.mjs
// Sourcing Requests tab: "can't find what you want" and budget-based
// requests submitted from the shop. Split out of admin-app.mjs.

import { updateRequestStatus } from '../../js/store.mjs';
import { escapeHtml } from './admin-shared.mjs';

const REQ_STATUS_FLOW = ['new', 'contacted', 'fulfilled'];
const REQ_STATUS_COLORS = { new: 'bg-yellow-100 text-yellow-700', contacted: 'bg-blue-100 text-blue-700', fulfilled: 'bg-green-100 text-green-700' };

// Passed directly as the watchRequests() callback — every field here comes
// from an unauthenticated public form submission, so all of it is escaped.
export function renderRequestList(requests) {
  document.getElementById('requestList').innerHTML = requests.map(r => {
    const nextStatus = REQ_STATUS_FLOW[REQ_STATUS_FLOW.indexOf(r.status) + 1];
    const created = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleString() : '';
    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-bold text-sm text-gray-800">${escapeHtml(r.name || 'Unknown')}</p>
            <p class="text-xs text-gray-400">${escapeHtml(r.phone || '')} · ${created}</p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${REQ_STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}">${escapeHtml(r.status || 'new')}</span>
        </div>
        <p class="text-xs text-gray-600 mb-1"><b>Needs:</b> ${escapeHtml(r.need || '')}</p>
        ${r.category ? `<p class="text-xs text-gray-400 mb-1"><b>Category:</b> ${escapeHtml(r.category)}</p>` : ''}
        ${r.budget ? `<p class="text-xs text-gray-400 mb-3"><b>Budget:</b> ₦${Number(r.budget).toLocaleString()}</p>` : '<div class="mb-3"></div>'}
        <div class="flex justify-end">
          ${nextStatus ? `<button data-req="${escapeHtml(r.id)}" data-next="${nextStatus}" class="advance-req-btn text-[10px] bg-gray-900 text-white px-3 py-1.5 rounded-md font-bold">Mark ${nextStatus}</button>` : ''}
        </div>
      </div>
    `;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No requests yet.</p>`;

  document.querySelectorAll('.advance-req-btn').forEach(btn => {
    btn.addEventListener('click', () => updateRequestStatus(btn.dataset.req, btn.dataset.next));
  });
}
