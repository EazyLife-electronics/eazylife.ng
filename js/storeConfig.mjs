// js/storeConfig.mjs
// ShopEazy business identity and feature flags.
// This module is intentionally separate from Firebase configuration and does
// not change the live storefront unless another module imports it.

export const STORE_CONFIG = {
  name: "ShopEazy",
  shortName: "ShopEazy",
  tagline: "Shop smart. Shop easy.",

  currency: "NGN",
  currencySymbol: "₦",

  features: {
    payments: false,
    customerAccounts: true,
    partnerOutlets: true,
    deliveryTracking: true
  },

  businessModel: {
    type: "managed-retail",
    partnersAreSellers: false,
    partnersProvideInventory: true,
    partnersProvideOutlets: true
  }
};
