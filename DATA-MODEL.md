# ShopEazy Data Model

Status: planning document  
Branch: `shopeazy-foundation`  
Purpose: document the existing EazyLife data structures and the proposed ShopEazy direction before changing live data or checkout behavior.

> This is a design note, not a migration script. Do not rename, move, or delete existing Firestore collections based on this document alone.

## 1. Business rules

ShopEazy starts as one managed-retail business with a unified customer catalog.

- ShopEazy owns the customer-facing shopping experience and order process.
- Partner shops provide inventory and may provide physical outlets or fulfillment points.
- Partners are not independent marketplace sellers in the first version: no seller-owned storefront, commission engine, or payout ledger is assumed.
- A product can have multiple variants (for example, different storage, RAM, color, or configuration).
- Inventory availability must be tracked per outlet when outlet-level stock is introduced.
- Existing EazyLife electronics data and workflows must remain intact until a reviewed migration is approved.

## 2. Existing system (observed in the repository)

The current application is a lightweight HTML/CSS/JavaScript storefront backed by Firebase/Firestore.

- Product documents live in the `products` collection and contain variants.
- Variant records currently include fields such as SKU, stock quantity, reorder level, and cost price.
- The admin inventory module updates variant stock in the product document and records inventory movement entries.
- Order creation/status handling includes transactional inventory adjustments and reversal logic.
- Pricing and promotions are handled separately in `js/pricing.mjs`.

The current variant stock field is effectively a single-stock-pool model. It does not by itself represent separate quantities at multiple partner outlets.

## 3. Proposed logical model for ShopEazy

These are conceptual records. Exact Firestore paths, required fields, indexes, and rules should be finalized only after reviewing the full order lifecycle and access needs.

### Products and variants

Keep the existing product/variant structure as the catalog foundation. A variant identifies the sellable configuration (such as a particular model, color, or storage option).

Catalog data should describe what the item is. Outlet inventory should describe where units are held and how many are available. Avoid duplicating descriptive product fields into every outlet stock record.

### Partners

A partner represents a shop or business that supplies stock and/or operates one or more outlets.

Suggested partner attributes:
- `name`
- `status` (for example, pending, active, paused)
- contact and operational details, with access limited to authorized staff
- timestamps for creation and updates

Partner records do not imply that partners can administer the entire ShopEazy catalog or customer orders.

### Outlets

An outlet is a physical stock-holding or fulfillment location, associated with a partner.

Suggested outlet attributes:
- `partnerId`
- `name`
- address and service-area information
- `status`
- optional fulfillment capabilities and operating details

A partner may have more than one outlet. An outlet belongs to one partner unless a future business requirement explicitly changes that rule.

### Outlet inventory

Represent each stock position as a relationship between a product variant and an outlet, rather than storing one global quantity on the variant.

Conceptual fields:
- `productId`
- `variantId`
- `outletId`
- `quantityOnHand`
- `quantityReserved` (only if the reservation workflow is implemented)
- `reorderLevel`
- `costPrice` (if cost is outlet- or partner-specific)
- timestamps and an active/inactive status if needed

Available quantity, when reservations are used, is derived as on-hand minus reserved. Do not introduce reservations until order placement, cancellation, expiry, and payment rules are specified.

### Inventory movements

Keep an auditable movement history. Each movement should identify:
- product and variant
- outlet (once outlet-level inventory is active)
- quantity change and movement type (receipt, correction, sale, return, transfer, etc.)
- related order or reference where applicable
- actor and timestamp
- optional note/reason

A transfer between outlets should be represented as linked stock-out and stock-in movements, not as an unexplained quantity overwrite.

### Orders and order items

Preserve the existing order contract until the current checkout, fulfillment, cancellation, and reversal paths have been fully mapped.

For the target model, each order item should retain a stable reference to its product and variant, plus a snapshot of the customer-facing name, selected options, unit selling price, quantity, and line total at the time of purchase. Historical orders must not change when a catalog title or price is later edited.

When fulfillment is outlet-based, record the chosen outlet against the relevant order item or fulfillment group. The precise shape depends on whether one customer order can be split across outlets.

## 4. Important design decisions still open

Resolve these before implementation:
1. Can one customer order be fulfilled by more than one outlet, or must the full order come from one outlet?
2. When is stock deducted or reserved: order submission, payment confirmation, or manual approval?
3. What happens to stock when an order is cancelled, expires, or is returned?
4. Who can create partners/outlets and adjust their inventory?
5. Is cost price common to a variant, or can it differ by partner/outlet?
6. How are delivery fees calculated when the dispatch outlet changes?
7. Which existing products and orders belong to ShopEazy versus the existing EazyLife storefront?

## 5. Migration and rollout principles

1. **No destructive changes.** Do not delete or rename current collections or fields during the foundation stage.
2. **Map before migrating.** Inventory all current product, variant, order, and movement fields and document the current transaction flow.
3. **Keep checkout stable.** Do not alter order submission or stock deduction until the new data model and rollback plan are reviewed.
4. **Introduce outlet inventory in parallel.** If approved, seed and validate the new outlet-level records before switching any live stock reads/writes.
5. **Reconcile totals.** Compare per-variant legacy stock against the sum of outlet quantities before cutover; investigate every mismatch.
6. **Protect access.** Define role-based access for administrators and partner staff before exposing partner-specific data. Do not rely on a client-side UI check as the security boundary.
7. **Test failure paths.** Include concurrent orders, insufficient stock, duplicate submissions, cancellation, return, and interrupted sessions.
8. **Use a reversible cutover.** Keep a documented backup/export and a clear way to restore the previous behavior until the new workflow is proven.

## 6. Suggested implementation sequence

- Phase A — document current Firestore schemas and order/inventory transaction paths.
- Phase B — confirm the open business decisions above.
- Phase C — add partner and outlet records plus access rules in a test environment.
- Phase D — add outlet inventory and movement records; validate with sample data.
- Phase E — adapt admin inventory tools and fulfillment selection behind a controlled feature flag.
- Phase F — test end-to-end and reconcile stock, then plan a deliberate production cutover.

No production Firestore data, security rules, or storefront behavior has been changed as part of creating this document.
