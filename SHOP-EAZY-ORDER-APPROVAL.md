# ShopEazy Atomic Order Approval

Status: implementation completed on `shopeazy-foundation`.

## Purpose

ShopEazy approval is the point where allocated outlet stock becomes committed.

The implementation in `js/store.mjs` uses one Firestore transaction to atomically:

1. re-read the order,
2. re-read all fulfillment groups,
3. validate outlet eligibility,
4. derive allocation from Firestore,
5. re-read every affected outlet-inventory record,
6. verify stock,
7. deduct stock,
8. create sale movement records,
9. mark fulfillment groups approved,
10. create an audit record,
11. update the order approval state.

If any required stock check fails, the entire transaction aborts.

## API

`approveShopEazyOrder({ orderId, actorUid, approvalMode, resolutionPath, resolutionNote })`

### Full approval

`approvalMode: "FULL"`

Every order item must be completely allocated.

For example:

- ordered: 5
- Outlet A allocation: 3
- Outlet B allocation: 2

All 5 units are approved and deducted atomically.

If even one unit remains unallocated, full approval is rejected.

### Partial approval

`approvalMode: "PARTIAL"`

All currently allocated quantities are approved and deducted.

Any unallocated quantity remains explicit and receives a required resolution path:

- `WAIT_FOR_STOCK`
- `CUSTOMER_ACCEPTED`
- `SUBSTITUTION`
- `CANCEL_REMAINDER`

The original requested quantity is never silently reduced.

## Idempotency

Approval rejects an order when:

`inventoryApplied === true`

It also rejects orders that are no longer approval-eligible.

Therefore a repeated button click cannot intentionally perform a second inventory deduction.

Firestore's transaction retry behavior is separate from business-level approval idempotency.

## Concurrency

Every affected inventory document is read inside the transaction before inventory writes.

Consequently, if two orders compete for the same outlet stock, Firestore transaction conflict handling prevents both transactions from successfully committing stale stock calculations.

No inventory quantity is allowed to become negative.

## Inventory movement

Each approved allocation creates an append-only `inventoryMovements` record with:

- product ID
- variant ID
- SKU
- outlet ID
- partner ID
- movement type `sale`
- quantity change
- previous quantity
- new quantity
- order reference
- fulfillment group reference
- approving actor
- timestamp

## Fulfillment groups

Approved group items receive:

`quantityApproved = quantityAllocated`

and:

`quantityFulfilled = 0`

Approved groups move to:

`APPROVED`

Unallocated quantities remain outside the approved fulfillment groups.

## Audit

Every successful approval creates a `shopEazyAudit` event:

`ORDER_APPROVED`

It records the approval mode, ordered/approved/unallocated totals, resolution path where applicable, actor, and timestamp.

## Safety boundary

This implementation does **not**:

- connect approval to the existing admin UI,
- alter the existing checkout,
- automatically create ShopEazy fulfillment groups for old orders,
- migrate legacy stock,
- change legacy product `stockQty`,
- change Firestore security rules,
- send customer notifications,
- call external delivery/payment services.

The transaction is therefore available as a controlled data-layer capability without changing current production workflows.

## Important implementation note

The current order structure predates ShopEazy and does not contain a persisted order-item ID. The allocation layer therefore uses a deterministic reference such as `item-0`, `item-1`, etc. The original order document is not rewritten just to introduce those IDs.

A future migration can add persisted order-item IDs once the ShopEazy order path is ready.

## Next step

The next layer should be **controlled reassignment**:

approved quantity at Outlet A → restore Outlet A stock → deduct Outlet B stock → move the approved quantity → write transfer movements → write audit event.

That must also be one atomic transaction and must reject reassignment once the affected quantity has entered fulfillment.
