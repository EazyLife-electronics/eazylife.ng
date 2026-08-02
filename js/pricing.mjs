// js/pricing.mjs
// Shared pricing logic — kept separate from the Firestore data layer so it can be reused
// anywhere (shop cart, future bulk-pricing promos, etc).

/**
 * Cascading/compounding discount: each additional unit adds its full fee, then the
 * WHOLE running total takes another discount hit — not just a flat % off the sum.
 * This makes earlier units get discounted multiple times over as the count grows,
 * so the average cost per item keeps dropping the more someone buys.
 *
 * Example with perUnitFee=750, rate=0.10:
 *   1 item:  750
 *   2 items: (750+750) * 0.90            = 1350
 *   3 items: (1350+750) * 0.90           = 1890
 *   4 items: (1890+750) * 0.90           = 2376
 *
 * @param {number} perUnitFee - base fee for a single unit
 * @param {number} count - total number of units
 * @param {number} rate - discount rate per additional unit, e.g. 0.10 for 10%
 */
export function calcCascadingFee(perUnitFee, count, rate) {
  if (!perUnitFee || count <= 0) return 0;
  let total = perUnitFee;
  for (let i = 1; i < count; i++) {
    total = (total + perUnitFee) * (1 - rate);
  }
  return Math.round(total);
}

/** The effective price for a variant, accounting for a promo price if set. */
export function variantUnitPrice(variant) {
  if (!variant) return 0;
  return variant.promoPrice > 0 ? variant.promoPrice : (variant.price || 0);
}

/** Lowest and highest effective price across a product's variants, for "From ₦X" display. */
export function productPriceRange(product) {
  const prices = (product.variants || []).map(variantUnitPrice).filter(p => p > 0);
  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** A short readable label for a variant, e.g. "Space Grey · 16GB / 512GB". */
export function variantLabel(variant) {
  const parts = [variant.color, [variant.ram, variant.rom].filter(Boolean).join(' / ')].filter(Boolean);
  return parts.join(' · ') || 'Standard';
}
