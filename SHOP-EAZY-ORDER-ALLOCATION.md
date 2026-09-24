# ShopEazy Order Allocation & Fulfillment Groups

Status: implementation step completed — allocation data layer only.

## Purpose

This step connects an existing ShopEazy order to one or more outlets through:

`orders/{orderId}/fulfillmentGroups/{groupId}`

Allocation is a **planning operation**. It does not reserve or deduct inventory.

Stock is committed only by the separately designed atomic approval transaction.

## Group structure

A fulfillment group contains:

```
{
  outletId,
  partnerId,
  status,
  items: [],
  delivery,
  createdAt,
  updatedAt
}
```

Each group item contains stable order-item information:

```
{
  orderItemId,
  orderItemIndex,
  productId,
  variantId,
  sku,
  nameSnapshot,
  variantSnapshot,
  quantityAllocated,
  quantityApproved,
  quantityFulfilled
}
```

For compatibility with existing orders, the initial stable item identifier is derived as:

`item-0`, `item-1`, `item-2`, etc.

A future order migration can introduce a persisted order-item ID without changing the allocation concept.

## Implemented API

In `js/store.mjs`:

- `getShopEazyFulfillmentGroups()`
- `createShopEazyFulfillmentGroup()`
- `allocateShopEazyOrderItem()`
- `getShopEazyOrderAllocationSummary()`

## Allocation invariant

For every order item:

`orderedQuantity = allocatedQuantity + unallocatedQuantity`

and:

`approvedQuantity <= allocatedQuantity <= orderedQuantity`

Fulfilled quantity is separately constrained by:

`fulfilledQuantity <= approvedQuantity`

The allocation helper rejects attempts to exceed the ordered quantity.

## Example

An order requests 5 units.

Admin can allocate:

- Outlet A → 3
- Outlet B → 2

The order remains a single customer order, while the fulfillment groups identify where each quantity will be fulfilled.

If only 4 units can currently be allocated:

- Outlet A → 3
- Outlet B → 1
- Unallocated → 1

The missing unit remains explicit. It is not silently removed from the order.

## Protection of committed quantities

Once an item has approved or fulfilled quantity, ordinary allocation editing is rejected.

Committed quantities must use the dedicated controlled reassignment transaction, which restores source stock and deducts destination stock atomically.

## Safety boundary

This step does **not**:

- deduct stock
- reserve stock
- approve orders
- change existing order status behavior
- modify existing product stock
- create live ShopEazy order groups automatically
- change Firestore security rules

## Next step

The next implementation layer is the **ShopEazy approval transaction**.

That will connect:

`order allocation → outletInventory → atomic stock deduction → inventory movement → approval state`

with the all-or-nothing concurrency behavior already specified in `SHOP-EAZY-FIRESTORE-TRANSACTIONS.md`.
