import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const TERMS = [['prepaid', 'Prepaid'], ['pay_on_delivery', 'Pay on Delivery'], ['credit', 'Credit'], ['installment', 'Installment']];
const METHODS = ['Cash', 'Bank Transfer', 'POS', 'Card', 'Other'];
const CLOSED_STATUSES = new Set(['cancelled', 'returned']);

function money(v) { return `₦${Number(v || 0).toLocaleString()}`; }
function esc(v) { return String(v ?? '').replace(/[&<>'\"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c])); }
function paymentStatus(total, paid) {
  const b = Math.max(0, Number(total || 0) - Number(paid || 0));
  if (b <= 0) return ['PAID','bg-green-100 text-green-700'];
  if (paid > 0) return ['PARTIAL','bg-yellow-100 text-yellow-700'];
  return ['UNPAID','bg-gray-100 text-gray-600'];
}
async function loadPayments(db, id) {
  const snap = await getDocs(query(collection(db,'orders',id,'payments'), orderBy('createdAt','desc')));
  return snap.docs.map(d => ({id:d.id,...d.data()}));
}

function getCardOrderId(card) {
  const button = card.querySelector('[data-order],[data-msg-toggle],[data-reject-toggle]');
  return button?.dataset.order || button?.dataset.msgToggle || button?.dataset.rejectToggle || '';
}

function getCardStatus(card) {
  const explicit = card.dataset.orderStatus;
  if (explicit) return explicit.toLowerCase();
  const badge = card.querySelector('[data-order-status-badge]');
  if (badge) return badge.textContent.trim().toLowerCase();

  // admin-app.mjs currently renders the order status as the first span in the card.
  // Keep this fallback so cancelled orders are recognised even without a data attribute.
  const firstSpan = card.querySelector(':scope > div > div > span');
  return firstSpan?.textContent?.trim().toLowerCase() || '';
}

function removePaymentRoots(card) {
  card.querySelectorAll('[data-payment-root]').forEach(root => root.remove());
}

async function refreshPaymentCard(db, id, root) {
  const snap = await getDoc(doc(db,'orders',id));
  if (!snap.exists()) throw new Error('Order no longer exists.');

  const order = snap.data();
  const status = String(order.status || '').toLowerCase();

  // Cancellation closes collection. Never show UNPAID/PARTIAL or payment controls.
  if (CLOSED_STATUSES.has(status)) {
    const payments = await loadPayments(db, id);
    const paid = payments.reduce((s,p)=>s+Number(p.amount||0),0);
    root.innerHTML = `<div class="border-t border-gray-100 pt-3 mt-3" data-payment-closed>
      <div class="flex justify-between items-center mb-2">
        <div><p class="text-[10px] font-black uppercase text-gray-400">Payment</p><p class="text-xs font-bold text-gray-500">Collection closed — order ${esc(status)}</p></div>
        <span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-gray-100 text-gray-500">CLOSED</span>
      </div>
      ${paid > 0
        ? `<div class="bg-gray-50 rounded-lg p-2"><p class="text-[9px] uppercase text-gray-400 font-bold">Paid before cancellation</p><p class="text-xs font-black">${money(paid)}</p></div>`
        : `<p class="text-[10px] text-gray-400">No payment was recorded before cancellation.</p>`}
    </div>`;
    return;
  }

  const payments = await loadPayments(db,id);
  const total = Number(order.total || 0);
  const paid = payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const balance = Math.max(0,total-paid);
  const [paymentLabel,paymentClass] = paymentStatus(total,paid);
  const terms = order.paymentTerms || 'pay_on_delivery';

  root.innerHTML = `<div class="border-t border-gray-100 pt-3 mt-3">
    <div class="flex justify-between items-center mb-2"><div><p class="text-[10px] font-black uppercase text-gray-400">Payment</p><p class="text-xs font-bold text-gray-700">${esc(TERMS.find(x=>x[0]===terms)?.[1] || terms)}</p></div><span class="text-[10px] font-bold uppercase px-2 py-1 rounded-full ${paymentClass}">${paymentLabel}</span></div>
    <div class="grid grid-cols-2 gap-2 mb-3"><div class="bg-gray-50 rounded-lg p-2"><p class="text-[9px] uppercase text-gray-400 font-bold">Paid</p><p class="text-xs font-black">${money(paid)}</p></div><div class="bg-gray-50 rounded-lg p-2"><p class="text-[9px] uppercase text-gray-400 font-bold">Balance</p><p class="text-xs font-black">${money(balance)}</p></div></div>
    <select data-payment-terms class="w-full p-2 mb-2 bg-gray-50 rounded-lg border border-gray-200 text-xs outline-none">${TERMS.map(([v,l])=>`<option value="${v}" ${terms===v?'selected':''}>${l}</option>`).join('')}</select>
    ${balance>0?`<button type="button" data-record-payment class="w-full bg-gray-900 text-white text-[11px] font-bold py-2 rounded-lg">Record Payment</button>`:''}
    <div data-payment-form class="hidden mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200 space-y-2"><input data-payment-amount type="number" min="1" step="1" max="${balance}" placeholder="Amount (max ${money(balance)})" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none"><select data-payment-method class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none">${METHODS.map(m=>`<option value="${m}">${m}</option>`).join('')}</select><input data-payment-reference placeholder="Reference (optional)" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none"><input data-payment-note placeholder="Note (optional)" class="w-full p-2 bg-white rounded-lg border border-gray-200 text-xs outline-none"><div class="flex gap-2"><button type="button" data-payment-save class="flex-1 bg-[#00B09B] text-white text-[11px] font-bold py-2 rounded-lg">Save Payment</button><button type="button" data-payment-cancel class="bg-white border border-gray-200 text-gray-600 text-[11px] font-bold px-3 rounded-lg">Cancel</button></div></div>
    ${payments.length?`<div class="mt-3 space-y-1.5">${payments.map(p=>{const when=p.createdAt?.toDate?p.createdAt.toDate().toLocaleString():'';return `<div class="flex justify-between items-start text-[10px] bg-white border border-gray-100 rounded-lg p-2"><div><b>${esc(p.method||'Other')}</b>${p.reference?` · ${esc(p.reference)}`:''}<div class="text-gray-400">${when}${p.note?` · ${esc(p.note)}`:''}</div></div><b>${money(p.amount)}</b></div>`}).join('')}</div>`:`<p class="text-[10px] text-gray-400 mt-3">No payments recorded yet.</p>`}
  </div>`;

  root.querySelector('[data-payment-terms]').addEventListener('change',async e=>{
    e.target.disabled=true;
    try {
      await updateDoc(doc(db,'orders',id),{paymentTerms:e.target.value,paymentTermsUpdatedAt:serverTimestamp()});
      await refreshPaymentCard(db,id,root);
    } catch(err) {
      e.target.disabled=false;
      alert(`Payment terms could not be saved: ${err.message}`);
    }
  });

  const record=root.querySelector('[data-record-payment]');
  const form=root.querySelector('[data-payment-form');
  record?.addEventListener('click',()=>form?.classList.toggle('hidden'));
  root.querySelector('[data-payment-cancel]')?.addEventListener('click',()=>form?.classList.add('hidden'));
  root.querySelector('[data-payment-save]')?.addEventListener('click',async()=>{
    const amount=Number(root.querySelector('[data-payment-amount]').value||0);
    const method=root.querySelector('[data-payment-method]').value;
    const reference=root.querySelector('[data-payment-reference]').value.trim();
    const note=root.querySelector('[data-payment-note]').value.trim();
    if(!Number.isFinite(amount)||amount<=0)return alert('Enter a valid payment amount.');
    if(amount>balance)return alert(`Payment exceeds the outstanding balance of ${money(balance)}.`);
    const save=root.querySelector('[data-payment-save]');
    save.disabled=true;
    save.textContent='Saving...';
    try {
      await addDoc(collection(db,'orders',id,'payments'),{amount,method,reference,note,createdAt:serverTimestamp()});
      await refreshPaymentCard(db,id,root);
    } catch(err) {
      save.disabled=false;
      save.textContent='Save Payment';
      alert(`Payment could not be saved: ${err.message}`);
    }
  });
}

let activeObserver = null;
let activeDb = null;
let enhancing = false;

function enhanceOrders(db) {
  const list=document.getElementById('orderList');
  if(!list || enhancing)return;
  enhancing = true;

  try {
    list.querySelectorAll(':scope > div').forEach(card=>{
      const id=getCardOrderId(card);
      if(!id)return;
      const status=getCardStatus(card);

      // A cancelled/returned order must never get a collectible payment UI.
      if(CLOSED_STATUSES.has(status)) {
        removePaymentRoots(card);
        return;
      }

      // Keep exactly one payment root per order card. This also cleans up duplicates
      // left by an earlier initializer or by a previous observer cycle.
      const roots=[...card.querySelectorAll('[data-payment-root]')];
      const root=roots[0];
      roots.slice(1).forEach(r=>r.remove());
      if(root) return;

      const newRoot=document.createElement('div');
      newRoot.dataset.paymentRoot=id;
      card.appendChild(newRoot);
      refreshPaymentCard(db,id,newRoot).catch(err=>{
        if(newRoot.isConnected) newRoot.innerHTML=`<p class="text-[10px] text-red-500 mt-3">Payment section failed to load: ${esc(err.message)}</p>`;
      });
    });
  } finally {
    enhancing = false;
  }
}

function observerCallback(mutations) {
  // Ignore mutations caused only by rendering inside an existing payment root.
  // This prevents our own innerHTML updates from causing repeated payment sections.
  const relevant = mutations.some(m => {
    if (m.type !== 'childList') return false;
    if ([...m.addedNodes, ...m.removedNodes].some(node => {
      if (!(node instanceof Element)) return false;
      return node.closest('[data-payment-root]') || node.matches('[data-payment-root]');
    })) return false;
    return true;
  });
  if (relevant) enhanceOrders(activeDb);
}

export function initPaymentsUI(db) {
  const list=document.getElementById('orderList');
  if(!list)return()=>{};

  if(activeObserver) activeObserver.disconnect();
  activeDb = db;
  activeObserver = new MutationObserver(observerCallback);
  activeObserver.observe(list,{childList:true,subtree:true});
  enhanceOrders(activeDb);

  return()=>{
    if(activeObserver){activeObserver.disconnect();activeObserver=null;}
    activeDb=null;
  };
}
