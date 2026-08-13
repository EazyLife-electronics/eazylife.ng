// admin/js/payments-ui.mjs
//
// Payment UI is rendered exclusively by payments.mjs.
// This compatibility module intentionally does not render anything. The previous
// implementation created a second payment panel alongside payments.mjs, which
// caused duplicate CLOSED/UNPAID sections and could multiply during DOM updates.
// Keep the exported initializer so any older importer remains harmless.

export function initPaymentsUI() {
  return () => {};
}
