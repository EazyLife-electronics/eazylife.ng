// EazyLife Quotation Manager — independent from orders and inventory.
import { initFirebase } from '../../js/firebase.mjs';
import { addProduct } from '../../js/store.mjs';
import {
  collection, addDoc, updateDoc, doc, getDocs, query, orderBy, serverTimestamp, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const { db } = initFirebase();
const QUOTES = 'quotations';
const CATALOG = 'quotationCatalogue';
const money = n => '₦' + (Number(n) || 0).toLocaleString('en-NG', { maximumFractionDigits: 2 });
const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0,10);
let products = [];
let catalogue = [];
let quotations = [];
let editingId = null;
let lineCounter = 0;
let pendingShareFile = null;

const nav = document.querySelector('.tab-btn')?.parentElement;
const dashboard = document.getElementById('dashboard');
if (nav && dashboard && !document.getElementById('quotationTabBtn')) {
  const btn = document.createElement('button');
  btn.id = 'quotationTabBtn';
  btn.dataset.tab = 'quotations';
  btn.className = 'tab-btn px-5 py-2 rounded-full text-xs font-bold bg-gray-100';
  btn.textContent = 'Quotations';
  const ordersBtn = document.querySelector('[data-tab="orders"]');
  nav.insertBefore(btn, ordersBtn);
  const panel = document.createElement('section');
  panel.id = 'panel-quotations';
  panel.className = 'tab-panel hidden';
  panel.innerHTML = `
    <div class="grid gap-5">
      <section class="bg-white p-5 rounded-2xl shadow-sm">
        <h2 class="font-black text-lg mb-1">Add quotation items</h2>
        <p class="text-xs text-gray-500 mb-4">Choose from shop products, reusable quotation items (including off-stock components), or enter something manually. Quoting never changes stock.</p>
        <h3 class="text-xs font-bold text-gray-600 mb-1">Shop products</h3>
        <select id="qProductSelect" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"><option value="">Loading product list…</option></select>
        <select id="qVariantSelect" class="w-full mt-2 p-3 bg-gray-50 rounded-xl border text-sm" disabled><option value="">Choose product first</option></select>
        <button type="button" id="qAddProduct" class="w-full mt-2 bg-teal-700 text-white p-3 rounded-xl text-sm font-bold">Add selected product</button>
        <p id="qProductHint" class="text-[11px] text-gray-500 mt-2"></p>
        <div class="border-t my-4"></div>
        <h3 class="text-xs font-bold text-gray-600 mb-1">Reusable quotation items</h3>
        <select id="qCatalogSelect" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"><option value="">Loading quotation items…</option></select>
        <button type="button" id="qAddCatalog" class="w-full mt-2 bg-gray-800 text-white p-3 rounded-xl text-sm font-bold">Add saved quotation item</button>
        <div id="qCatalogList" class="grid gap-2 mt-3"></div>
        <details class="mt-4 border-t pt-3">
          <summary class="text-sm font-bold cursor-pointer">Save a reusable quotation item</summary>
          <form id="qCatalogForm" class="grid gap-2 mt-3">
            <input id="qcName" required placeholder="Component / service name" class="w-full p-3 bg-gray-50 rounded-xl border text-sm">
            <textarea id="qcDescription" rows="2" placeholder="Description (optional)" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"></textarea>
            <div class="grid grid-cols-2 gap-2"><input id="qcBrand" placeholder="Brand (optional)" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"><input id="qcCategory" placeholder="Category (optional)" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"></div>
            <div class="grid grid-cols-2 gap-2"><input id="qcPrice" type="number" min="0" step="0.01" required placeholder="Unit price (₦)" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"><input id="qcImage" type="text" placeholder="Image URL (optional)" class="w-full p-3 bg-gray-50 rounded-xl border text-sm"></div>
            <button class="bg-gray-900 text-white p-3 rounded-xl text-sm font-bold">Save to quotation items</button>
          </form>
        </details>
      </section>
      <section class="bg-white p-5 rounded-2xl shadow-sm">
        <div class="flex justify-between items-center gap-2 mb-3"><div><h2 class="font-black text-lg">Create quotation</h2><p class="text-xs text-gray-500">Build a proposal for a referred customer.</p></div><button id="qReset" type="button" class="text-xs font-bold bg-gray-100 px-3 py-2 rounded-lg">New</button></div>
        <form id="qForm" class="grid gap-3">
          <div class="grid grid-cols-2 gap-2"><input id="qCustomer" required placeholder="Customer name" class="p-3 bg-gray-50 rounded-xl border text-sm"><input id="qPhone" placeholder="Phone / WhatsApp" class="p-3 bg-gray-50 rounded-xl border text-sm"></div>
          <input id="qEmail" type="email" placeholder="Customer email (optional)" class="p-3 bg-gray-50 rounded-xl border text-sm">
          <div class="grid grid-cols-2 gap-2"><label class="text-xs text-gray-500 font-bold">Issue date<input id="qDate" type="date" required class="block w-full mt-1 p-3 bg-gray-50 rounded-xl border text-sm"></label><label class="text-xs text-gray-500 font-bold">Validity<select id="qValidity" class="block w-full mt-1 p-3 bg-gray-50 rounded-xl border text-sm"><option value="7">7 days</option><option value="14" selected>14 days</option><option value="30">30 days</option><option value="custom">Custom date</option><option value="none">No expiry</option></select></label></div>
          <label id="qExpiryWrap" class="hidden text-xs text-gray-500 font-bold">Custom expiry date<input id="qExpiry" type="date" class="block w-full mt-1 p-3 bg-gray-50 rounded-xl border text-sm"></label>
          <div class="rounded-xl bg-gray-50 p-3"><div class="flex justify-between items-center mb-2"><h3 class="font-black text-sm">Quotation items</h3><button type="button" id="qAddManual" class="text-xs bg-white border px-3 py-2 rounded-lg font-bold">+ Manual item</button></div>
            
            <div id="qLines" class="grid gap-2"></div>
          </div>
          <div class="grid grid-cols-2 gap-2"><label class="text-xs text-gray-500 font-bold">Labour / service charge (₦)<input id="qLabour" type="number" min="0" step="0.01" value="0" class="block w-full mt-1 p-3 bg-gray-50 rounded-xl border text-sm"></label><label class="text-xs text-gray-500 font-bold">Discount (₦)<input id="qDiscount" type="number" min="0" step="0.01" value="0" class="block w-full mt-1 p-3 bg-gray-50 rounded-xl border text-sm"></label></div>
          <textarea id="qNotes" rows="2" placeholder="Notes, delivery terms or other conditions (optional)" class="p-3 bg-gray-50 rounded-xl border text-sm"></textarea>
          <div class="rounded-xl bg-gray-900 text-white p-4"><div class="flex justify-between text-xs text-gray-300"><span>Items subtotal</span><strong id="qSubtotal">₦0</strong></div><div class="flex justify-between text-xs text-gray-300 mt-1"><span>Labour / service</span><strong id="qLabourTotal">₦0</strong></div><div class="flex justify-between text-xs text-gray-300 mt-1"><span>Discount</span><strong id="qDiscountTotal">−₦0</strong></div><div class="flex justify-between items-center border-t border-white/20 mt-3 pt-3"><span class="font-bold">Grand total</span><strong id="qGrand" class="text-xl">₦0</strong></div></div>
          <button id="qSave" class="bg-eazylife text-white p-3 rounded-xl font-bold text-sm">Save quotation</button>
        </form>
        <p id="qMessage" class="text-xs text-teal-700 mt-2" role="status"></p>
      </section>
      <section class="bg-white p-5 rounded-2xl shadow-sm"><h2 class="font-black text-lg mb-3">Saved quotations</h2><div id="qHistory" class="grid gap-2"></div></section>
    </div>
  `;
  document.querySelector('#dashboard .max-w-4xl')?.append(panel);
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
    btn.classList.add('tab-active');
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    panel.classList.remove('hidden');
    loadAll().catch(showError);
  });
  document.getElementById('qProductSelect').addEventListener('change', renderVariantOptions);
  document.getElementById('qAddProduct').addEventListener('click', addSelectedProduct);
  document.getElementById('qCatalogSelect').addEventListener('change', renderCatalogList);
  document.getElementById('qAddCatalog').addEventListener('click', addSelectedCatalogItem);
  document.getElementById('qCatalogForm').addEventListener('submit', saveCatalogItem);
  document.getElementById('qAddManual').addEventListener('click', () => addLine({ name:'', description:'', quantity:1, unitPrice:0, image:'' }));
  document.getElementById('qReset').addEventListener('click', resetForm);
  document.getElementById('qForm').addEventListener('input', calculate);
  document.getElementById('qForm').addEventListener('change', e => {
    if (e.target.id === 'qValidity') {
      document.getElementById('qExpiryWrap').classList.toggle('hidden', e.target.value !== 'custom');
      setExpiryDefault();
    }
    calculate();
  });
  document.getElementById('qForm').addEventListener('submit', saveQuotation);
  document.getElementById('qDate').value = today();
  document.getElementById('qDate').addEventListener('change', setExpiryDefault);
  setExpiryDefault();
}

function showError(error) {
  console.error('Quotation Manager:', error);
  const msg = document.getElementById('qMessage');
  if (msg) msg.textContent = 'Could not complete that action: ' + (error?.message || error);
  else alert('Quotation Manager error: ' + (error?.message || error));
}
function setExpiryDefault() {
  const validity = document.getElementById('qValidity')?.value;
  const issue = document.getElementById('qDate')?.value || today();
  const date = new Date(issue + 'T12:00:00');
  if (validity === 'custom') {
    document.getElementById('qExpiry').min = issue;
    return;
  }
  if (validity === 'none') return;
  date.setDate(date.getDate() + Number(validity || 14));
  document.getElementById('qExpiry').value = date.toISOString().slice(0,10);
}
async function loadAll() {
  const [q,c] = await Promise.all([
    getDocs(query(collection(db, QUOTES), orderBy('updatedAt','desc'))),
    getDocs(query(collection(db, CATALOG), orderBy('name')))
  ]);
  quotations = q.docs.map(d => ({id:d.id,...d.data()}));
  catalogue = c.docs.map(d => ({id:d.id,...d.data()}));
  renderHistory();
  renderCatalogList();
}
function variantLabel(v,i){return [v.color,v.ram,v.rom,v.processor].filter(Boolean).join(' · ')||'Variant '+(i+1);}
function renderVariantOptions(){
 const p=products.find(x=>x.id===document.getElementById('qProductSelect').value),sel=document.getElementById('qVariantSelect'),hint=document.getElementById('qProductHint');
 if(!p){sel.innerHTML='<option value="">Choose product first</option>';sel.disabled=true;hint.textContent=products.length?'Select a product to see its variants.':'No products loaded yet.';return;}
 const vs=p.variants||[];sel.innerHTML=vs.map((v,i)=>{const price=Number(v.promoPrice)>0?Number(v.promoPrice):Number(v.price)||0;return '<option value="'+i+'">'+safe(variantLabel(v,i))+' — '+money(price)+(p.inStock===false||v.inStock===false?' · not marked in stock':'')+'</option>';}).join('')||'<option value="">No variants on this product</option>';
 sel.disabled=!vs.length;hint.textContent=[p.brand,p.category,p.inStock===false?'Product not marked in stock':''].filter(Boolean).join(' · ');
}
async function saveCatalogItem(e){
 e.preventDefault();
 const form=e.currentTarget;
 const item={name:document.getElementById('qcName').value.trim(),description:document.getElementById('qcDescription').value.trim(),brand:document.getElementById('qcBrand').value.trim(),category:document.getElementById('qcCategory').value.trim(),unitPrice:Math.max(0,Number(document.getElementById('qcPrice').value)||0),image:document.getElementById('qcImage').value.trim(),createdAt:serverTimestamp(),updatedAt:serverTimestamp()};
 if(!item.name)return alert('Enter an item name.');
 await addDoc(collection(db,CATALOG),item);
 form.reset();
 document.getElementById('qMessage').textContent='Reusable quotation item saved.';
 await loadAll();
}
function renderCatalogList(){
 const select=document.getElementById('qCatalogSelect'),list=document.getElementById('qCatalogList');
 if(!select||!list)return;
 const current=select.value;
 select.innerHTML='<option value="">Choose a saved quotation item…</option>'+catalogue.map(x=>'<option value="'+safe(x.id)+'">'+safe(x.name)+' — '+money(x.unitPrice)+(x.convertedProductId?' · converted to product':'')+'</option>').join('');
 if(catalogue.some(x=>x.id===current))select.value=current;
 list.innerHTML=catalogue.map(x=>'<div class="border rounded-lg p-2 flex items-center gap-2"><div class="min-w-0 flex-1"><p class="text-xs font-bold">'+safe(x.name)+'</p><p class="text-[10px] text-gray-500">'+money(x.unitPrice)+(x.convertedProductId?' · Product created':' · Quotation only')+'</p></div><button type="button" data-q-convert="'+safe(x.id)+'" class="text-[10px] font-bold text-teal-700">'+(x.convertedProductId?'View product ID':'Convert to product')+'</button></div>').join('')||'<p class="text-[10px] text-gray-400">No reusable items saved yet.</p>';
 list.querySelectorAll('[data-q-convert]').forEach(b=>b.addEventListener('click',()=>convertCatalogItem(b.dataset.qConvert).catch(showError)));
}
function addSelectedCatalogItem(){
 const item=catalogue.find(x=>x.id===document.getElementById('qCatalogSelect').value);
 if(!item)return alert('Choose a saved quotation item first.');
 addLine({name:item.name,description:item.description||'',quantity:1,unitPrice:Number(item.unitPrice)||0,image:item.image||'',source:'quotation-catalogue',catalogueId:item.id});
}
async function convertCatalogItem(id){
 const item=catalogue.find(x=>x.id===id);if(!item)return;
 if(item.convertedProductId){alert('This item has already been converted. Product ID: '+item.convertedProductId);return;}
 if(!confirm('Create this as a new shop product? It will be created hidden / out of stock so you can review it before making it available.'))return;
 const product={name:item.name,brand:item.brand||'',category:item.category||'',desc:item.description||'',inStock:false,variants:[{id:'v'+Date.now(),color:'',processor:'',ram:'',rom:'',price:Number(item.unitPrice)||0,promoPrice:0,image:item.image||'',deliveryFee:null,deliveryRoute:'general',bulkSavingsEnabled:false,bulkSavingsMode:'general',bulkSavingsPercent:0,bulkSavingsMinQty:0,inStock:false}],upgrades:[]};
 const ref=await addProduct(product);
 await updateDoc(doc(db,CATALOG,id),{convertedProductId:ref.id,updatedAt:serverTimestamp()});
 document.getElementById('qMessage').textContent='Product created as hidden / out of stock. Review it in Products before publishing.';
 await loadAll();
}
function renderProductPicker(){
 const sel=document.getElementById('qProductSelect'),old=sel.value;sel.innerHTML='<option value="">Choose a product…</option>'+products.map(p=>'<option value="'+safe(p.id)+'">'+safe(p.name||'Unnamed product')+'</option>').join('');if(products.some(p=>p.id===old))sel.value=old;renderVariantOptions();
}
function addSelectedProduct(){
 const p=products.find(x=>x.id===document.getElementById('qProductSelect').value);if(!p)return alert('Choose a product first.');
 const i=Number(document.getElementById('qVariantSelect').value),v=(p.variants||[])[i];if(!v)return alert('Choose a product variant.');
 const price=Number(v.promoPrice)>0?Number(v.promoPrice):Number(v.price)||0;
 addLine({name:p.name||'Product',description:[p.brand,p.category,variantLabel(v,i),p.desc].filter(Boolean).join(' · '),quantity:1,unitPrice:price,image:v.image?(v.image.startsWith('http://')||v.image.startsWith('https://')?v.image:new URL(v.image,location.href).href):'',productId:p.id,variantId:v.id||'',source:'product'});
}
function addLine(item={}) {
  const id = ++lineCounter;
  const row=document.createElement('div'); row.className='q-line bg-white border rounded-xl p-3 grid gap-2'; row.dataset.lineId=id; row.dataset.productId=item.productId||''; row.dataset.variantId=item.variantId||''; row.dataset.source=item.source||'manual'; row.dataset.catalogueId=item.catalogueId||'';
  row.innerHTML=`<div class="flex justify-between items-center"><strong class="text-xs text-gray-500">Item ${id}</strong><button type="button" class="q-remove text-red-500 text-xs font-bold">Remove</button></div>
  <input data-field="name" required placeholder="Item / component name" value="${safe(item.name)}" class="p-2 border rounded-lg text-sm">
  <textarea data-field="description" rows="1" placeholder="Description (optional)" class="p-2 border rounded-lg text-xs">${safe(item.description)}</textarea>
  <input data-field="image" type="text" placeholder="Image URL (optional)" value="${safe(item.image)}" class="p-2 border rounded-lg text-xs">
  <div class="grid grid-cols-3 gap-2"><input data-field="quantity" type="number" min="1" step="1" value="${Math.max(1,Number(item.quantity)||1)}" class="p-2 border rounded-lg text-xs"><input data-field="unitPrice" type="number" min="0" step="0.01" value="${Number(item.unitPrice)||0}" class="p-2 border rounded-lg text-xs"><div class="flex items-center justify-end text-xs font-black q-line-total">${money((Number(item.quantity)||1)*(Number(item.unitPrice)||0))}</div></div>`;
  row.querySelector('.q-remove').addEventListener('click',()=>{row.remove();calculate();});
  row.addEventListener('input',calculate);
  document.getElementById('qLines').append(row); calculate();
}
function readLines() {
  return [...document.querySelectorAll('.q-line')].map(row => {
    const get = key => row.querySelector('[data-field="'+key+'"]').value;
    return {name:get('name').trim(),description:get('description').trim(),image:get('image').trim(),quantity:Math.max(1,Number(get('quantity'))||1),unitPrice:Math.max(0,Number(get('unitPrice'))||0),productId:row.dataset.productId||'',variantId:row.dataset.variantId||'',source:row.dataset.source||'manual',catalogueId:row.dataset.catalogueId||''};
  }).filter(x=>x.name);
}
function calculate() {
  const rows=[...document.querySelectorAll('.q-line')];
  let subtotal=0;
  rows.forEach(row=>{
    const qty=Math.max(1,Number(row.querySelector('[data-field="quantity"]').value)||1);
    const price=Math.max(0,Number(row.querySelector('[data-field="unitPrice"]').value)||0);
    subtotal+=qty*price; row.querySelector('.q-line-total').textContent=money(qty*price);
  });
  const labour=Math.max(0,Number(document.getElementById('qLabour')?.value)||0);
  const discount=Math.max(0,Number(document.getElementById('qDiscount')?.value)||0);
  document.getElementById('qSubtotal').textContent=money(subtotal);
  document.getElementById('qLabourTotal').textContent=money(labour);
  document.getElementById('qDiscountTotal').textContent='−'+money(discount);
  document.getElementById('qGrand').textContent=money(Math.max(0,subtotal+labour-discount));
}
function expiryDate() {
  const validity=document.getElementById('qValidity').value;
  if (validity==='none') return '';
  if (validity==='custom') return document.getElementById('qExpiry').value;
  const d=new Date(document.getElementById('qDate').value+'T12:00:00'); d.setDate(d.getDate()+Number(validity));
  return d.toISOString().slice(0,10);
}
function makeSnapshot() {
  const items=readLines();
  const subtotal=items.reduce((s,x)=>s+x.quantity*x.unitPrice,0);
  const labour=Math.max(0,Number(document.getElementById('qLabour').value)||0);
  const discount=Math.max(0,Number(document.getElementById('qDiscount').value)||0);
  const date=document.getElementById('qDate').value||today();
  const expiry=expiryDate();
  return {customerName:document.getElementById('qCustomer').value.trim(),phone:document.getElementById('qPhone').value.trim(),email:document.getElementById('qEmail').value.trim(),issueDate:date,validity:document.getElementById('qValidity').value,expiryDate:expiry,items,subtotal,labour,discount,total:Math.max(0,subtotal+labour-discount),notes:document.getElementById('qNotes').value.trim()};
}
async function saveQuotation(e) {
  e.preventDefault();
  const data=makeSnapshot();
  if (!data.items.length) { alert('Add at least one named quotation item.'); return; }
  if (data.validity==='custom' && (!data.expiryDate || data.expiryDate<data.issueDate)) { alert('Choose a valid expiry date on or after the issue date.'); return; }
  const button=document.getElementById('qSave'); button.disabled=true; button.textContent='Saving…';
  try {
    if (editingId) await updateDoc(doc(db,QUOTES,editingId),{...data,updatedAt:serverTimestamp()});
    else {
      const ref=await addDoc(collection(db,QUOTES),{...data,quotationNumber:'EL-'+Date.now().toString().slice(-8),createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      editingId=ref.id;
    }
    document.getElementById('qMessage').textContent='Quotation saved. Product catalogue and inventory were not changed.';
    await loadAll();
  } finally { button.disabled=false; button.textContent='Save quotation'; }
}
function resetForm() {
  editingId=null; document.getElementById('qForm').reset(); document.getElementById('qLines').innerHTML='';
  document.getElementById('qDate').value=today(); document.getElementById('qLabour').value='0'; document.getElementById('qDiscount').value='0';
  document.getElementById('qValidity').value='14'; document.getElementById('qExpiryWrap').classList.add('hidden'); setExpiryDefault(); calculate();
  document.getElementById('qMessage').textContent='New quotation ready.';
}
function loadQuotation(q) {
  editingId=q.id; document.getElementById('qCustomer').value=q.customerName||''; document.getElementById('qPhone').value=q.phone||'';
  document.getElementById('qEmail').value=q.email||''; document.getElementById('qDate').value=q.issueDate||today();
  document.getElementById('qValidity').value=q.validity||'14'; document.getElementById('qExpiryWrap').classList.toggle('hidden',q.validity!=='custom');
  document.getElementById('qExpiry').value=q.expiryDate||''; document.getElementById('qLabour').value=q.labour||0;
  document.getElementById('qDiscount').value=q.discount||0; document.getElementById('qNotes').value=q.notes||'';
  document.getElementById('qLines').innerHTML=''; (q.items||[]).forEach(addLine); calculate();
  document.getElementById('qMessage').textContent='Editing '+(q.quotationNumber||'quotation');
  document.getElementById('qForm').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderHistory() {
  const host=document.getElementById('qHistory');
  host.innerHTML=quotations.map(q=>`<div class="border rounded-xl p-3 grid gap-2"><div class="flex justify-between gap-2"><div><p class="font-black text-sm">${safe(q.customerName||'Unnamed customer')}</p><p class="text-[10px] text-gray-500">${safe(q.quotationNumber||q.id)} · ${safe(q.issueDate||'')}</p></div><strong class="text-sm">${money(q.total)}</strong></div><p class="text-[10px] text-gray-500">${q.expiryDate?'Valid until '+safe(q.expiryDate):'No expiry'} · ${(q.items||[]).length} line(s)</p><div class="flex flex-wrap gap-2"><button data-q-edit="${q.id}" class="text-xs font-bold text-teal-700">Open / edit</button><button data-q-duplicate="${q.id}" class="text-xs font-bold text-gray-600">Duplicate</button><button data-q-pdf="${q.id}" class="text-xs font-bold text-gray-600">PDF / Print</button><button data-q-image="${q.id}" class="text-xs font-bold text-gray-600">Save image</button><button data-q-share="${q.id}" class="text-xs font-bold text-teal-700">Share</button></div></div>`).join('')||'<p class="text-xs text-gray-400">No quotations saved yet.</p>';
  host.querySelectorAll('[data-q-edit]').forEach(b=>b.addEventListener('click',()=>{const q=quotations.find(x=>x.id===b.dataset.qEdit);if(q)loadQuotation(q);}));
  host.querySelectorAll('[data-q-duplicate]').forEach(b=>b.addEventListener('click',()=>{const q=quotations.find(x=>x.id===b.dataset.qDuplicate);if(q){loadQuotation(q);editingId=null;document.getElementById('qMessage').textContent='Duplicate ready — save to create a new quotation.';}}));
  host.querySelectorAll('[data-q-pdf]').forEach(b=>b.addEventListener('click',()=>{const q=quotations.find(x=>x.id===b.dataset.qPdf);if(q)exportQuotation(q,'pdf').catch(showError);}));
  host.querySelectorAll('[data-q-image]').forEach(b=>b.addEventListener('click',()=>{const q=quotations.find(x=>x.id===b.dataset.qImage);if(q)exportQuotation(q,'image').catch(showError);}));
  host.querySelectorAll('[data-q-share]').forEach(b=>b.addEventListener('click',()=>{const q=quotations.find(x=>x.id===b.dataset.qShare);if(q)exportQuotation(q,'share').catch(showError);}));
}
function quotationMarkup(q) {
  const rows=(q.items||[]).map(x=>`<tr><td>${x.image?'<img src="'+safe(x.image)+'" style="width:54px;height:54px;object-fit:cover;border-radius:8px;margin-bottom:5px">':''}<strong>${safe(x.name)}</strong><div style="color:#64748b;font-size:12px">${safe(x.description||'')}</div></td><td style="text-align:center">${x.quantity}</td><td style="text-align:right">${money(x.unitPrice)}</td><td style="text-align:right;font-weight:700">${money(x.quantity*x.unitPrice)}</td></tr>`).join('');
  return `<article class="quotation-paper" style="font-family:Arial,sans-serif;background:#fff;color:#17202a;padding:34px;max-width:850px;margin:0 auto;border:1px solid #e5e7eb">
    <header style="display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:4px solid #00B09B;padding-bottom:18px;margin-bottom:24px">
      <div><img src="${safe(new URL("../assets/pictures/logo_black_transparent.png", location.href).href)}" alt="EazyLife" style="max-width:210px;max-height:75px;object-fit:contain"><p style="font-size:12px;color:#64748b;margin:8px 0 0">Robotics and Electronics Solutions</p><a href="https://eazylife.ng" style="color:#008f80;font-weight:bold;font-size:13px">https://eazylife.ng</a></div>
      <div style="text-align:right"><h1 style="font-size:25px;margin:0;color:#008f80">QUOTATION</h1><p style="font-size:12px;margin:8px 0 3px"><b>No:</b> ${safe(q.quotationNumber||'Draft')}</p><p style="font-size:12px;margin:3px 0"><b>Issued:</b> ${safe(q.issueDate||'')}</p><p style="font-size:12px;margin:3px 0"><b>Valid:</b> ${q.expiryDate?'Until '+safe(q.expiryDate):'No expiry'}</p></div>
    </header>
    <section style="background:#f3faf8;border-radius:10px;padding:14px;margin-bottom:20px"><p style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin:0 0 5px">Prepared for</p><strong style="font-size:16px">${safe(q.customerName)}</strong><p style="font-size:12px;margin:4px 0;color:#475569">${safe(q.phone||'')}${q.email?' · '+safe(q.email):''}</p></section>
    <table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="background:#eff6f5"><th style="text-align:left;padding:11px">Description</th><th style="padding:11px">Qty</th><th style="text-align:right;padding:11px">Unit price</th><th style="text-align:right;padding:11px">Amount</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="width:310px;max-width:100%;margin:22px 0 0 auto;font-size:13px"><div style="display:flex;justify-content:space-between;padding:5px 0"><span>Subtotal</span><b>${money(q.subtotal)}</b></div><div style="display:flex;justify-content:space-between;padding:5px 0"><span>Labour / service</span><b>${money(q.labour)}</b></div><div style="display:flex;justify-content:space-between;padding:5px 0"><span>Discount</span><b>−${money(q.discount)}</b></div><div style="display:flex;justify-content:space-between;border-top:2px solid #00B09B;margin-top:8px;padding:12px 0;font-size:19px;color:#008f80"><b>Total</b><b>${money(q.total)}</b></div></div>
    ${q.notes?'<section style="margin-top:22px;padding:14px;background:#f8fafc;border-radius:8px"><b style="font-size:12px">Notes / Terms</b><p style="font-size:12px;white-space:pre-wrap;color:#475569">'+safe(q.notes)+'</p></section>':''}
    <footer style="border-top:1px solid #e5e7eb;margin-top:32px;padding-top:14px;text-align:center;color:#64748b;font-size:11px"><b style="color:#008f80">EazyLife Robotics and Electronics Solutions</b><br>Thank you for the opportunity to serve you · <a href="https://eazylife.ng" style="color:#008f80">eazylife.ng</a></footer>
  </article>`;
}
async function makeCanvasImagesSafe(root){
 const imgs=[...root.querySelectorAll('img')];
 for(const img of imgs){
  const src=img.src;
  if(!src)continue;
  try{
   if(new URL(src).origin===location.origin){await img.decode().catch(()=>{});continue;}
   const response=await fetch(src,{mode:'cors',credentials:'omit'});
   if(!response.ok)throw new Error('Image unavailable');
   const blob=await response.blob();
   const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});
   img.src=dataUrl;await img.decode();
  }catch(_){
   img.removeAttribute('src');
   img.style.display='none';
  }
 }
}
function showExportAction(message, actionLabel, action) {
 const host=document.getElementById('qMessage');
 host.textContent=message+' ';
 const button=document.createElement('button');
 button.type='button';button.className='ml-1 underline font-bold';button.textContent=actionLabel;
 button.addEventListener('click',action);
 host.append(button);
}
async function canvasBlobForQuotation(q){
 const wrap=document.createElement('div');
 wrap.style.cssText='position:fixed;left:0;top:0;width:900px;background:white;z-index:99999;opacity:0.01;pointer-events:none';
 wrap.innerHTML=quotationMarkup(q);document.body.append(wrap);
 try{
  await makeCanvasImagesSafe(wrap);
  if(!window.html2canvas)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('Image export library could not load.'));document.head.append(script);});
  const canvas=await window.html2canvas(wrap.firstElementChild,{scale:2,backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false});
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create quotation image.')),'image/png'));
 }finally{wrap.remove();}
}
async function exportQuotation(q, mode) {
 if(mode==='pdf'){
  const printWindow=window.open('','_blank');if(!printWindow)throw new Error('Allow pop-ups to print or save the PDF.');
  const html=quotationMarkup(q);
  printWindow.document.write('<!doctype html><html><head><title>'+safe(q.quotationNumber||'EazyLife Quotation')+'</title><style>@page{size:A4;margin:12mm}body{margin:0}.quotation-paper{border:0!important;max-width:none!important;padding:0!important}tr{break-inside:avoid}a{color:#008f80}</style></head><body>'+html+'</body></html>');
  printWindow.document.close();printWindow.onload=()=>{printWindow.focus();printWindow.print();};return;
 }
 const blob=await canvasBlobForQuotation(q);
 const filename=(q.quotationNumber||'EazyLife-Quotation')+'.png';
 const url=URL.createObjectURL(blob);
 if(mode==='share'){
  pendingShareFile=new File([blob],filename,{type:'image/png'});
  showExportAction('Quotation image is ready.','Tap to share',async()=>{
   const file=pendingShareFile;if(!file)return;
   if(!navigator.share){showExportAction('File sharing is not supported by this browser.','Open image',()=>window.open(url,'_blank'));return;}
   try{await navigator.share({files:[file],title:'EazyLife quotation',text:'Quotation '+(q.quotationNumber||'')+' · https://eazylife.ng'});document.getElementById('qMessage').textContent='Share sheet opened.';}
   catch(error){if(error.name!=='AbortError')showError(error);}
  });
 }else{
  showExportAction('Quotation image is ready.','Open image / Save image',()=>{const win=window.open(url,'_blank');if(!win){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Open quotation image';document.getElementById('qMessage').append(a);}});
 }
 setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
}

// Receive the same live product records already loaded by the admin dashboard.
export function setQuotationProducts(items) {
  products = Array.isArray(items) ? items : [];
  renderProductPicker();
  const liveIds = new Set(products.map(p => p.id));
  const stale = catalogue.filter(item => item.convertedProductId && !liveIds.has(item.convertedProductId));
  for (const item of stale) {
    delete item.convertedProductId;
    updateDoc(doc(db,CATALOG,item.id),{convertedProductId:deleteField(),updatedAt:serverTimestamp()})
      .then(() => renderCatalogList()).catch(showError);
  }
  renderCatalogList();
}
