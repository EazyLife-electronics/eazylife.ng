# ShopEazy Cancellation & Returns

Status: implementation started on `shopeazy-foundation`.

## Cancellation

### Before approval
Customer submission does not reserve stock, so cancellation changes the order state and creates an audit event. No inventory is restored.

API:
`cancelShopEazyOrderBeforeApproval({ orderId, actorUid, reason, customerNote, internalNote })`

### After approval, before physical fulfillment
Committed quantities are restored to their original fulfillment outlets in one Firestore transaction.

The operation:
1. reads the order and all fulfillment groups;
2. rejects groups that have entered physical fulfillment;
3. reads every affected outlet-inventory document;
4. restores committed quantities;
5. writes `inventoryMovements` with `movementType: "return"`;
6. marks groups cancelled;
7. marks the order inventory returned;
8. writes an audit event.

API:
`cancelShopEazyApprovedOrder({ orderId, actorUid, reason, customerNote, internalNote })`

Once a group has entered `PICKING`, cancellation is no longer used for that physical quantity.

## Returns

Post-dispatch problems use a return/refusal workflow:

`RETURN_REQUESTED → RETURN_RECEIVED → INSPECTED → RESTOCKED / DAMAGED`

A return request does not change sellable stock.

Physical receipt does not change sellable stock.

Inspection is the inventory boundary:
- `RESTOCKED`: inspected sellable quantity is added to the explicitly selected receiving outlet.
- `DAMAGED`: quantity is recorded as damaged and is not added to `quantityOnHand`.

Return quantities are tracked per fulfillment group and order item, so partial and split-order returns are supported.

Every inventory restoration references the return/order and original fulfillment group and creates an inventory movement and audit event.

## Safety invariants

- No blind stock add-back.
- No duplicate cancellation reversal.
- No return quantity greater than physically fulfilled, not-yet-returned quantity.
- No negative inventory.
- All stock-changing cancellation operations are transactional.
- Post-dispatch issues are returns/refusals, not cancellations.
- No storefront, checkout, legacy stock, or Firestore security-rule changes are included in this step.

## Current implementation boundary

The branch now contains the two cancellation paths:
- pre-approval cancellation;
- approved-order cancellation before physical fulfillment.

The remaining return lifecycle functions should be added as the next isolated implementation increment:
- request return;
- receive return;
- inspect return;
- restock sellable returns or record damaged returns.
