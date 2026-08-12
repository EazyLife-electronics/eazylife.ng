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
            <label class="block text-[10px] font-black uppercase text-gray-400 mb-1">About text</label>
            <textarea id="s_about" rows="4" placeholder="Short description about EazyLife" class="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-[#00B09B]"></textarea>
          </div>
          <label class="flex items-center gap-2 text-xs font-bold text-gray-600 px-1">
            <input type="checkbox" id="s_referralMode">
            Enable referral mode
          </label>
          <div class="grid grid-cols-2 gap-3">
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
}
