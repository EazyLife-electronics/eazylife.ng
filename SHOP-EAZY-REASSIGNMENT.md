# ShopEazy Controlled Reassignment

Status: implementation completed on `shopeazy-foundation`.

## Purpose

Controlled reassignment moves an already-approved, still-unfulfilled quantity from one outlet to another before fulfillment begins.

It is not a new sale and does not change the customer's approved quantity.

The operation is atomic:

`source stock + quantity → destination stock - quantity → move fulfillment commitment`

## API

`reassignShopEazyOrderQuantity({ orderId, sourceGroupId, destinationGroupId, destinationOutletId, orderItemId, quantity, actorUid, reason })`

A destination may be an existing fulfillment group or a new group identified by `destinationOutletId`.

A reason is required for the audit trail.

## Preconditions

The transaction verifies:

- order exists and inventory has already been committed,
- order is not cancelled or returned,
- source group exists,
- source group has not entered fulfillment,
- source item has enough approved but unfulfilled quantity,
- destination outlet exists and is active/fulfillment-enabled,
- destination group, when supplied, has not entered fulfillment,
- both source and destination inventory records exist,
- destination has enough stock,
- source and destination are different inventory records,
- product and variant references match,
- the order-level approved quantity does not exceed ordered quantity.

Only the approved-but-unfulfilled quantity can be moved.

## Atomic inventory change

Example:

```
Outlet A stock: 8
Outlet B stock: 5
Move: 2

A: 8 → 10
B: 5 → 3
```

The source stock is restored because the sale commitment is being removed from that outlet.

The destination stock is deducted because the same commitment is being placed there.

There is therefore no second customer sale and no change in total physical stock caused by the reassignment itself.

## Fulfillment allocation

Example before:

```
Outlet A: approved 3
Outlet B: approved 2
Total:    approved 5
```

Move 1 from A to B:

```
Outlet A: approved 2
Outlet B: approved 3
Total:    approved 5
```

The source and destination group items are updated in the same transaction.

## Inventory movements

Two auditable movement records are created:

- source: `transferIn`
- destination: `transferOut`

Both reference:

- order,
- source outlet,
- destination outlet,
- product/variant,
- quantity,
- actor,
- reason,
- timestamp.

## Audit

A `shopEazyAudit` event is created with:

`ORDER_ALLOCATION_REASSIGNED`

It preserves the source group, destination group, outlets, order item, quantity, reason, actor, and timestamp.

## Concurrency and safety

All affected order, fulfillment-group, outlet, and inventory documents are read inside the Firestore transaction before writes occur.

If another stock operation changes the destination stock concurrently, Firestore transaction conflict handling prevents the reassignment from committing against stale inventory.

## Fulfillment restriction

Reassignment is rejected once the source group reaches:

- `PICKING`
- `READY`
- `DISPATCHED`
- `DELIVERED`
- `CANCELLED`
- `RETURNED`

This preserves the rule that reassignment is an operational change before fulfillment begins.

## Production boundary

This implementation does not:

- connect the admin UI,
- change checkout,
- migrate existing stock,
- change legacy `products.stockQty`,
- change Firestore rules,
- send customer notifications,
- call delivery/payment APIs.

It is currently a data-layer capability only.

## Next step

Before connecting the admin workflow, the next controlled layer should be **ShopEazy fulfillment operations**: progressing approved fulfillment groups through `PICKING → READY → DISPATCHED → DELIVERED`, with quantity limits and auditability.
