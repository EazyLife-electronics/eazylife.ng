// admin/js/settings-ui.mjs
// Restores the Settings panel markup before admin-app.mjs registers its handlers.
// The dashboard logic already owns loading/saving the values; this module only
// supplies the DOM it expects.

if (typeof document !== 'undefined' &&
    (location.pathname.endsWith('/admin/') || location.pathname.endsWith('/admin/index.html'))) {
  const panel = document.getElementById('panel-settings');
  if (panel && !document.getElementById('settingsForm')) {
    const host = document.getElementById('settingsContent') || panel;
    host.innerHTML = `
      <div class="bg-white p-6 rounded-[24px] shadow-sm">
        <h2 class="font-black text-lg mb-1">Site Settings</h2>
        <p class="text-xs text-gray-400 mb-5">Control the general shop, delivery, referral and bulk-savings settings.</p>
        <form id="settingsForm" class="space-y-3">
          <div>
            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">WhatsApp number</label>
            <input id="s_whatsapp" placeholder="e.g. 2348051234567" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]">
          </div>
          <div>
            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">Shop tagline</label>
            <input id="s_tagline" placeholder="Short tagline shown around the shop" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]">
          </div>
          <div>
            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">About / Philosophy Text</label>
            <textarea id="s_about" rows="4" placeholder="Describe Eazylife engineering, services and values" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]"></textarea>
          </div>
          <label class="flex items-center gap-2 text-xs font-bold text-gray-600 px-1">
            <input type="checkbox" id="s_referralMode">
            Legacy referral mode (retained for compatibility)
          </label>
          <p class="text-[10px] text-gray-400 -mt-2 px-1">This older setting is retained for existing records and no longer changes the current homepage service descriptions.</p>
          <div class="grid grid-cols-2 gap-3>
            <div>
              <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">Delivery fee / item (₦)</label>
              <input id="s_deliveryFee" type="number" min="0" step="1" placeholder="750" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]">
            </div>
            <div>
              <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">Delivery discount (%)</label>
              <input id="s_deliveryDiscount" type="number" min="0" max="100" step="0.1" placeholder="10" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]">
            </div>
          </div>
          <div class="bg-gray-50 rounded-xl border border-gray-200 p-3">
            <h3 class="text-xs font-black uppercase text-gray-500 mb-1">Bulk savings</h3>
            <p class="text-[10px] text-gray-400 mb-3">Used by variants that inherit the general bulk-savings rule.</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">Discount (%)</label>
                <input id="s_bulkSavingsPercent" type="number" min="0" max="100" step="0.1" placeholder="e.g. 5" class="w-full p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]">
              </div>
              <div>
                <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">Minimum quantity</label>
                <input id="s_bulkSavingsMinQty" type="number" min="0" step="1" placeholder="e.g. 5" class="w-full p-3 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]">
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 pt-1">
            <button type="submit" class="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold text-sm">Save Settings</button>
            <span id="settingsMsg" class="hidden text-[11px] font-bold text-[#00B09B]">Saved</span>
          </div>
        </form>
      </div>`;
  }

  const nav = document.querySelector('.flex.gap-2.mb-6.overflow-x-auto');
  if (nav && !document.querySelector('[data-tab="receivables"]')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.tab = 'receivables';
    btn.className = 'tab-btn px-5 py-2 rounded-full text-xs font-bold bg-gray-100';
    btn.textContent = 'Receivables';
    nav.insertBefore(btn, document.querySelector('[data-tab="settings"]'));

    const receivablesPanel = document.createElement('div');
    receivablesPanel.id = 'panel-receivables';
    receivablesPanel.className = 'tab-panel hidden';
    receivablesPanel.innerHTML = '<div id="receivablesContent"></div>';
    const settingsPanel = document.getElementById('panel-settings');
    settingsPanel?.parentElement?.insertBefore(receivablesPanel, settingsPanel);

    import('./receivables.mjs').then(({ initReceivables }) => {
      import('./receivables-payments.mjs').then(({ initReceivablesPayments }) => {
        btn.addEventListener('click', async () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
          btn.classList.add('tab-active');
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
          receivablesPanel.classList.remove('hidden');

          await initReceivables();
          await initReceivablesPayments();
        });
      }).catch(err => {
        console.error('Receivables payment module failed to load:', err);
        btn.addEventListener('click', async () => {
          document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
          btn.classList.add('tab-active');
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
          receivablesPanel.classList.remove('hidden');
          await initReceivables();
        });
      });
    }).catch(err => {
      console.error('Receivables module failed to load:', err);
      btn.addEventListener('click', () => {
        receivablesPanel.classList.remove('hidden');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p !== receivablesPanel));
        document.querySelectorAll('.tab-btn').forEach(p => p.classList.toggle('tab-active', p === btn));
        document.getElementById('receivablesContent').innerHTML = `<div class="bg-white rounded-[24px] p-6 text-sm text-red-600">Receivables failed to load: ${String(err.message || err)}</div>`;
      });
    });
  }
}

// Place the visual symbol painter directly inside the Circuit Components tab.
// It stays part of the normal admin workflow instead of appearing as a separate dashboard destination.
const componentPanel=document.getElementById('panel-circuit-components');
if(componentPanel&&!document.getElementById('clPainterLaunchCard')){
  const launch=document.createElement('section');
  launch.id='clPainterLaunchCard';
  launch.className='rounded-3xl border border-teal-100 bg-gradient-to-r from-teal-50 to-lime-50 p-4 sm:p-5 mb-5';
  launch.innerHTML='<div class="flex flex-wrap items-center justify-between gap-3"><div class="min-w-0"><h2 class="font-black text-base text-gray-900">Visual Component Painter</h2><p class="text-xs text-gray-600 mt-1">Draw and edit component symbols with familiar shapes, lines, curves and pin tools. No SVG or JSON hand-coding.</p></div><button type="button" id="clOpenPainter" class="shrink-0 rounded-xl bg-teal-700 text-white px-4 py-3 text-xs font-black shadow-sm"><i class="fas fa-paintbrush mr-2"></i>Open Painter</button></div><div id="clPainterFrameWrap" class="hidden mt-4"><div class="flex items-center justify-between gap-2 mb-2"><p class="text-[11px] text-gray-500">Painter workspace · save your symbol, then close this workspace to return to the component library.</p><button type="button" id="clClosePainter" class="rounded-lg border bg-white px-3 py-2 text-xs font-bold text-gray-700">Close Painter</button></div><iframe id="clPainterFrame" title="Visual Component Painter" src="./circuit-component-painter.html" class="w-full rounded-2xl border border-gray-200 bg-white" style="height:min(82vh,1000px);min-height:640px" loading="lazy"></iframe></div>';
  componentPanel.prepend(launch);
  const frameWrap=document.getElementById('clPainterFrameWrap');
  document.getElementById('clOpenPainter').addEventListener('click',()=>{frameWrap.classList.remove('hidden');document.getElementById('clOpenPainter').classList.add('hidden');frameWrap.scrollIntoView({behavior:'smooth',block:'start'});});
  document.getElementById('clClosePainter').addEventListener('click',()=>{frameWrap.classList.add('hidden');document.getElementById('clOpenPainter').classList.remove('hidden');});
}

// Circuit Studio shared symbol library, authored once and reused by every diagram.
if (typeof document !== 'undefined' &&
    (location.pathname.endsWith('/admin/') || location.pathname.endsWith('/admin/index.html'))) {
  const nav=document.querySelector('.flex.gap-2.mb-6.overflow-x-auto');
  if(nav&&!document.querySelector('[data-tab="circuit-components"]')){
    const btn=document.createElement('button');
    btn.type='button';btn.dataset.tab='circuit-components';
    btn.className='tab-btn px-5 py-2 rounded-full text-xs font-bold bg-gray-100';
    btn.textContent='Circuit Components';
    nav.insertBefore(btn,document.querySelector('[data-tab="settings"]'));
    const panel=document.createElement('div');
    panel.id='panel-circuit-components';panel.className='tab-panel hidden';
    panel.innerHTML='<div class="bg-white rounded-3xl p-5 shadow-sm mb-5"><div class="flex flex-wrap justify-between gap-3 items-center mb-4"><div><h2 class="font-black text-lg">Persistent circuit symbol library</h2><p class="text-xs text-gray-500">Create, edit shared artwork and pin coordinates, import/export, publish or delete.</p></div><button id="clNew" class="rounded-xl bg-gray-900 text-white px-4 py-2 text-xs font-bold">+ New symbol</button></div><div class="flex flex-wrap gap-2 mb-3"><button id="clSeed" class="rounded-xl bg-teal-700 text-white px-3 py-2 text-xs font-bold">Import starter library</button><button id="clExport" class="rounded-xl border px-3 py-2 text-xs font-bold">Export JSON</button><label class="rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer">Import JSON<input id="clImportFile" type="file" accept=".json,application/json" hidden></label><input id="clSearch" placeholder="Search library…" class="flex-1 min-w-[130px] border rounded-xl p-2 text-xs"><span id="clTotal" class="text-xs text-gray-500 self-center"></span></div><div id="clList" class="max-h-[440px] overflow-auto"></div></div><div class="bg-white rounded-3xl p-5 shadow-sm"><h3 id="clFormTitle" class="font-black text-lg mb-4">Create component</h3><form id="clForm" class="space-y-3"><div class="grid sm:grid-cols-2 gap-3"><label class="text-xs font-bold">Stable ID<input id="clId" required class="mt-1 w-full border rounded-xl p-3 text-sm" placeholder="e.g. custom-sensor"></label><label class="text-xs font-bold">Component name<input id="clName" required class="mt-1 w-full border rounded-xl p-3 text-sm"></label><label class="text-xs font-bold">Category<input id="clCategory" class="mt-1 w-full border rounded-xl p-3 text-sm" value="Other"></label><label class="text-xs font-bold">Reference prefix<input id="clDesignator" class="mt-1 w-full border rounded-xl p-3 text-sm" value="U"></label><label class="text-xs font-bold">Status<select id="clStatus" class="mt-1 w-full border rounded-xl p-3 text-sm"><option value="draft">Draft, private</option><option value="published">Published to public editor</option></select></label></div><label class="text-xs font-bold block">SVG artwork<textarea id="clArtwork" rows="7" spellcheck="false" class="mt-1 w-full border rounded-xl p-3 font-mono text-xs"></textarea></label><div class="grid md:grid-cols-2 gap-4"><div><div class="flex justify-between items-center mb-2"><strong class="text-xs">Shared connection pins</strong><button id="clAddPin" type="button" class="text-xs rounded-lg bg-teal-700 text-white px-3 py-2">+ Pin</button></div><div id="clPinRows"></div><details class="mt-2"><summary class="text-xs text-gray-500 cursor-pointer">Advanced pin JSON</summary><textarea id="clPinsJson" rows="8" class="mt-2 w-full border rounded-xl p-3 font-mono text-xs"></textarea></details></div><div><strong class="text-xs block mb-2">Drag pin markers to change shared coordinates</strong><svg id="clPinPreview" viewBox="-100 -80 200 160" class="w-full h-56 border rounded-xl touch-none" style="color:#172b28;background:#f7faf9"></svg><p class="text-[10px] text-gray-500 mt-2">Artwork and pin definitions are independent. Keep existing pin IDs stable so saved wire endpoints remain meaningful.</p></div></div><div class="flex flex-wrap gap-2"><button class="rounded-xl bg-gray-900 text-white px-5 py-3 text-sm font-bold" type="submit">Save component</button><span id="clMsg" class="self-center text-xs" role="status"></span></div></form></div>';
    document.getElementById('panel-settings')?.parentElement?.insertBefore(panel,document.getElementById('panel-settings'));
    btn.addEventListener('click',()=>{document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('tab-active'));btn.classList.add('tab-active');document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));panel.classList.remove('hidden');});
    import('./circuit-components-admin.mjs').catch(err=>console.error('Circuit component admin failed:',err));
  }
}

// Order workflow UI is loaded here so we can enhance the existing Orders panel
// without changing the stable admin-app renderer.
import('./order-workflow-ui.mjs').catch(err => console.error('Order workflow UI failed to load:', err));

// Payment UI is loaded explicitly once. It observes the Orders list and enhances
// each order card, while payments-ui.mjs itself guards against duplicate roots.
if (typeof document !== 'undefined' &&
    (location.pathname.endsWith('/admin/') || location.pathname.endsWith('/admin/index.html'))) {
  import('../../js/firebase.mjs').then(({ initFirebase }) => {
    const { db } = initFirebase();
    return import('./payments-ui.mjs').then(({ initPaymentsUI }) => initPaymentsUI(db));
  }).catch(err => console.error('Order payment UI failed to load:', err));
}
