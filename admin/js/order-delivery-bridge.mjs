// Bridges confirmed orders into the delivery queue without changing the existing order workflow.
import { initFirebase } from '../../js/firebase.mjs';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { watchOrders } from '../../js/store.mjs';
import { createDeliveryFromOrder } from './delivery-operations.mjs';

let orders = [];
let queued = false;
let unsubOrders = null;

function esc(value) {
  return String(value ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderButtons() {
  const list = document.getElementById('orderList');
  if (!list) return;

  [...list.children].forEach(card => {
    if (!card.classList.contains('bg-white')) return;
    if (card.querySelector('[data-send-delivery]')) return;

    const codeEl = card.querySelector('.text-teal-600');
    const code = codeEl?.textContent?.trim();
    if (!code) return;

    const order = orders.find(o => (o.trackingCode || o.id) === code);
    if (!order || order.status !== 'confirmed') return;

    const actionRow = card.querySelector('.flex.gap-2.flex-wrap.justify-end');
    if (!actionRow) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.sendDelivery = order.id;
    button.className = 'text-[10px] bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md font-bold';
    button.textContent = 'Send to Delivery';
    actionRow.appendChild(button);
  });
}

async function sendToDelivery(id, button) {
  const order = orders.find(o => o.id === id);
  if (!order) return alert('Order could not be found. Please refresh the Orders tab.');
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'Sending...';
  try {
    const result = await createDeliveryFromOrder(order);
    button.textContent = result.alreadyExists ? 'Already in Delivery ✓' : 'Sent to Delivery ✓';
    button.classList.remove('bg-emerald-50','text-emerald-700');
    button.classList.add('bg-gray-100','text-gray-500');
    button.title = `Delivery ${result.id}`;
  } catch (err) {
    console.error('Could not create delivery:', err);
    alert(err?.message || 'Could not send order to delivery.');
    button.disabled = false;
    button.textContent = original;
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-send-delivery]');
  if (button) sendToDelivery(button.dataset.sendDelivery, button);
});

function init() {
  const list = document.getElementById('orderList');
  if (!list) return setTimeout(init, 150);

  // watchOrders() requires an authenticated admin (see the `orders` Firestore
  // rule). Subscribing immediately on page load — before login — makes that
  // first call fail with permission-denied, and Firestore's onSnapshot does
  // NOT auto-retry a listener that already errored out once, even after you
  // do log in. Gating this behind onAuthStateChanged (re-subscribing on every
  // login/logout) is what admin-app.mjs and purchases.mjs already do; this
  // module just hadn't followed the same pattern.
  const { auth } = initFirebase();
  onAuthStateChanged(auth, (user) => {
    if (unsubOrders) { unsubOrders(); unsubOrders = null; }
    orders = [];
    if (!user) return;
    unsubOrders = watchOrders(next => { orders = next; renderButtons(); });
  });

  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      renderButtons();
    });
  });
  observer.observe(list, { childList:true, subtree:true });
  renderButtons();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
}
