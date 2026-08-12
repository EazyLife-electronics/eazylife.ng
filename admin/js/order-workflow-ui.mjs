// admin/js/order-workflow-ui.mjs
// Order-management UI enhancements layered on top of the existing admin order renderer.
// Keeps delivery status and payment status separate while making the order lifecycle easier to manage.

import { updateOrderStatus } from '../../js/store.mjs';

const FLOW = ['new', 'confirmed', 'delivered'];
const LABELS = { new: 'New', confirmed: 'Confirmed', delivered: 'Delivered', cancelled: 'Cancelled' };
const COLORS = {
  new: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

let currentFilter = 'all';
let currentSearch = '';
let toolbar = null;
let observer = null;
let orderMutationQueued = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>\"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function orderMatches(card) {
  const text = (card.textContent || '').toLowerCase();
  const searchOk = !currentSearch || text.includes(currentSearch);
  if (!searchOk) return false;

  if (currentFilter === 'all') return true;
  const badge = card.querySelector('span.text-[10px]');
  const status = badge?.textContent?.trim().toLowerCase() || '';
  return status === currentFilter;
}

function updateVisibility() {
  const list = document.getElementById('orderList');
  if (!list) return;
  const cards = [...list.children].filter(el => el.classList.contains('bg-white'));
  cards.forEach(card => { card.style.display = orderMatches(card) ? '' : 'none'; });

  const empty = list.querySelector('[data-order-filter-empty]');
  const visible = cards.some(card => card.style.display !== 'none');
  if (!visible && cards.length) {
    if (!empty) {
      const el = document.createElement('p');
      el.dataset.orderFilterEmpty = 'true';
      el.className = 'text-center text-gray-400 text-sm py-10';
      el.textContent = 'No orders match this filter.';
      list.appendChild(el);
    }
  } else {
    empty?.remove();
  }
}

function getCounts() {
  const list = document.getElementById('orderList');
  const counts = { all: 0, new: 0, confirmed: 0, delivered: 0, cancelled: 0 };
  if (!list) return counts;
  [...list.children].forEach(card => {
    if (!card.classList.contains('bg-white')) return;
    counts.all++;
    const badge = card.querySelector('span.text-[10px]');
    const status = badge?.textContent?.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
  });
  return counts;
}

function renderToolbar() {
  const list = document.getElementById('orderList');
  if (!list) return;

  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'orderWorkflowToolbar';
    toolbar.className = 'bg-white p-4 rounded-2xl shadow-sm mb-4';
    list.parentElement.insertBefore(toolbar, list);
  }

  const counts = getCounts();
  const filters = ['all', 'new', 'confirmed', 'delivered', 'cancelled'];
  toolbar.innerHTML = `
    <div class="flex justify-between items-center gap-3 mb-3">
      <div>
        <p class="font-black text-sm text-gray-800">Order workflow</p>
        <p class="text-[10px] text-gray-400">Delivery status is independent from payment status.</p>
      </div>
      <span class="text-[10px] font-bold text-gray-400">${counts.all} total</span>
    </div>
    <input id="orderWorkflowSearch" value="${esc(currentSearch)}" placeholder="Search customer, phone, tracking code or item..." class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs outline-none mb-3">
    <div class="flex gap-2 overflow-x-auto pb-1">
      ${filters.map(status => `
        <button type="button" data-order-filter="${status}" class="whitespace-nowrap px-3 py-2 rounded-lg text-[10px] font-bold ${currentFilter === status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}">
          ${LABELS[status] || 'All'} <span class="opacity-70">${counts[status]}</span>
        </button>
      `).join('')}
    </div>`;

  toolbar.querySelector('#orderWorkflowSearch').addEventListener('input', e => {
    currentSearch = e.target.value.trim().toLowerCase();
    updateVisibility();
  });
  toolbar.querySelectorAll('[data-order-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.orderFilter;
      renderToolbar();
      updateVisibility();
    });
  });
}

function bindStatusActions() {
  const list = document.getElementById('orderList');
  if (!list || list.dataset.workflowBound === 'true') return;
  list.dataset.workflowBound = 'true';

  // Capture the click before admin-app.mjs's own listener. This prevents duplicate
  // Firestore transactions and gives the admin a visible loading/error state.
  list.addEventListener('click', async event => {
    const btn = event.target.closest('.advance-order-btn');
    if (!btn) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    if (btn.disabled) return;
    const id = btn.dataset.order;
    const next = btn.dataset.next;
    const label = LABELS[next] || next;

    if (!id || !next) return;

    const question = next === 'confirmed'
      ? 'Confirm this order? Inventory will be deducted when it is confirmed.'
      : `Mark this order as ${label.toLowerCase()}?`;
    if (!window.confirm(question)) return;

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = `Marking ${label.toLowerCase()}...`;
    btn.classList.add('opacity-60');

    try {
      await updateOrderStatus(id, next);
      // watchOrders will redraw the card. This fallback keeps the UI understandable
      // even if the snapshot takes a moment to arrive.
      btn.textContent = `${label} ✓`;
    } catch (err) {
      console.error('Order status update failed:', err);
      window.alert(`Could not mark order as ${label.toLowerCase()}: ${err?.message || err}`);
      btn.disabled = false;
      btn.textContent = original;
      btn.classList.remove('opacity-60');
    }
  }, true);
}

function refresh() {
  const list = document.getElementById('orderList');
  if (!list) return;
  renderToolbar();
  bindStatusActions();
  updateVisibility();
}

function queueRefresh() {
  if (orderMutationQueued) return;
  orderMutationQueued = true;
  requestAnimationFrame(() => {
    orderMutationQueued = false;
    refresh();
  });
}

function init() {
  const list = document.getElementById('orderList');
  if (!list) {
    setTimeout(init, 150);
    return;
  }

  refresh();
  observer = new MutationObserver(queueRefresh);
  observer.observe(list, { childList: true, subtree: true });
}

if (typeof document !== 'undefined' && (location.pathname.endsWith('/admin/') || location.pathname.endsWith('/admin/index.html'))) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}
