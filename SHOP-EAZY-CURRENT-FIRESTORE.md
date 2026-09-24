# ShopEazy Current Firestore Audit

Status: repository audit / planning baseline  
Branch: `shopeazy-foundation`  
Purpose: capture the current application data flow before introducing ShopEazy partner, outlet, inventory-allocation, and richer product-media structures.

## 1. Current architecture

The repository uses vanilla HTML/CSS/JavaScript with Firebase's browser SDK and Firestore. There is no build framework required for the current application.

The shared Firebase module initializes Firestore and Firebase Authentication. The same data layer is used by the storefront and admin application.

## 2. Current product model

Products are stored in the `products` collection.

A product currently contains a `variants` array. The admin product editor supports fields including:
- product name
- brand
- category
- short description (`desc`)
- product-level in-stock flag
- variant ID
- colour
- processor
- RAM
- storage/ROM
- price
- promo price
- image URL
- delivery fee/route
- bulk-savings settings
- variant in-stock flag

Variant inventory-related fields are also used by the inventory module:
- `stockQty`
- `reorderLevel`
- `costPrice`
- `sku`

### Product media limitation

The current product editor stores one `image` value per variant. There is no dedicated product media/gallery structure yet.

Therefore the ShopEazy plan should introduce a proper multi-image model without throwing away the existing variant image field during the foundation stage.

## 3. Current inventory model

Inventory is currently embedded in each product's variant.

The admin inventory module changes `stockQty` transactionally inside the parent product document. It also creates an `inventoryMovements` document recording the change, including product/variant identifiers, SKU, quantity, previous quantity, new quantity, reason, reference, and timestamp.

This is a single-stock-pool model. It does not identify which partner outlet owns or holds a particular quantity.

## 4. Current order creation

The storefront creates an order in the `orders` collection using a generated tracking code as the document ID.

New orders currently receive:
- `status: "new"`
- `inventoryApplied: false`
- `inventoryReturned: false`
- `createdAt`

Order items are resolved to a product variant ID before saving if the customer selection did not already contain one. The saved order therefore has a product/variant relationship suitable for future outlet allocation.

The current order creation path does **not** deduct inventory.

## 5. Current order inventory lifecycle

The existing order status logic applies inventory transactionally when an order moves into a confirmed/shipped/delivered status and inventory has not already been applied.

It restores inventory when a previously inventory-applied order moves to a cancellation/return state and inventory has not already been restored.

The transaction reads and validates all affected products before performing writes, so a multi-item inventory change is intended to be all-or-nothing.

### ShopEazy implication

The existing status-based deduction point is close to the desired ShopEazy rule, but it is not yet the exact business workflow we have chosen.

ShopEazy's rule is:

> **Customer submits order → order remains pending/new → admin allocates quantities across outlets → admin approves → stock is deducted from the approved outlet allocations.**

The future implementation should not simply rename the current `confirmed` status. It should explicitly model approval and outlet allocation so the transaction deducts from the correct outlet stock.

## 6. Current cancellation/return behavior

The current cancellation path can restore stock when inventory was previously applied. Inventory movements are marked as sale or return.

For ShopEazy, cancellation and returns must eventually be outlet-aware. A return should know which outlet's stock is being restored and whether the physical item was actually received back.

## 7. Current admin order workflow

The admin order interface currently exposes a simple status flow:
`new → confirmed → delivered`

It also supports rejection/cancellation and customer messaging.

This is sufficient for the current single-stock-pool model but does not yet represent:
- multiple outlet allocations
- partial allocation
- outlet-specific stock availability
- approval as a distinct business action
- separate fulfillment progress per outlet
- split delivery groups

These should be added only after the target order/fulfillment model is finalized.

## 8. Current Firestore access model

The current rules allow public product reads and public order creation/get-by-document-ID, while administrative writes are generally protected by an `isAdmin()` check based on the authenticated user's email.

Inventory movements and several operational collections are admin-only.

This access model must be treated as part of the eventual ShopEazy security work. Partner-specific access should not be implemented as a client-side UI restriction.

No security rules should be changed during this audit stage.

## 9. Current pricing and delivery model

Pricing and delivery calculations are separated into `js/pricing.mjs`.

Variant pricing can include normal and promotional prices. The current system also supports delivery-fee configuration and bulk-savings behavior.

For ShopEazy, delivery pricing must eventually account for the possibility that one order is fulfilled by multiple outlets. That decision should be made before replacing the existing delivery calculation.

## 10. Current admin product media workflow

The admin product editor has an image URL field and an image picker/preview mechanism. Product listing thumbnails currently use the first variant's image.

There is no current first-class concept of:
- product gallery
- primary image
- image order
- image captions/alt text
- variant-specific gallery membership
- image upload lifecycle

The target ShopEazy product experience should add these concepts deliberately.

## 11. Target changes implied by the ShopEazy decisions

The current audit establishes these boundaries:

### Keep
- Existing `products` collection as the starting catalog foundation.
- Existing variant IDs and rich variant attributes.
- Existing order IDs/tracking codes where possible.
- Existing inventory movement history.
- Existing transactional patterns as a safety reference.
- Existing pricing module as a reusable calculation layer.

### Introduce later
- partners
- outlets
- outlet-level inventory
- outlet-aware inventory movements
- order-item outlet allocations / fulfillment groups
- explicit admin approval state/action
- richer product information fields
- product media/gallery records
- role-aware security rules

### Do not do yet
- Do not migrate live stock.
- Do not delete the existing `stockQty` fields.
- Do not change production Firestore rules.
- Do not rewrite checkout.
- Do not build a seller/commission/payout system.
- Do not redesign the entire storefront before the data model is approved.

## 12. Next design stage

The next document/work item should define the concrete target Firestore schema for:

1. `partners`
2. `outlets`
3. outlet-level inventory
4. outlet-aware inventory movements
5. order-item outlet allocations / fulfillment groups
6. admin approval and stock-deduction state
7. product media/gallery
8. richer product specifications

Only after that schema is reviewed should we create new Firestore collections or modify application behavior.

No production Firestore data or security rules were changed by this audit.
