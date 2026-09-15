# EazyLife Retailer Live Results API

This folder contains the backend worker for the EazyLife reseller price finder.

## Why a worker?

EazyLife.ng is hosted on GitHub Pages, so `Retailer.html` cannot safely keep a private API key or run server-side requests. The Cloudflare Worker acts as the small backend between the page and the retailer data provider.

## Data source

The worker currently uses Parse's maintained public wrappers for:

- Jumia Nigeria `search_products`
- Jiji Nigeria `search_listings`

These are independent wrappers, not official Jumia/Jiji developer APIs.

## Setup

1. Create a Parse account and obtain an API key.
2. Create a Cloudflare Worker.
3. Copy `worker.js` into the Worker.
4. Add a Worker secret named:

   `PARSE_API_KEY`

5. Paste your Parse API key as the secret value.
6. Deploy the Worker.
7. Test it with:

   `https://YOUR-WORKER.workers.dev/?q=iPhone%207`

A successful response contains a `products` array with normalized Jumia and Jiji listings sorted by price.

## Important

Do **not** put `PARSE_API_KEY` inside `Retailer.html` or any public GitHub file.

## Next step

After the Worker is deployed, connect `Retailer.html` to its URL. The existing price calculator can remain; the manual Jumia/Jiji price fields will be replaced by live result cards.
