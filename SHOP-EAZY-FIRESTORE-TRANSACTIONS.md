# ShopEazy Firestore Transaction Shapes

Status: locked design specification — no production Firestore changes
Branch: `shopeazy-foundation`

## Purpose

This document defines the concrete transaction shapes for the two inventory-critical operations:

1. Admin **Approve Order**
2. Admin **Reassign Approved Quantity**

The shapes are designed for Firestore client/server transaction semantics, concurrency protection, idempotency, auditability, and future role-based security.

---

## 1. Canonical document paths

### Order

`orders/{orderId}`

### Fulfillment group

`orders/{orderId}/fulfillmentGroups/{groupId}`

### Outlet inventory

`outletInventory/{inventoryId}`

Recommended deterministic inventory document ID:

`{outletId}__{variantId}`

The application must use one canonical ID-generation function so the logical uniqueness rule `outletId + variantId` is enforced consistently.

### Inventory movement

`inventoryMovements/{movementId}`

### Audit event

Recommended collection:

`shopEazyAudit/{auditId}`

Audit records should be append-only from the application perspective.

---

## 2. Common quantity model

For every order item:

`orderedQuantity = allocatedQuantity + unallocatedQuantity`

For every fulfillment-group item:

`0 ≤ quantityApproved ≤ quantityAllocated ≤ orderedQuantity`

After fulfillment begins:

`0 ≤ quantityFulfilled ≤ quantityApproved`

Across all fulfillment groups for one order item:

- total allocated must not exceed ordered,
- total approved must not exceed allocated,
- total fulfilled must not exceed approved.

These invariants must be checked before committing inventory-changing operations.

---

## 3. Approval transaction

### 3.1 Purpose

The approval transaction converts an admin-prepared allocation into an actual inventory commitment.

Customer submission does **not** run this transaction.

Allocation preparation does **not** run this transaction.

Only the final admin approval action runs it.

### 3.2 Input

The implementation should receive:

```
{
  orderId,
  actorUid,
  approvalMode,       // "FULL" | "PARTIAL"
  resolutionPath      // required for partial approval
}
```

The transaction should derive the authoritative allocation data from Firestore rather than trusting quantities supplied by the browser.

### 3.3 Required preconditions

Before any write:

- authenticated actor is authorized to approve the order,
- order exists,
- order is not already inventory-applied,
- order is not cancelled/rejected,
- order is in an approval-eligible state,
- fulfillment groups exist for quantities being approved,
- each referenced outlet is active and fulfillment-enabled,
- each referenced variant exists,
- allocation quantities satisfy the quantity invariants,
- partial approval has an explicit resolution path.

The browser may display calculations, but Firestore transaction logic must be authoritative.

### 3.4 Transaction read phase

Read the order first.

Then read every affected fulfillment group.

Then read every affected outlet inventory document.

All inventory documents needed for the approval decision must be read inside the transaction before writes occur.

The implementation must not perform a non-transactional stock read and assume it remains valid.

### 3.5 Stock verification

For each fulfillment-group item with approved quantity > 0:

```
available = inventory.quantityOnHand
required  = quantityApproved

require available >= required
```

If any required quantity is unavailable:

- abort the transaction,
- do not deduct any stock,
- do not mark the order approved,
- do not create sale movements,
- return a clear stock-conflict error for admin review.

Firestore transaction retry behavior must not cause a successful earlier attempt to be duplicated.

### 3.6 Approval writes

For every affected inventory record:

```
previousQuantity = quantityOnHand
newQuantity = previousQuantity - approvedQuantity
```

Update:

```
quantityOnHand: newQuantity
updatedAt: serverTimestamp()
```

Create an inventory movement containing at minimum:

```
{
  productId,
  variantId,
  outletId,
  partnerId,
  movementType: "sale",
  quantityChange: -approvedQuantity,
  previousQuantity,
  newQuantity,
  referenceType: "orderApproval",
  referenceId: orderId,
  fulfillmentGroupId,
  actorUid,
  createdAt
}
```

For historical/audit clarity, the movement should also preserve the relevant SKU where useful.

### 3.7 Fulfillment-group writes

For each approved group:

```
status: "APPROVED"
updatedAt: serverTimestamp()
```

For each group item:

```
quantityApproved = approved quantity
quantityFulfilled = 0
```

The implementation should also preserve the original allocation quantity.

### 3.8 Order write

For full approval:

```
{
  status: "APPROVED",
  approvalStatus: "APPROVED",
  inventoryApplied: true,
  approvedAt: serverTimestamp(),
  approvedBy: actorUid,
  updatedAt: serverTimestamp()
}
```

For partial approval:

```
{
  status: "APPROVED",
  approvalStatus: "PARTIAL",
  inventoryApplied: true,
  approvedAt: serverTimestamp(),
  approvedBy: actorUid,
  updatedAt: serverTimestamp()
}
```

The order must additionally preserve the unresolved quantity and selected resolution path, for example:

```
{
  fulfillmentSummary: {
    orderedQuantity: ...,
    approvedQuantity: ...,
    unallocatedQuantity: ...
  },
  partialResolution: {
    path: "WAIT_FOR_STOCK" | "CUSTOMER_ACCEPTED" | "SUBSTITUTION" | "CANCEL_REMAINDER",
    note: ...
  }
}
```

The exact field names can be finalized during implementation, but the information must exist explicitly.

### 3.9 Approval idempotency

The transaction must reject a second approval when:

```
inventoryApplied === true
```

or the order is otherwise no longer approval-eligible.

A repeated button click therefore cannot deduct stock a second time.

A transaction retry caused by Firestore concurrency is different from a second business approval; the implementation must rely on the transaction's atomic commit semantics rather than creating external side effects during transaction execution.

### 3.10 Approval failure cases

| Failure | Result |
|---|---|
| Order missing | Abort |
| Already approved/applied | No-op/error; no stock change |
| Unauthorized actor | Reject before transaction |
| Invalid allocation | Abort |
| Negative quantity | Abort |
| Approved > allocated | Abort |
| Allocated > ordered | Abort |
| Missing inventory record | Abort |
| Insufficient stock | Abort entire transaction |
| Inactive outlet | Abort |
| Invalid partial resolution | Abort |
| Concurrent stock change | Firestore retries or ultimately aborts |
| Successful commit | All affected stock/order/group writes commit together |

---

## 4. Reassignment transaction

### 4.1 Purpose

Reassignment moves an already-approved quantity from one outlet fulfillment group to another outlet before fulfillment begins.

This is **not** a new customer order.

It is an inventory transfer associated with an existing approved order.

### 4.2 Input

```
{
  orderId,
  sourceGroupId,
  destinationGroupId,     // existing group or newly created group
  orderItemId,
  quantity,
  actorUid,
  reason
}
```

The authoritative source quantity must be read from Firestore.

The browser must not be trusted to state how much approved stock exists.

### 4.3 Preconditions

- authenticated actor is authorized,
- order exists,
- order is not cancelled/returned,
- source fulfillment group exists,
- source group is still before fulfillment,
- source item has enough approved but unfulfilled quantity,
- destination outlet is active,
- destination outlet is fulfillment-enabled,
- destination inventory exists,
- destination inventory has enough stock,
- quantity > 0,
- reassignment does not exceed ordered quantity,
- reassignment preserves total approved quantity.

### 4.4 Transaction read phase

Read:

1. order,
2. source fulfillment group,
3. destination fulfillment group if already present,
4. source outlet inventory,
5. destination outlet inventory.

All affected inventory documents must be read inside the transaction.

If source and destination resolve to the same inventory document, the operation must be rejected as unnecessary rather than attempting to restore and deduct the same record.

### 4.5 Inventory movement

Suppose:

- Source has 8 units.
- Destination has 5 units.
- 2 approved units are moved.

Then:

Source:

`8 → 10`

Destination:

`5 → 3`

This reflects that the approved sale commitment is being moved from one outlet's inventory to another.

Create two auditable movements:

Source:

```
{
  movementType: "transferIn",
  quantityChange: +2,
  referenceType: "orderReassignment",
  referenceId: orderId,
  sourceOutletId,
  destinationOutletId,
  actorUid
}
```

Destination:

```
{
  movementType: "transferOut",
  quantityChange: -2,
  referenceType: "orderReassignment",
  referenceId: orderId,
  sourceOutletId,
  destinationOutletId,
  actorUid
}
```

The two movement records must be created atomically with the allocation change.

**Important:** these are operationally tied to the order reassignment. They are not a second customer sale.

### 4.6 Fulfillment-group update

Decrease the source group's approved quantity by the moved amount.

Increase the destination group's approved quantity by the moved amount.

If the destination group does not exist, create it within the same transaction with the destination outlet/partner information.

The total approved quantity for the order item must remain unchanged.

Example:

Before:

- Outlet A: approved 3
- Outlet B: approved 2
- Total approved: 5

Move 1 from A to B:

After:

- Outlet A: approved 2
- Outlet B: approved 3
- Total approved: 5

### 4.7 Reassignment audit

Create an append-only audit record:

```
{
  action: "ORDER_ALLOCATION_REASSIGNED",
  orderId,
  orderItemId,
  sourceGroupId,
  destinationGroupId,
  sourceOutletId,
  destinationOutletId,
  quantity,
  reason,
  actorUid,
  createdAt
}
```

The audit event must survive later order-status changes.

### 4.8 Reassignment restrictions

Reassignment is allowed only before the affected quantity enters fulfillment.

At minimum, reject if the source group is:

- `PICKING`
- `READY`
- `DISPATCHED`
- `DELIVERED`
- `CANCELLED`
- `RETURNED`

If only part of a group's quantity has begun fulfillment, only the still-unfulfilled approved quantity may be considered for reassignment.

The implementation should use per-item quantities rather than assuming the entire group is always in one operational state.

---

## 5. Why reassignment restores source stock

Approval initially deducts stock from the source outlet because the approved quantity is committed there.

If the commitment is moved:

`Source stock + quantity`

and:

`Destination stock - quantity`

Therefore the total physical sellable stock across the two outlets is unchanged by the reassignment itself.

What changes is **which outlet carries the commitment**.

This distinction prevents accidental double deduction.

---

## 6. Transaction ordering

The implementation should follow a consistent pattern:

### Approval

```
read order
→ read fulfillment groups
→ read inventory
→ validate
→ write inventory
→ write movements
→ write fulfillment groups
→ write order
→ commit
```

### Reassignment

```
read order
→ read source/destination groups
→ read source/destination inventory
→ validate
→ restore source inventory
→ deduct destination inventory
→ write movements
→ update groups
→ write audit event
→ update order
→ commit
```

No stock-changing write should happen outside the transaction.

---

## 7. Concurrency examples

### Two admins approve the same order

The first successful transaction sets:

`inventoryApplied = true`

A later attempt sees that state and cannot deduct again.

### Two orders compete for the last unit

Both transactions may initially read the same stock, but Firestore detects the conflicting transaction state.

Only a transaction that commits against valid current inventory can succeed.

The losing transaction must surface an availability conflict rather than producing negative inventory.

### Reassignment competes with another sale

Both operations read the affected inventory documents inside transactions.

Firestore conflict detection ensures the final committed quantities reflect one valid serialization rather than two stale calculations.

---

## 8. Important implementation detail: transaction side effects

Firestore transactions may retry.

Therefore the transaction callback must not directly perform external side effects such as:

- sending WhatsApp messages,
- sending email,
- calling payment APIs,
- calling external delivery services,
- generating irreversible external records.

Those actions should happen after the transaction commits, using the committed state as their trigger.

Inventory movement and audit documents are Firestore writes and therefore belong inside the transaction.

---

## 9. Security boundary

The final implementation must not rely on the admin UI to protect these operations.

The eventual security architecture should ensure:

- only authorized ShopEazy staff can approve,
- only authorized staff can reassign,
- partner/outlet staff can only operate within their assigned relationships,
- customer clients cannot directly mutate outlet inventory,
- customer clients cannot mark orders approved,
- customer clients cannot create inventory movements,
- audit records cannot be silently rewritten by ordinary clients.

The exact Firestore security rules/server architecture will be designed separately before production enablement.

---

## 10. Testing matrix

Before production behavior is enabled, test at least:

1. Full approval from one outlet.
2. Full approval split across two outlets.
3. Partial approval.
4. Insufficient stock in one of several outlets.
5. Two simultaneous approvals against the same stock.
6. Double-click/repeated approval.
7. Approval of an already-approved order.
8. Reassignment before picking.
9. Reassignment with insufficient destination stock.
10. Reassignment after picking begins.
11. Partial group reassignment.
12. Concurrent reassignment and sale.
13. Cancellation before approval.
14. Cancellation after approval.
15. Return to original outlet.
16. Return to a different physical outlet.
17. Damaged return that must not become sellable stock.
18. Audit record creation and preservation.
19. Reconciliation of inventory movements against outlet quantities.

---

## 11. Implementation boundary

This is a design specification only.

It does not:

- create Firestore collections,
- migrate inventory,
- alter existing `products`,
- alter existing `orders`,
- change security rules,
- change checkout,
- change production inventory behavior.

The next implementation step is to build these transaction helpers in a controlled, non-production path and test them against dedicated ShopEazy test data before connecting them to the live admin workflow.
