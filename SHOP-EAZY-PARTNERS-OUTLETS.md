# ShopEazy Partners & Outlets Data Layer

Status: implementation step completed — data-layer helpers only.

## Purpose

This step introduces the first ShopEazy managed-retail entities:

- `partners/{partnerId}`
- `outlets/{outletId}`

It does **not** migrate existing EazyLife data, create production partner/outlet records, change checkout, change stock handling, or change Firestore security rules.

## Business meaning

ShopEazy partners provide inventory and may provide physical outlets.

Partners are **not independent marketplace sellers**.

An outlet belongs to exactly one partner through `partnerId`.

## Partner fields

```
{
  name,
  status,       // ACTIVE | INACTIVE
  contact,
  notes,
  createdAt,
  updatedAt
}
```

## Outlet fields

```
{
  partnerId,
  name,
  status,             // ACTIVE | INACTIVE
  address,
  serviceAreas: [],
  fulfillmentEnabled,
  operatingHours,
  createdAt,
  updatedAt
}
```

## Data-layer API

Implemented in `js/store.mjs`:

### Partners

- `createShopEazyPartner()`
- `getShopEazyPartner()`
- `getShopEazyPartners()`
- `updateShopEazyPartner()`

### Outlets

- `createShopEazyOutlet()`
- `getShopEazyOutlet()`
- `getShopEazyOutlets()`
- `updateShopEazyOutlet()`

The outlet creation helper verifies that the referenced partner exists before creating the outlet.

## Safety boundary

These functions are opt-in. Importing `store.mjs` does not create any ShopEazy records.

Existing EazyLife collections and workflows remain untouched.

## Next step

After reviewing this data layer, the next controlled implementation step is **outlet inventory**:

`outletInventory/{outletId}__{variantId}`

That layer will establish outlet-specific stock while retaining the existing product `variants[].stockQty` until reconciliation and migration are explicitly implemented.
