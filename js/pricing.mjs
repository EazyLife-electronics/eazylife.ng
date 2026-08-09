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

/**
 * Same cascading logic as calcCascadingFee, but for a cart where different units can carry
 * different per-unit delivery fees (a product/variant can override the general fee, or
 * inherit it). Units are processed in the order given — first unit is its own fee with no
 * discount yet, every unit after that adds its own fee then the running total is discounted.
 *
 * @param {number[]} unitFees - one entry per physical unit in the cart, in cart order
 * @param {number} rate - discount rate per additional unit, e.g. 0.10 for 10%
 */
export function calcCascadingFeeMixed(unitFees, rate) {
  if (!unitFees || unitFees.length === 0) return 0;
  let total = unitFees[0] || 0;
  for (let i = 1; i < unitFees.length; i++) {
    total = (total + (unitFees[i] || 0)) * (1 - rate);
  }
  return Math.round(total);
}

/** A variant's own delivery fee if it overrides the general one, else the general fee. */
export function resolveDeliveryFee(variant, generalFeePerItem) {
  return (variant && variant.deliveryFee != null && variant.deliveryFee !== '')
    ? variant.deliveryFee
    : generalFeePerItem;
}

/**
 * Groups delivery fee calculation: units on the "general route" all pool together and
 * cascade as one stack (so prodX and prodY both on general, ₦750 each, combine their
 * quantities into one compounding discount). A variant marked as its own separate route
 * cascades only against its own quantity, isolated from everything else, and that group's
 * total is simply added on top — it doesn't get cheaper just because the general pool is big,
 * and the general pool doesn't get cheaper because of it either.
 *
 * A variant with no fee override (deliveryFee == null) is always on the general route, using
 * the general fee amount. A variant WITH a custom fee only joins the general pool if its
 * route is explicitly set to 'general' — otherwise, even a custom fee that happens to match
 * the general amount stays in its own isolated group.
 *
 * @param {Array<{quantity:number, unitDeliveryFee:number|null, deliveryRoute:'general'|'separate', productId:string, variantId:string}>} cartLines
 * @param {number} generalFeePerItem
 * @param {number} rate
 */
export function calcGroupedDeliveryFee(cartLines, generalFeePerItem, rate) {
  const generalUnits = [];
  const separateGroups = new Map(); // "productId::variantId" -> [fee, fee, ...]

  (cartLines || []).forEach(line => {
    const fee = line.unitDeliveryFee != null ? line.unitDeliveryFee : generalFeePerItem;
    const isGeneral = line.unitDeliveryFee == null || line.deliveryRoute !== 'separate';
    if (isGeneral) {
      for (let i = 0; i < line.quantity; i++) generalUnits.push(fee);
    } else {
      const key = `${line.productId}::${line.variantId}`;
      if (!separateGroups.has(key)) separateGroups.set(key, []);
      const arr = separateGroups.get(key);
      for (let i = 0; i < line.quantity; i++) arr.push(fee);
    }
  });

  let total = calcCascadingFeeMixed(generalUnits, rate);
  for (const fees of separateGroups.values()) {
    total += calcCascadingFeeMixed(fees, rate);
  }
  return total;
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
