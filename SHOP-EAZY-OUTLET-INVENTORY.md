# ShopEazy Outlet Inventory

Status: implementation step completed — outlet inventory data layer only.

## Purpose

ShopEazy now has a separate outlet-level stock model:

`outletInventory/{outletId}__{variantId}`

This does not replace or modify the existing EazyLife `products.variants[].stockQty` field.

## Inventory fields

```
{
  productId,
  variantId,
  outletId,
  partnerId,
  quantityOnHand,
  reorderLevel,
  costPrice,
  active,
  sku,
  createdAt,
  updatedAt
}
```

The deterministic document ID prevents multiple inventory records for the same outlet/variant pair.

## Implemented API

In `js/store.mjs`:

- `setShopEazyOutletInventory()`
- `getShopEazyOutletInventory()`
- `getShopEazyOutletInventoryForOutlet()`
- `getShopEazyOutletInventoryForVariant()`
- `adjustShopEazyOutletInventory()`

## Safety behavior

### Setup

Inventory setup verifies:

1. The outlet exists.
2. The outlet is active and fulfillment-enabled.
3. The optional partner ID matches the outlet's partner.
4. The product exists.
5. The selected variant exists.
6. Quantity and reorder level are non-negative integers.

### Adjustments

Stock adjustments use a Firestore transaction.

The transaction:

1. Reads the outlet inventory record.
2. Validates the current quantity.
3. Calculates the new quantity.
4. Rejects a negative result.
5. Updates the inventory record.
6. Creates the corresponding inventory movement.

This keeps the stock value and its movement history synchronized.

## Important boundary

This step does **not**:

- deduct stock for customer orders
- implement order approval
- migrate legacy stock
- synchronize legacy `stockQty`
- create live ShopEazy inventory records
- change Firestore security rules

Those remain separate controlled steps.

## Next step

The next logical layer is **ShopEazy order allocation / fulfillment groups**.

That layer will connect an order item to one or more outlets before the approval transaction is introduced.
