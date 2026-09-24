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
- One customer order may be split across multiple outlets; the order model must preserve one customer order while recording the outlet allocation for each fulfilled portion.
- Stock is deducted when an administrator approves the order, not when the customer first submits it.
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

When fulfillment is outlet-based, record outlet allocation at the order-item level (or as explicit fulfillment groups) so one customer order can be split across multiple outlets. Keep each allocated quantity tied to its order item, variant, and outlet; the sum of allocated quantities must equal the item quantity when fully assigned. Track fulfillment status separately per outlet group if dispatch and delivery can progress independently.

## 3A. Product information and media experience

ShopEazy should treat product presentation as part of the catalog design, not merely a storefront styling task.

### Product information

A product should support richer customer-facing information than the current short description alone. The target catalog should be able to represent:
- product name, brand, category, and subcategory
- short summary and full description
- key features/highlights
- structured specifications where useful (for example dimensions, material, compatibility, processor, RAM, storage, battery, or other category-specific attributes)
- variant-specific attributes such as colour, configuration, storage, and RAM
- SKU and pricing information
- availability information supplied by the inventory system

Descriptive catalog information should remain separate from outlet stock quantities.

### Multiple product images

The target product model should support a gallery rather than a single image URL. At minimum, the media model should support:
- a primary/cover image
- multiple additional gallery images
- explicit image ordering
- optional alt text/caption
- optional association of an image with a particular variant when variant-specific photography is needed

Do not force every product to have variant-specific images; shared product gallery images remain valid.

### Customer image viewer

The product page should support:
- thumbnail/gallery navigation
- changing the main image by tapping a thumbnail
- full-screen viewing
- pinch-to-zoom on touch devices
- zoom controls and pan on larger screens
- swipe navigation between gallery images on mobile

Large images should be loaded efficiently so the experience remains practical on slower mobile connections. Use appropriately sized/compressed images and lazy-load non-primary gallery images where practical.

### Admin media management

The admin product editor should eventually allow authorized staff to add, remove, reorder, and designate the primary product image, with optional variant association and alt text. The media workflow should be designed alongside the eventual Firebase Storage/security model rather than storing an uncontrolled collection of arbitrary external URLs.

This richer presentation layer must not change the existing live storefront until the catalog/data design is approved.

## 4. Important design decisions still open

Resolve these before implementation:
1. What happens if an admin approves only part of an order, or one outlet cannot supply its assigned quantity?
2. What happens to stock if an approved order is later cancelled, expires, or is returned?
3. Does admin approval happen before or after payment, and can an order be approved in stages?
4. Who can create partners/outlets and adjust their inventory?
5. Is cost price common to a variant, or can it differ by partner/outlet?
6. How are delivery fees calculated when an order is split across outlets?
7. Which existing products and orders belong to ShopEazy versus the existing EazyLife storefront?

## 5. Migration and rollout principles

1. **No destructive changes.** Do not delete or rename current collections or fields during the foundation stage.
2. **Map before migrating.** Inventory all current product, variant, order, and movement fields and document the current transaction flow.
3. **Keep checkout stable.** Do not alter order submission or stock deduction until the new data model and rollback plan are reviewed. Submitted orders should not decrement stock; admin approval is the planned stock-deduction point.
4. **Introduce outlet inventory in parallel.** If approved, seed and validate the new outlet-level records before switching any live stock reads/writes.
5. **Reconcile totals.** Compare per-variant legacy stock against the sum of outlet quantities before cutover; investigate every mismatch.
6. **Protect access.** Define role-based access for administrators and partner staff before exposing partner-specific data. Do not rely on a client-side UI check as the security boundary.
7. **Test failure paths.** Include concurrent orders, insufficient stock, duplicate submissions, cancellation, return, and interrupted sessions.
8. **Use a reversible cutover.** Keep a documented backup/export and a clear way to restore the previous behavior until the new workflow is proven.

## 6. Suggested implementation sequence

- Phase A — document current Firestore schemas and order/inventory transaction paths.
- Phase B — resolve the remaining approval, partial-allocation, cancellation/return, access, cost, and split-delivery decisions above.
- Phase C — add partner and outlet records plus access rules in a test environment.
- Phase D — add outlet inventory and movement records; validate with sample data.
- Phase E — adapt admin inventory tools and fulfillment selection behind a controlled feature flag.
- Phase F — test end-to-end and reconcile stock, then plan a deliberate production cutover.

No production Firestore data, security rules, or storefront behavior has been changed as part of creating this document.
