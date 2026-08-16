// admin/js/admin-orders.mjs
// Orders tab: order list, status advancement, cancellation, and the
// WhatsApp/SMS messaging helper. Split out of admin-app.mjs.
//
// IMPORTANT: order-workflow-ui.mjs and order-delivery-bridge.mjs both read
// the DOM this file renders into #orderList (by class name/structure, not
// via any shared JS state), so the markup here must stay byte-for-byte
// compatible with what they expect: a `.bg-white` card per order, a `span`
// holding the status text, a tracking code in `.text-teal-600`, and the
// action-button row in `.flex.gap-2.flex-wrap.justify-end`.

import { updateOrderStatus, cancelOrder } from '../../js/store.mjs';
import { escapeHtml } from './admin-shared.mjs';

const STATUS_FLOW = ['new', 'confirmed', 'delivered'];
const STATUS_COLORS = { new: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700', delivered: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };

const CANCEL_REASONS = {
  out_of_stock: 'Out of stock',
  payment_failed: 'Payment could not be confirmed'
};

// What the customer is told, if anything. 'other' uses the admin's own wording;
// a null reason means the customer just sees "cancelled" with no explanation.
function cancelReasonLabel(order) {
  if (!order.cancelReason) return null;
  if (order.cancelReason === 'other') return order.cancelCustomerNote || 'Other';
  return CANCEL_REASONS[order.cancelReason] || null;
}

// Nigerian numbers can arrive as 0805..., 234805..., or +234805... — WhatsApp's wa.me links
// need the country-code form with no plus and no leading zero.
function normalizeForWhatsApp(phone) {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '234' + digits.slice(1);
  else if (!digits.startsWith('234') && digits.length === 10) digits = '234' + digits;
  return digits;
}

function orderMessageTemplate(order) {
  const name = escapeHtml(order.customerName || 'there');
  const code = escapeHtml(order.trackingCode || order.id);
  const itemsList = (order.items || []).map(i => escapeHtml(i.name)).join(', ');
  const trackUrl = `https://eazylife.ng/track.html?code=${code}`;
  if (order.status === 'cancelled') {
    const reasonLabel = escapeHtml(cancelReasonLabel(order));
    return reasonLabel
      ? `Hi ${name}, unfortunately we're unable to fulfill your order (${code}) for ${itemsList} — ${reasonLabel.toLowerCase()}. We're sorry for the inconvenience — reach out to us if you have any questions.`
      : `Hi ${name}, unfortunately we're unable to fulfill your order (${code}) for ${itemsList} at this time. We're sorry for the inconvenience — reach out to us if you'd like to know more or place a new order.`;
  }
  const templates = {
    new: `Hi ${name}, thanks for your order with EazyLife! We're confirming your order (${code}) for ${itemsList} and will update you shortly. Track anytime: ${trackUrl}`,
    confirmed: `Hi ${name}, good news — your order (${code}) is confirmed and on its way! We'll reach out again once it's close to delivery. Track: ${trackUrl}`,
    delivered: `Hi ${name}, your order (${code}) has been delivered. Thank you for shopping with EazyLife — we'd love a quick review if you have a moment!`
  };
  return templates[order.status] || templates.new;
}

// Passed directly as the watchOrders() callback.
export function renderOrderList(orders) {
  document.getElementById('orderList').innerHTML = orders.map(o => {
    const itemsHtml = (o.items || []).map(i => `${escapeHtml(i.name)} × ${Number(i.quantity) || 0}`).join(', ');
    const isCancelled = o.status === 'cancelled';
    const canCancel = !isCancelled && o.status !== 'delivered';
    const nextStatus = isCancelled ? null : STATUS_FLOW[STATUS_FLOW.indexOf(o.status) + 1];
    const created = o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString() : '';
    const reasonLabel = escapeHtml(cancelReasonLabel(o));
    return `
      <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div class="flex justify-between items-start mb-2">
          <div>
            <p class="font-bold text-sm text-gray-800">${escapeHtml(o.customerName || 'Unknown')}</p>
            <p class="text-xs text-gray-400">${escapeHtml(o.phone || '')} · ${created}</p>
            <p class="text-[10px] font-mono text-teal-600 font-bold mt-0.5">${escapeHtml(o.trackingCode || o.id)}</p>
          </div>
          <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-500'}">${escapeHtml(o.status || 'new')}</span>
        </div>
        <p class="text-xs text-gray-600 mb-1">${itemsHtml}</p>
        <p class="text-xs text-gray-400 mb-3">${escapeHtml(o.address || '')}</p>
        ${isCancelled ? `
          <div class="bg-red-50 border border-red-100 rounded-lg p-2.5 mb-3">
            <p class="text-[11px] text-red-700"><b>Customer was told:</b> ${reasonLabel ? reasonLabel : 'No reason given'}</p>
            ${o.cancelInternalNote ? `<p class="text-[11px] text-gray-500 mt-1"><b>Internal note:</b> ${escapeHtml(o.cancelInternalNote)}</p>` : ''}
          </div>
        ` : ''}
        <div class="flex justify-between items-center mb-2">
          <span class="font-black text-sm text-[#00B09B]">₦${(o.total || 0).toLocaleString()}</span>
          <div class="flex gap-2 flex-wrap justify-end">
            <button data-msg-toggle="${o.id}" class="text-[10px] bg-gray-100 text-gray-700 px-3 py-1.5 rounded-md font-bold"><i class="fas fa-comment-dots"></i> Message</button>
            ${nextStatus ? `<button data-order="${o.id}" data-next="${nextStatus}" class="advance-order-btn text-[10px] bg-gray-900 text-white px-3 py-1.5 rounded-md font-bold">Mark ${nextStatus}</button>` : ''}
            ${canCancel ? `<button data-reject-toggle="${o.id}" class="text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-md font-bold"><i class="fas fa-ban"></i> Reject</button>` : ''}
          </div>
        </div>
        ${canCancel ? `
        <div id="rejectBox-${o.id}" class="hidden mt-3 pt-3 border-t border-gray-100 space-y-2">
          <label class="block text-[10px] font-bold uppercase text-gray-400">Reason (shown to customer)</label>
          <select id="rejectReason-${o.id}" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
            <option value="out_of_stock">Out of stock</option>
            <option value="payment_failed">Payment could not be confirmed</option>
            <option value="other">Other — I'll explain below</option>
            <option value="">Don't give the customer a reason</option>
          </select>
          <input id="rejectCustomerNote-${o.id}" placeholder="What to tell the customer" class="hidden w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">
          <textarea id="rejectInternalNote-${o.id}" rows="2" placeholder="Internal note (optional, not shown to customer) — e.g. price changed with supplier" class="w-full p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none"></textarea>
          <button data-reject-confirm="${o.id}" class="w-full bg-red-600 text-white text-[11px] font-bold py-2 rounded-lg">Confirm Rejection</button>
        </div>
        ` : ''}
        <div id="msgBox-${o.id}" class="hidden mt-3 pt-3 border-t border-gray-100">
          <textarea id="msgText-${o.id}" rows="4" class="w-full p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none mb-2">${orderMessageTemplate(o)}</textarea>
          <div class="flex gap-2">
            <button data-wa-send="${o.id}" data-phone="${escapeHtml(o.phone || '')}" class="flex-1 bg-[#25D366] text-white text-[11px] font-bold py-2 rounded-lg"><i class="fab fa-whatsapp"></i> WhatsApp</button>
            <button data-sms-send="${o.id}" data-phone="${escapeHtml(o.phone || '')}" class="flex-1 bg-gray-700 text-white text-[11px] font-bold py-2 rounded-lg"><i class="fas fa-comment-sms"></i> SMS</button>
          </div>
        </div>
      </div>
    `;
  }).join('') || `<p class="text-center text-gray-400 text-sm py-10">No orders yet.</p>`;

  document.querySelectorAll('.advance-order-btn').forEach(btn => {
    btn.addEventListener('click', () => updateOrderStatus(btn.dataset.order, btn.dataset.next));
  });

  document.querySelectorAll('[data-msg-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`msgBox-${btn.dataset.msgToggle}`).classList.toggle('hidden');
    });
  });

  document.querySelectorAll('[data-reject-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(`rejectBox-${btn.dataset.rejectToggle}`).classList.toggle('hidden');
    });
  });

  document.querySelectorAll('select[id^="rejectReason-"]').forEach(select => {
    select.addEventListener('change', () => {
      const id = select.id.replace('rejectReason-', '');
      document.getElementById(`rejectCustomerNote-${id}`).classList.toggle('hidden', select.value !== 'other');
    });
  });

  document.querySelectorAll('[data-reject-confirm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.rejectConfirm;
      const reasonSelect = document.getElementById(`rejectReason-${id}`);
      const reason = reasonSelect.value || null;
      const customerNote = reason === 'other' ? document.getElementById(`rejectCustomerNote-${id}`).value.trim() : null;
      const internalNote = document.getElementById(`rejectInternalNote-${id}`).value.trim();
      if (reason === 'other' && !customerNote) return alert("Please describe what to tell the customer, or pick a different reason.");
      if (!confirm('Reject this order? This cannot be undone from here.')) return;
      btn.disabled = true;
      btn.textContent = 'Rejecting...';
      try {
        await cancelOrder(id, { reason, customerNote: customerNote || null, internalNote: internalNote || null });
      } catch (e) {
        console.error(e);
        alert('Something went wrong rejecting this order.');
        btn.disabled = false;
        btn.textContent = 'Confirm Rejection';
      }
    });
  });

  document.querySelectorAll('[data-wa-send]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = document.getElementById(`msgText-${btn.dataset.waSend}`).value;
      const phone = normalizeForWhatsApp(btn.dataset.phone);
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
    });
  });

  document.querySelectorAll('[data-sms-send]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = document.getElementById(`msgText-${btn.dataset.smsSend}`).value;
      const phone = btn.dataset.phone.trim();
      // sms: URI body param isn't perfectly standardized across iOS/Android — if it opens
      // the messages app without the text pre-filled on a given phone, that's a platform quirk,
      // not a bug here; the composed text above is still there to copy-paste manually.
      window.location.href = `sms:${phone}?body=${encodeURIComponent(text)}`;
    });
  });
}
