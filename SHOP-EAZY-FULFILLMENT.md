# ShopEazy Fulfillment Operations

Status: implementation completed on `shopeazy-foundation`.

## Purpose

Fulfillment operations record the physical handling of quantities that have already been approved and committed from outlet inventory.

Approval and fulfillment are intentionally separate:

- **Approval** commits stock.
- **Fulfillment** records picking, readiness, dispatch, and delivery.

## State sequence

Each fulfillment group follows exactly:

`APPROVED → PICKING → READY → DISPATCHED → DELIVERED`

The helper rejects skipped, reversed, or repeated transitions.

## API

`advanceShopEazyFulfillmentGroup({ orderId, groupId, nextStatus, actorUid, note })`

The current group state is read inside a Firestore transaction before the transition is committed.

## Quantity controls

Every group item must satisfy:

`quantityFulfilled ≤ quantityApproved ≤ quantityAllocated`

No fulfillment transition is allowed for a group with no approved quantity.

At `DELIVERED`:

`quantityFulfilled = quantityApproved`

This does **not** deduct inventory again. The stock deduction already happened during approval.

## Overall order status

The overall order status is derived from the fulfillment-group states:

- approved groups only → `APPROVED`
- any group `PICKING` or `READY` → `FULFILLING`
- any group `DISPATCHED` → `OUT_FOR_DELIVERY`
- all active groups delivered → `DELIVERED`

A partial order with unresolved unallocated quantity is not allowed to become `DELIVERED` merely because its currently approved groups have been delivered.

## Auditability

Every group transition creates a `shopEazyAudit` record:

`FULFILLMENT_GROUP_STATUS_CHANGED`

The event records:

- order,
- fulfillment group,
- outlet,
- previous status,
- new status,
- approved quantity,
- previously fulfilled quantity,
- actor,
- optional note,
- timestamp.

## Read-only summary

`getShopEazyFulfillmentSummary(orderId)`

returns each group's:

- outlet,
- partner,
- status,
- approved quantity,
- fulfilled quantity,
- remaining quantity,

plus order-level approved and fulfilled totals.

## Production boundary

This step does not:

- connect the admin UI,
- change checkout,
- change legacy product stock,
- change Firestore security rules,
- send delivery/customer notifications,
- create payment records,
- implement cancellation/returns.

It is a controlled data-layer capability.

## Next step

The next layer should be **cancellation and returns**, because the state machine requires different inventory treatment before approval, after approval, after dispatch, and for inspected sellable versus damaged returns.
