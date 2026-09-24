# ShopEazy Target Firestore Schema

Status: design blueprint — business decisions locked for implementation planning  
Branch: `shopeazy-foundation`

This schema is the proposed target model for ShopEazy. It is intentionally designed to coexist with the current EazyLife data until migration and application changes are separately approved.

## 1. Design principles

- ShopEazy is one managed retail business, not a seller marketplace.
- Products describe what is sold; outlets describe where stock is held.
- A partner can operate one or more outlets and supply inventory.
- One customer order may be fulfilled by multiple outlets.
- Customer submission creates an order but does not deduct or reserve stock.
- Admin can approve the overall order while the system records separate outlet fulfillment groups.
- Partial fulfillment is supported when the requested quantity cannot be fully supplied.
- Approved allocations are committed immediately: approval atomically deducts stock from the approved outlet allocations.
- Before fulfillment begins, an administrator may reassign approved quantities between outlets, with an audit trail.
- Split-order delivery is calculated per fulfillment group internally but can be presented as one consolidated customer delivery charge where appropriate.
- Partners are not independent sellers; the role model supports partner/outlet staff without creating seller storefronts.
- Cost price is product/variant-level initially rather than outlet-specific.
- Existing EazyLife records remain intact; ShopEazy relationships are introduced selectively.
- Historical order information must remain stable even if catalog data changes later.
- Inventory changes must remain auditable.
- Product media is a first-class catalog concern.
- Security rules must enforce roles server-side; UI visibility is not security.

## 2. Locked business decisions

### 2.1 Approval model — hybrid

Admin uses a single overall order approval action, while the data model records individual fulfillment groups.

Example:

- Outlet A → 3 units
- Outlet B → 2 units
- Approve Order

This keeps the customer/order workflow simple while preserving outlet-level fulfillment information.

### 2.2 Partial fulfillment — supported

If an order cannot be fully allocated, ShopEazy may:
- approve a partial quantity,
- hold the order for replenishment,
- offer a substitution,
- or cancel/reject as appropriate.

The system must explicitly record what quantity was requested versus what was allocated, approved, and fulfilled.

### 2.3 Reassignment — controlled

An approved allocation may be reassigned before fulfillment/delivery begins.

Every reassignment should be auditable, including:
- actor
- timestamp
- original outlet
- new outlet
- quantity moved
- reason

The implementation must prevent allocations from exceeding ordered quantities and must preserve stock integrity during reassignment.

### 2.4 Delivery — hybrid

Delivery may be calculated internally per fulfillment group, but ShopEazy may present one consolidated customer delivery charge where appropriate.

The delivery model must remain flexible enough for:
- different outlet locations,
- same-route consolidation,
- pickup,
- multiple delivery legs,
- future delivery-zone rules.

### 2.5 Staff roles — full role hierarchy supported

The data model should support:

ShopEazy Admin  
→ Partner Manager / Partner Staff  
→ Outlet Staff

However, access should be introduced incrementally. The first implementation does not need to expose every role or dashboard.

### 2.6 Cost price — product/variant level initially

Use the product variant's cost price as the initial cost basis.

Do not make cost price outlet-specific yet.

The inventory movement structure should still allow a future transition to partner/outlet-specific cost or batch costing without redesigning order history.

### 2.7 Existing data — selective ShopEazy integration

Do not assume that every existing EazyLife catalog/order/inventory record belongs to ShopEazy.

Existing data remains intact.

ShopEazy-specific partner, outlet, inventory, fulfillment, and catalog relationships are introduced selectively. Migration must explicitly identify which records are ShopEazy records.

### 2.8 Inventory commitment — approval immediately deducts stock

There is no customer-side reservation.

Workflow:

Customer submits  
→ no stock change  
→ admin reviews  
→ admin allocates  
→ admin approves  
→ transaction verifies stock and deducts it immediately  
→ fulfillment proceeds

This means an approved allocation is an actual inventory commitment, not merely a temporary reservation.

### 2.9 Product media — full media system

ShopEazy should eventually support:

- multiple product pictures
- primary/cover image
- ordered gallery
- variant-specific images where appropriate
- Firebase Storage-backed media
- image upload/remove/reorder in admin
- alt text and captions
- full-screen image viewing
- mobile pinch-to-zoom
- desktop zoom/pan
- mobile swipe navigation
- lazy loading
- appropriate compression/thumbnails for mobile performance

Media should remain a first-class catalog structure rather than a single image URL embedded in inventory.

### 2.10 Product information — rich retail catalogue

Products should support:

- basic product information
- brand
- category/subcategory
- short and detailed descriptions
- highlights
- specifications
- variants
- rich variant attributes
- product gallery/media
- delivery information
- search/filter metadata

### 2.11 Fulfillment groups — subcollection

Use:

`orders/{orderId}/fulfillmentGroups/{groupId}`

rather than relying only on a large embedded array inside the order.

This allows each outlet fulfillment group to have its own lifecycle, delivery information, audit history, and future operational permissions.

## 3. Products

**Collection:** `products/{productId}`

Keep the existing product document as the catalog foundation.

Suggested product-level fields:
- `name`
- `brand`
- `category`
- `subcategory`
- `shortDescription`
- `description`
- `highlights[]`
- `specifications{}`
- `active`
- `createdAt`
- `updatedAt`

Keep the existing `variants[]` structure initially so current catalog data and code are not unnecessarily broken.

A future normalization of variants into their own collection can be considered only if catalog scale or query requirements justify it.

## 4. Product media

**Recommended collection:** `productMedia/{mediaId}`

Suggested fields:
- `productId`
- `variantId` — optional; null/absent means shared product image
- `storagePath`
- `downloadUrl` or generated storage reference
- `altText`
- `caption`
- `sortOrder`
- `isPrimary`
- `active`
- `createdAt`
- `updatedAt`

One product can therefore have many images, while an image can optionally belong to a specific variant.

The media record should point to Firebase Storage rather than embedding large image data inside Firestore documents.

The frontend media viewer should support full-screen viewing, mobile pinch-to-zoom, swipe navigation, desktop zoom/pan, and efficient loading.

## 5. Partners

**Collection:** `partners/{partnerId}`

Suggested fields:
- `name`
- `status`: pending | active | paused | inactive
- `contact{}`
- `notes`
- `createdAt`
- `updatedAt`

Partner records represent ShopEazy's supply/outlet relationships. They do not create independent storefronts.

## 6. Outlets

**Collection:** `outlets/{outletId}`

Suggested fields:
- `partnerId`
- `name`
- `status)
- `address{}`
- `serviceAreas[]`
- `fulfillmentEnabled`
- `operatingHours{}`
- `createdAt`
- `updatedAt`

A partner may have multiple outlets.

## 7. Outlet inventory

**Collection:** `outletInventory/{inventoryId}`

One record represents one product variant at one outlet.

Suggested fields:
- `productId`
- `variantId`
- `outletId`
- `partnerId`
- `quantityOnHand`
- `reorderLevel`
- `costPrice`
- `active`
- `createdAt`
- `updatedAt`

`quantityReserved` is not required for the initial workflow because customer submission does not reserve stock and admin approval immediately commits/deducts stock.

The unique logical key should be:

`outletId + variantId`

This prevents two independent inventory records from accidentally representing the same variant at the same outlet.

Cost price is initially inherited from the product/variant cost basis rather than being treated as a distinct outlet-specific pricing system.

## 8. Inventory movements

**Collection:** `inventoryMovements/{movementId}`

Suggested fields:
- `productId`
- `variantId`
- `outletId`
- `partnerId`
- `movementType`: receipt | sale | return | correction | transferIn | transferOut
- `quantityChange`
- `previousQuantity`
- `newQuantity`
- `referenceType`
- `referenceId`
- `reason`
- `actorUid`
- `createdAt`

A sale caused by admin approval should reference the order/fulfillment allocation that caused it.

An outlet transfer should create a transfer-out movement and a corresponding transfer-in movement.

Reassignment of an already-approved allocation must also be represented by auditable inventory/order events so stock cannot silently move between outlets.

## 9. Orders

**Collection:** `orders/{orderId}`

Keep the current tracking-code-based order identity where practical.

Suggested target fields:
- `trackingCode`
- `customer{}`
- `status`
- `approvalStatus`
- `items[]`
- `totals{}`
- `delivery{}`
- `inventoryApplied`
- `inventoryReturned`
- `createdAt`
- `approvedAt`
- `approvedBy`
- `updatedAt`

The order document represents the overall customer order. Outlet-specific operational state belongs in fulfillment groups.

Recommended status concepts:
- `new`
- `processing`
- `approved`
- `partiallyFulfillable`
- `fulfilled`
- `cancelled`
- `returned`

Do not automatically implement every status above; the final state machine should be defined before coding.

## 10. Order items

Each order item should retain both stable references and historical snapshots.

Suggested fields:
- `productId`
- `variantId`
- `sku`
- `nameSnapshot`
- `variantSnapshot{}`
- `unitPrice`
- `quantity`
- `lineTotal`
- `mediaSnapshot` — optional primary image reference for historical display

The snapshots protect old orders from later catalog edits.

## 11. Fulfillment groups / outlet allocations

Because one order may be split across outlets, the order needs an explicit allocation layer.

**Recommended subcollection:**

`orders/{orderId}/fulfillmentGroups/{groupId}`

Suggested fields:
- `outletId`
- `partnerId`
- `status`
- `items[]`
- `delivery{}`
- `createdAt`
- `updatedAt`

Each group item should contain:
- `orderItemIndex` or stable `orderItemId`
- `productId`
- `variantId`
- `quantityAllocated`
- `quantityApproved`
- `quantityFulfilled`

Example:

Order item:
- iPhone variant — quantity 5

Allocation:
- Outlet A — quantity 3
- Outlet B — quantity 2

The allocation totals must never exceed the customer's ordered quantity.

Partial allocation is valid. The system must distinguish:
- ordered quantity
- allocated quantity
- approved quantity
- fulfilled quantity
- unallocated quantity

## 12. Admin approval and stock deduction

The critical ShopEazy transaction is:

1. Customer submits order.
2. Order is stored with no stock deduction and no reservation.
3. Admin reviews available outlet inventory.
4. Admin allocates quantities to one or more outlets.
5. Admin approves the order.
6. A Firestore transaction verifies that every approved outlet quantity still exists.
7. The transaction deducts stock from every affected `outletInventory` record.
8. Corresponding `inventoryMovements` records are written.
9. Order approval/inventory state is updated atomically.

If any required outlet quantity is unavailable at approval time, the transaction must fail without partially deducting other outlets.

This is especially important when two administrators could approve orders against the same stock at nearly the same time.

### Partial fulfillment

The approval workflow must also support orders that cannot be fully allocated.

Example:

Customer requests 5.

Available:
- Outlet A: 3
- Outlet B: 1

Admin may allocate/approve 4 and leave 1 unallocated, subject to the selected customer-resolution path.

The system must not silently change the requested quantity.

### Controlled reassignment

If an approved order has not yet entered fulfillment/delivery, an administrator may move approved quantity from one outlet to another.

Reassignment must:
- verify the destination outlet has the required stock,
- maintain the total approved quantity,
- update affected fulfillment groups,
- create appropriate audit/inventory events,
- record who made the change and why.

The exact transaction semantics for reassignment must be implemented together with the approval transaction so stock is never double-counted.

## 13. Cancellation and returns

After stock has been deducted, cancellation/return must not simply add stock back blindly.

The future workflow should determine:
- whether the item has physically returned
- which outlet receives the returned item
- whether returned stock is sellable
- whether damaged/returned stock needs a separate disposition

The resulting stock movement should reference the original sale/fulfillment event.

Because ShopEazy may split an order across outlets, cancellation and return handling must identify the relevant fulfillment group and physical outlet.

## 14. Pricing and delivery

Keep pricing calculations in the existing pricing module.

The target model should allow delivery to be calculated per fulfillment group when an order is split across outlets.

For the initial business model:
- delivery may be calculated separately per fulfillment group internally,
- the customer may receive one consolidated delivery charge where the delivery situation permits,
- the system must retain enough detail to support multiple delivery legs later.

Do not duplicate pricing logic inside inventory records.

## 15. Security / roles

The target model supports a full role hierarchy:

- ShopEazy administrator
- partner manager
- partner staff
- outlet staff

Recommended eventual collections:
- `admins/{uid}`
- `partnerUsers/{uid}`
- optionally `outletUsers/{uid}` if outlet-level identity needs to be distinct

Partner/outlet users should only access records they are authorized to manage.

Rules should verify authenticated UID and role/relationship, rather than trusting an email string supplied by the client.

No rules should be changed as part of this schema document.

## 16. Migration strategy

Do not immediately replace the current variant `stockQty`.

Instead:

**Stage 1:** create the new collections in parallel.

**Stage 2:** identify which existing catalog/order records are ShopEazy records and which remain EazyLife records.

**Stage 3:** create partners and outlets for the ShopEazy records.

**Stage 4:** map each ShopEazy variant's existing stock to one or more outlet inventory records.

**Stage 5:** reconcile:

`legacy variant stockQty = sum of ShopEazy outlet quantityOnHand`

for every migrated variant.

**Stage 6:** test outlet-aware order approval against test data, including split fulfillment, partial allocation, concurrent approvals, and reassignment.

**Stage 7:** switch inventory reads/writes behind a controlled feature flag.

**Stage 8:** retain the legacy field until the new workflow has been proven and a rollback window has passed.

No destructive migration should occur until the separation between EazyLife and ShopEazy data is explicitly confirmed.

## 17. What we deliberately are NOT building

- No independent seller storefronts.
- No seller commission engine.
- No seller payout system.
- No public partner dashboards by default.
- No payment gateway requirement at this stage.
- No destructive migration.
- No immediate production security-rule rewrite.
- No unnecessary outlet-specific cost accounting at launch.
- No complete frontend redesign before the data layer is validated.

## 18. Implementation sequence

The controlled implementation sequence is now:

1. Finalize/verify this target schema.
2. Define the exact order/approval state machine.
3. Define the Firestore transaction shapes for approval and reassignment.
4. Introduce ShopEazy partner/outlet records without disturbing existing EazyLife data.
5. Introduce outlet inventory alongside legacy `stockQty`.
6. Add outlet-aware fulfillment groups.
7. Implement admin allocation and approval transactionally.
8. Add controlled partial-fulfillment handling.
9. Add controlled reassignment with audit history.
10. Introduce the rich product media system.
11. Expand product information fields.
12. Add role-based access incrementally.
13. Validate with test orders and reconciliation before enabling production behavior.

This document is a blueprint only. No Firestore collections or production data are changed by updating it.
