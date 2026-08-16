// admin/js/admin-settings.mjs
// Settings tab: general shop, delivery, referral, and bulk-savings settings.
// Split out of admin-app.mjs.

import { getSettings, saveSettings } from '../../js/store.mjs';

export async function loadSettingsForm() {
  const settings = await getSettings();
  document.getElementById('s_whatsapp').value = settings.whatsapp || '';
  document.getElementById('s_tagline').value = settings.tagline || '';
  document.getElementById('s_about').value = settings.aboutText || '';
  document.getElementById('s_referralMode').checked = settings.referralMode !== false; // defaults to true
  document.getElementById('s_deliveryFee').value = settings.deliveryFeePerItem ?? 750;
  document.getElementById('s_deliveryDiscount').value = settings.deliveryDiscountPercent ?? 10;
  document.getElementById('s_bulkSavingsPercent').value = settings.bulkSavingsPercent ?? '';
  document.getElementById('s_bulkSavingsMinQty').value = settings.bulkSavingsMinQty ?? '';
}

export function initSettings() {
  document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await saveSettings({
      whatsapp: document.getElementById('s_whatsapp').value.trim(),
      tagline: document.getElementById('s_tagline').value.trim(),
      aboutText: document.getElementById('s_about').value.trim(),
      referralMode: document.getElementById('s_referralMode').checked,
      deliveryFeePerItem: parseInt(document.getElementById('s_deliveryFee').value, 10) || 0,
      deliveryDiscountPercent: parseFloat(document.getElementById('s_deliveryDiscount').value) || 0,
      bulkSavingsPercent: parseFloat(document.getElementById('s_bulkSavingsPercent').value) || 0,
      bulkSavingsMinQty: parseInt(document.getElementById('s_bulkSavingsMinQty').value, 10) || 0
    });
    const msg = document.getElementById('settingsMsg');
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2500);
  });
}
