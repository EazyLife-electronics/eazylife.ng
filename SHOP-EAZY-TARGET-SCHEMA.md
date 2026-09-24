# ShopEazy Target Firestore Schema

Status: design blueprint — not a migration script  
Branch: `shopeazy-foundation`

This schema is the proposed target model for ShopEazy. It is intentionally designed to coexist with the current EazyLife data until migration and application changes are separately approved.

## 1. Design principles

- ShopEazy is one managed retail business, not a seller marketplace.
- Products describe what is sold; outlets describe where stock is held.
- A partner can operate one or more outlets and supply inventory.
- One customer order may be fulfilled by multiple outlets.
- Customer submission creates an order but does not deduct stock.
- An administrator allocates order quantities to outlets and explicitly approves the order.
- Approval deducts stock from the approved outlet allocations in a transaction.
- Historical order information must remain stable even if catalog data changes later.
- Inventory changes must remain auditable.
- Product media is a first-class catalog concern.
- Security rules must enforce roles server-side; UI visibility is not security.

## 2. Products

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

A future normalization of variants into their own collection can be considered only if the catalog scale or query requirements justify it.

## 3. Product media

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

## 4. Partners

**Collection:** `partners/{partnerId}`

Suggested fields:
- `name`
- `status`: pending | active | paused | inactive
- `contact{}`
- `notes`
- `createdAt`
- `updatedAt`

Partner records represent ShopEazy's supply/outlet relationships. They do not create independent storefronts.

## 5. Outlets

**Collection:** `outlets/{outletId}`

Suggested fields:
- `partnerId`
- `name`
- `status`: active | paused | inactive
- `address{}`
- `serviceAreas[]`
- `fulfillmentEnabled`
- `operatingHours{}`
- `createdAt`
- `updatedAt`

A partner may have multiple outlets.

## 6. Outlet inventory

**Collection:** `outletInventory/{inventoryId}`

One record represents one product variant at one outlet.

Suggested fields:
- `productId`
- `variantId`
- `outletId`
- `partnerId`
- `quantityOnHand`
- `quantityReserved` — only when a reservation workflow is later approved
- `reorderLevel`
- `costPrice`
- `active`
- `createdAt`
- `updatedAt`

For the initial ShopEazy workflow, `quantityReserved` can remain 0 or be omitted because customer submission does not reserve stock.

The unique logical key should be:

`outletId + variantId`

This prevents two independent inventory records from accidentally representing the same variant at the same outlet.

## 7. Inventory movements

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

## 8. Orders

**Collection:** `orders/{orderId}`

Keep the current tracking-code-based order identity where practical.

Suggested target fields:
- `trackingCode`
- `customer{}`
- `status`
- `approvalStatus`
- `items[]`
- `fulfillmentGroups[]`
- `totals{}`
- `delivery{}`
- `inventoryApplied`
- `inventoryReturned`
- `createdAt`
- `approvedAt`
- `approvedBy`
- `updatedAt`

Recommended status concepts:
- `new`
- `processing`
- `approved`
- `partiallyFulfillable`
- `fulfilled`
- `cancelled`
- `returned`

Do not automatically implement every status above; the final state machine should be defined before coding.

## 9. Order items

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

## 10. Fulfillment groups / outlet allocations

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

## 11. Admin approval and stock deduction

The critical ShopEazy transaction is:

1. Customer submits order.
2. Order is stored with no stock deduction.
3. Admin reviews available outlet inventory.
4. Admin allocates quantities to one or more outlets.
5. Admin approves the allocation.
6. A Firestore transaction verifies the required quantities still exist.
7. The transaction deducts stock from every affected `outletInventory` record.
8. Corresponding `inventoryMovements` records are written.
9. Order approval/inventory state is updated atomically.

If any required outlet quantity is unavailable at approval time, the transaction must fail without partially deducting other outlets.

This is especially important when two administrators could approve orders against the same stock at nearly the same time.

## 12. Cancellation and returns

After stock has been deducted, cancellation/return must not simply add stock back blindly.

The future workflow should determine:
- whether the item has physically returned
- which outlet receives the returned item
- whether returned stock is sellable
- whether damaged/returned stock needs a separate disposition

The resulting stock movement should reference the original sale/fulfillment event.

## 13. Pricing and delivery

Keep pricing calculations in the existing pricing module.

The target model should allow delivery to be calculated per fulfillment group when an order is split across outlets.

Before implementation, decide whether ShopEazy charges:
- one consolidated delivery fee,
- the sum of outlet-specific delivery fees,
- or a capped/combined fee.

Do not duplicate pricing logic inside inventory records.

## 14. Security / roles

A future role model should distinguish at least:
- ShopEazy administrator
- partner staff
- outlet-level staff

Partner/outlet users should only access the records they are authorized to manage.

Recommended eventual pattern:
- `admins/{uid}`
- `partnerUsers/{uid}`

Rules should verify authenticated UID and role/relationship, rather than trusting an email string supplied by the client.

No rules should be changed as part of this schema document.

## 15. Migration strategy

Do not immediately replace the current variant `stockQty`.

Instead:

**Stage 1:** create the new collections in parallel.

**Stage 2:** create partners and outlets.

**Stage 3:** map each variant's existing stock to one or more outlet inventory records.

**Stage 4:** reconcile:

`legacy variant stockQty = sum of outlet quantityOnHand`

for every migrated variant.

**Stage 5:** test outlet-aware order approval against test data.

**Stage 6:** switch inventory reads/writes behind a controlled feature flag.

**Stage 7:** retain the legacy field until the new workflow has been proven and a rollback window has passed.

## 16. What we deliberately are NOT building

- No independent seller storefronts.
- No seller commission engine.
- No seller payout system.
- No public partner dashboards by default.
- No payment gateway requirement at this stage.
- No destructive migration.
- No immediate production security-rule rewrite.
- No complete frontend redesign before the data layer is validated.

## 17. Remaining decisions before implementation

1. What exactly constitutes admin approval: whole order only, or can an admin approve individual fulfillment groups?
2. What should happen when an order cannot be fully allocated?
3. Should an approved order be allowed to have a later outlet reassignment?
4. What is the delivery-fee rule for split orders?
5. What roles should partner/outlet staff have?
6. Should cost price vary by outlet/partner?
7. Which existing catalog/order records belong to ShopEazy versus the existing EazyLife business?

This document is a blueprint only. No Firestore collections or production data are changed by creating it.
