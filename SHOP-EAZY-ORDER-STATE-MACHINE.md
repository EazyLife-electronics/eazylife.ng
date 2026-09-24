# ShopEazy Order State Machine

Status: locked design specification  
Branch: `shopeazy-foundation`

## Purpose

This document defines the operational state model for ShopEazy before implementation begins. It separates the overall customer order lifecycle, approval/stock commitment, and outlet fulfillment lifecycle.

## 1. Three state dimensions

### Overall order status

`NEW → PROCESSING → APPROVED → FULFILLING → OUT_FOR_DELIVERY → DELIVERED`

Exceptional terminal/side states:

- `CANCELLED`
- `RETURN_REQUESTED`
- `RETURNED`

### Approval status

- `NOT_REVIEWED`
- `UNDER_REVIEW`
- `READY`
- `PARTIAL`
- `APPROVED`
- `REJECTED`

### Fulfillment-group status

- `UNALLOCATED`
- `ALLOCATED`
- `APPROVED`
- `PICKING`
- `READY`
- `DISPATCHED`
- `DELIVERED`
- `CANCELLED`
- `RETURNED`

## 2. Core workflow

### A. Customer submission

- Create the order.
- Set overall status to `NEW`.
- Set approval status to `NOT_REVIEWED`.
- Do not deduct stock.
- Do not reserve stock.

### B. Admin review

- Move overall status to `PROCESSING`.
- Move approval status to `UNDER_REVIEW`.
- Inspect current outlet inventory.
- Build one or more fulfillment groups.

### C. Allocation

For every order item:

`ordered = allocated + unallocated`

And:

`approved ≤ allocated ≤ ordered`

Allocation itself does not change stock.

### D. Ready for approval

Use `READY` when the allocation is valid for the intended approval action.

A partial order may be marked `PARTIAL` instead when only part of the requested quantity can currently be committed.

### E. Approve Order

The admin uses one overall action.

One Firestore transaction must:

1. re-read all affected outlet inventory,
2. verify stock,
3. verify order/approval eligibility,
4. verify allocation invariants,
5. deduct every approved outlet quantity,
6. create inventory movement records,
7. mark affected fulfillment groups `APPROVED`,
8. update the order approval/inventory fields,
9. record actor and timestamp.

If any stock check fails, the transaction fails as a whole. No partial outlet deduction is allowed.

### F. Full approval

- Approval status becomes `APPROVED`.
- Overall order status becomes `APPROVED`.
- Approved groups proceed to fulfillment.

### G. Partial approval

- Approval status becomes `PARTIAL`.
- Only approved quantities are deducted.
- Unallocated quantities remain explicit.
- The remaining quantity follows one of the allowed resolution paths:
  - wait for replenishment,
  - customer accepts partial,
  - substitution,
  - cancellation/rejection of remaining quantity.

Never silently reduce the original requested quantity.

## 3. Fulfillment

Each outlet group progresses independently:

`APPROVED → PICKING → READY → DISPATCHED → DELIVERED`

The overall order reflects the combined group state.

An order may therefore be internally split while remaining one customer order.

## 4. Reassignment

Approved quantities may be reassigned only before fulfillment/delivery begins.

The reassignment transaction must atomically:

- restore source outlet stock,
- deduct destination outlet stock,
- move the approved allocation,
- preserve total approved quantity,
- update fulfillment groups,
- record actor, timestamp, source outlet, destination outlet, quantity, and reason.

No silent stock movement is permitted.

## 5. Cancellation and return

### Before approval

No inventory reversal is needed because no stock was committed.

### After approval, before fulfillment

Return the committed quantity to the appropriate outlet using a documented inventory event.

### After dispatch

Customer refusal/physical return is handled through the return workflow rather than pretending the order was never fulfilled.

Return lifecycle:

`RETURN_REQUESTED → RETURN_RECEIVED → INSPECTED → RESTOCKED / DAMAGED`

Only inspected, sellable returned stock returns to sellable inventory.

## 6. Customer-facing simplification

Customers should not need to understand all internal states.

Recommended presentation:

- Order received — checking availability
- Confirmed
- Preparing
- On the way
- Delivered

Partial example:

**4 of 5 units confirmed. We’re arranging the remaining 1.**

## 7. Invariants

The implementation must enforce:

- allocation never exceeds ordered quantity,
- approval never exceeds allocation,
- fulfillment never exceeds approved quantity,
- reassignment does not change total approved quantity,
- inventory cannot become negative,
- approval cannot be applied twice,
- concurrent approvals cannot oversell stock,
- cancellation/return does not blindly add stock,
- all inventory-changing actions are auditable.

## 8. Implementation boundary

This document is design only.

No Firestore data, production inventory, customer orders, security rules, or live storefront behavior is changed by this document.
