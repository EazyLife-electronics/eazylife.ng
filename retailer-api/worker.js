/**
 * EazyLife Retailer Price Finder API
 *
 * Deploy this file as a Cloudflare Worker.
 * Keep PARSE_API_KEY in the Worker secret store — NEVER put it in Retailer.html.
 *
 * Required Worker secret:
 *   PARSE_API_KEY
 */

const JUMIA_ENDPOINT =
  'https://api.parse.bot/scraper/7d6997a8-af3e-435a-9395-25a7f80366e9/search_products';

const JIJI_ENDPOINT =
  'https://api.parse.bot/scraper/3c1966cf-1249-4b20-932b-376b70c04ea2/search_listings';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function cleanNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const cleaned = value.replace(/[^0-9.]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function absoluteUrl(url, base) {
  if (!url) return '';
  try {
    return new URL(url, base).href;
  } catch {
    return '';
  }
}

async function callParse(url, query, apiKey) {
  const target = new URL(url);
  target.searchParams.set('page', '1');
  target.searchParams.set('query', query);

  const response = await fetch(target.href, {
    headers: {
      'X-API-Key': apiKey,
      'Accept': 'application/json'
    }
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Invalid response from data provider (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Provider error ${response.status}`);
  }

  return data?.data ?? data;
}

function normalizeJumia(data) {
  const products = Array.isArray(data?.products) ? data.products : [];

  return products
    .map((item) => ({
      store: 'Jumia',
      title: String(item.name || '').trim(),
      price: cleanNumber(item.price),
      oldPrice: cleanNumber(item.old_price),
      discount: item.discount || '',
      rating: item.rating ?? null,
      reviews: item.reviews_count ?? null,
      image: '',
      url: absoluteUrl(item.url, 'https://www.jumia.com.ng'),
      condition: 'Retail'
    }))
    .filter((item) => item.title && item.price !== null);
}

function normalizeJiji(data) {
  const listings = Array.isArray(data?.listings) ? data.listings : [];

  return listings
    .map((item) => ({
      store: 'Jiji',
      title: String(item.title || '').trim(),
      price: cleanNumber(item.price),
      oldPrice: null,
      discount: '',
      rating: null,
      reviews: null,
      image: item.image_url || '',
      url: absoluteUrl(item.url, 'https://jiji.ng'),
      condition: item.condition || '',
      region: item.region || ''
    }))
    .filter((item) => item.title && item.price !== null);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return json({ error: 'GET requests only.' }, 405);
    }

    const url = new URL(request.url);
    const query = (url.searchParams.get('q') || '').trim();

    if (!query) {
      return json({ error: 'Missing search query. Use ?q=iPhone+7' }, 400);
    }

    if (query.length > 120) {
      return json({ error: 'Search query is too long.' }, 400);
    }

    if (!env.PARSE_API_KEY) {
      return json({ error: 'Retailer API is not configured yet.' }, 503);
    }

    const results = await Promise.allSettled([
      callParse(JUMIA_ENDPOINT, query, env.PARSE_API_KEY),
      callParse(JIJI_ENDPOINT, query, env.PARSE_API_KEY)
    ]);

    const jumia = results[0].status === 'fulfilled'
      ? normalizeJumia(results[0].value)
      : [];

    const jiji = results[1].status === 'fulfilled'
      ? normalizeJiji(results[1].value)
      : [];

    const errors = {};

    if (results[0].status === 'rejected') {
      errors.jumia = results[0].reason?.message || 'Jumia search failed.';
    }

    if (results[1].status === 'rejected') {
      errors.jiji = results[1].reason?.message || 'Jiji search failed.';
    }

    const products = [...jumia, ...jiji]
      .sort((a, b) => a.price - b.price)
      .slice(0, 30);

    return json({
      query,
      count: products.length,
      products,
      errors,
      sources: {
        jumia: jumia.length,
        jiji: jiji.length
      }
    });
  }
};
