'use strict';

const crypto = require('node:crypto');

const CANDIDATE_SKUS = [
  'GLOBAL-FAP-4X6',
  'GLOBAL-FAP-5X7',
  'GLOBAL-FAP-6X8',
  'GLOBAL-FAP-6X9',
  'GLOBAL-FAP-8X10',
  'GLOBAL-FAP-8X12',
  'GLOBAL-FAP-10X10',
  'GLOBAL-FAP-11X14',
  'GLOBAL-FAP-12X16',
  'GLOBAL-FAP-12X18',
  'GLOBAL-FAP-16X16',
  'GLOBAL-FAP-16X20',
  'GLOBAL-FAP-16X24',
  'GLOBAL-FAP-18X24',
  'GLOBAL-FAP-20X20',
  'GLOBAL-FAP-20X28',
  'GLOBAL-FAP-20X24',
  'GLOBAL-FAP-20X30',
  'GLOBAL-FAP-24X24',
  'GLOBAL-FAP-24X30',
  'GLOBAL-FAP-24X36',
  'GLOBAL-FAP-30X30',
  'GLOBAL-FAP-30X40',
  'GLOBAL-FAP-30X45'
];

const PUBLIC_SUPABASE_URL = 'https://ereapsfcsqtdmzosgnnn.supabase.co';
const PUBLIC_SUPABASE_KEY = 'sb_publishable_KTywNu5kx3HfcOLInKOUjA_5Py79jZm';
const cleanCountry = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value) ? value : null;
const cleanSku = value => typeof value === 'string' && /^GLOBAL-FAP-[0-9]+X[0-9]+$/i.test(value) ? value.toUpperCase() : null;
const cents = value => Math.round(Number(value || 0) * 100);
const roundUp = (value, step = 500) => Math.ceil(Math.max(0, value) / step) * step;
const PRODUCT_CACHE_TTL_MS = 30 * 60 * 1000;
const MIN_FINE_ART_SHORT_SIDE_IN = 8;
const productCache = new Map();

function prodigiEnvironment() {
  return String(process.env.PRODIGI_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
}

function prodigiBaseUrl() {
  return prodigiEnvironment() === 'live' ? 'https://api.prodigi.com' : 'https://api.sandbox.prodigi.com';
}

function prodigiConfigured() {
  return Boolean(process.env.PRODIGI_API_KEY);
}

function printCheckoutStatus() {
  return {
    environment: prodigiEnvironment(),
    prodigi: prodigiConfigured(),
    sales_enabled: process.env.PRINT_SALES_ENABLED === 'true',
    sample_approved: process.env.PRINT_SAMPLE_APPROVED === 'true',
    legal_approved: process.env.PRINT_LEGAL_APPROVED === 'true',
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    webhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    private_storage: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

function printCheckoutReady() {
  const status = printCheckoutStatus();
  return status.sales_enabled
    && status.sample_approved
    && status.legal_approved
    && status.environment === 'live'
    && status.prodigi
    && status.stripe
    && status.webhook
    && status.private_storage;
}

function supabaseAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL || PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function supabasePublic() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL || PUBLIC_SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function prodigiRequest(path, options = {}) {
  if (!prodigiConfigured()) throw Object.assign(new Error('Prodigi is not configured'), { code: 'PRODIGI_NOT_CONFIGURED' });
  const { timeoutMs = 6000, ...fetchOptions } = options;
  let response;
  try {
    response = await fetch(prodigiBaseUrl() + path, {
      ...fetchOptions,
      signal: fetchOptions.signal || AbortSignal.timeout(timeoutMs),
      headers: {
        'X-API-Key': process.env.PRODIGI_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(fetchOptions.headers || {})
      }
    });
  } catch (error) {
    const code = error?.name === 'TimeoutError' || error?.name === 'AbortError'
      ? 'PRODIGI_TIMEOUT'
      : 'PRODIGI_NETWORK_ERROR';
    throw Object.assign(new Error(code), { code });
  }
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) {
    const error = new Error('Prodigi request failed');
    error.code = 'PRODIGI_HTTP_' + response.status;
    error.status = response.status;
    error.details = body;
    throw error;
  }
  return body;
}

async function findArtworkForPrint(artworkId) {
  if (typeof artworkId !== 'string' || !/^[a-z0-9-]+$/.test(artworkId)) return null;
  const client = supabaseAdmin() || supabasePublic();
  const { data, error } = await client
    .from('art_gallery_works')
    .select('id,title_en,description_en,pixel_width,pixel_height,published,review_status,public_preview_path')
    .eq('id', artworkId)
    .eq('published', true)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, title: data.title_en || data.id, description: data.description_en || '', pixel_width: data.pixel_width, pixel_height: data.pixel_height, review_status: data.review_status, public_preview_path: data.public_preview_path || '' };
}

async function findPrintAsset(artworkId) {
  if (typeof artworkId !== 'string' || !/^[a-z0-9-]+$/.test(artworkId)) return null;
  const client = supabaseAdmin();
  let data = null;
  let error = null;
  if (client) {
    const result = await client
      .from('art_gallery_assets')
      .select('artwork_id,asset_role,bucket_name,object_path,mime_type,pixel_width,pixel_height,verified_at')
      .eq('artwork_id', artworkId)
      .in('asset_role', ['print', 'master', 'digital']);
    data = result.data;
    error = result.error;
  }
  const ranked = !error && Array.isArray(data) ? data
    .filter(row => row.bucket_name === (process.env.ART_STORAGE_BUCKET || 'art-originals'))
    .filter(row => ['image/jpeg', 'image/png'].includes(String(row.mime_type || '').toLowerCase()) || /\.(jpe?g|png)$/i.test(row.object_path || ''))
    .sort((a, b) => {
      const role = row => row.asset_role === 'print' ? 3 : row.asset_role === 'master' ? 2 : 1;
      const verified = row => row.verified_at ? 1 : 0;
      const pixels = row => Number(row.pixel_width || 0) * Number(row.pixel_height || 0);
      return verified(b) - verified(a) || pixels(b) - pixels(a) || role(b) - role(a);
    }) : [];
  if (ranked[0]) return ranked[0];

  const artwork = await findArtworkForPrint(artworkId);
  if (!artwork || !artwork.public_preview_path || !Number(artwork.pixel_width) || !Number(artwork.pixel_height)) return null;
  return {
    artwork_id: artwork.id,
    asset_role: 'archive-preview',
    bucket_name: 'art-previews',
    object_path: artwork.public_preview_path,
    mime_type: 'image/webp',
    pixel_width: artwork.pixel_width,
    pixel_height: artwork.pixel_height,
    verified_at: null,
    preview_fallback: true
  };
}

async function productDetails(sku) {
  const safe = cleanSku(sku);
  if (!safe) return null;
  const cached = productCache.get(safe);
  if (cached && Date.now() - cached.at < PRODUCT_CACHE_TTL_MS) return cached.value;
  try {
    const body = await prodigiRequest('/v4.0/products/' + encodeURIComponent(safe), { method: 'GET', timeoutMs: 3000 });
    const value = body && body.product ? body.product : null;
    productCache.set(safe, { at: Date.now(), value });
    return value;
  } catch (error) {
    if (error.status === 404 || error.status === 400) {
      productCache.set(safe, { at: Date.now(), value: null });
      return null;
    }
    throw error;
  }
}

function variantForCountry(product, country) {
  if (!product || !Array.isArray(product.variants)) return null;
  return product.variants.find(variant => Array.isArray(variant.shipsTo) && variant.shipsTo.includes(country)) || null;
}

function resolutionForVariant(variant) {
  const area = variant && variant.printAreaSizes && (variant.printAreaSizes.default || variant.printAreaSizes.Default);
  if (!area) return null;
  const width = Number(area.horizontalResolution || 0);
  const height = Number(area.verticalResolution || 0);
  return width > 0 && height > 0 ? { width, height } : null;
}

function fitsResolution(asset, required) {
  const width = Number(asset && asset.pixel_width || 0);
  const height = Number(asset && asset.pixel_height || 0);
  if (!width || !height || !required) return false;
  return (width >= required.width && height >= required.height)
    || (width >= required.height && height >= required.width);
}

function fitQuality(asset, required) {
  const width = Number(asset && asset.pixel_width || 0);
  const height = Number(asset && asset.pixel_height || 0);
  const requiredWidth = Number(required && required.width || 0);
  const requiredHeight = Number(required && required.height || 0);
  if (!width || !height || !requiredWidth || !requiredHeight) return null;
  const sameOrientation = (width >= height) === (requiredWidth >= requiredHeight);
  const scaleNeeded = sameOrientation
    ? Math.min(requiredWidth / width, requiredHeight / height)
    : Math.min(requiredWidth / height, requiredHeight / width);
  const effectivePpi = Math.round(300 / Math.max(scaleNeeded, 0.01));
  return {
    scale_needed: Number(scaleNeeded.toFixed(3)),
    effective_ppi: effectivePpi,
    recommended: effectivePpi >= 280,
    acceptable: effectivePpi >= 200,
    label: effectivePpi >= 280 ? 'Recommended quality' : effectivePpi >= 240 ? 'Very good quality' : effectivePpi >= 200 ? 'Good quality' : 'Standard quality'
  };
}

function aspectDelta(asset, product) {
  const aw = Number(asset && asset.pixel_width || 0);
  const ah = Number(asset && asset.pixel_height || 0);
  const pw = Number(product && product.productDimensions && product.productDimensions.width || 0);
  const ph = Number(product && product.productDimensions && product.productDimensions.height || 0);
  if (!aw || !ah || !pw || !ph) return 1;
  const a = Math.min(aw, ah) / Math.max(aw, ah);
  const p = Math.min(pw, ph) / Math.max(pw, ph);
  return Math.abs(a - p);
}

function candidateSkusForAsset(asset) {
  const width = Number(asset && asset.pixel_width || 0);
  const height = Number(asset && asset.pixel_height || 0);
  const small = ['GLOBAL-FAP-4X6','GLOBAL-FAP-5X7','GLOBAL-FAP-6X8'];
  if (!width || !height) return small;
  const ratio = Math.min(width, height) / Math.max(width, height);
  const closest = CANDIDATE_SKUS
    .filter(sku => !small.includes(sku))
    .map(sku => {
      const match = sku.match(/-(\d+)X(\d+)$/);
      const a = Number(match && match[1] || 1);
      const b = Number(match && match[2] || 1);
      return { sku, delta: Math.abs(ratio - Math.min(a, b) / Math.max(a, b)), area: a * b };
    })
    .sort((x, y) => x.delta - y.delta || x.area - y.area)
    .slice(0, 3)
    .map(item => item.sku);
  return [...new Set([...small, ...closest])];
}

async function productDetailsBatch(skus, concurrency = 2) {
  const queue = [...skus];
  const products = [];
  let failures = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, queue.length || 1)) }, async () => {
    while (queue.length) {
      const sku = queue.shift();
      try {
        const product = await productDetails(sku);
        if (product) products.push(product);
      } catch (error) {
        failures += 1;
        console.warn('Prodigi product lookup failed', sku, error?.code || error?.message || 'unknown');
      }
    }
  });
  await Promise.all(workers);
  if (!products.length && failures) {
    throw Object.assign(new Error('Prodigi catalogue unavailable'), { code: 'PRODIGI_CATALOG_UNAVAILABLE' });
  }
  return products;
}

function skuDimensions(sku) {
  const match = String(sku || '').match(/GLOBAL-FAP-(\d+)X(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

function fineArtRetailFloorCents(sku) {
  const dims = skuDimensions(sku);
  if (!dims || Math.min(dims.width, dims.height) < MIN_FINE_ART_SHORT_SIDE_IN) return 0;
  const longest = Math.max(dims.width, dims.height);
  if (longest <= 12) return 7900;
  if (longest <= 14) return 9900;
  if (longest <= 18) return 11900;
  if (longest <= 24) return 15900;
  if (longest <= 30) return 19900;
  if (longest <= 36) return 24900;
  return 32900;
}

function localProductForSku(sku, asset) {
  const match = String(sku || '').match(/GLOBAL-FAP-(\d+)X(\d+)$/i);
  if (!match) return null;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!width || !height) return null;
  const required = { width: width * 300, height: height * 300 };
  const quality = fitQuality(asset, required);
  return {
    sku: String(sku).toUpperCase(),
    description: 'Enhanced matte fine-art print',
    dimensions: { width, height, units: 'in' },
    resolution: required,
    aspect_delta: aspectDelta(asset, { productDimensions: { width, height, units: 'in' } }),
    quality_ok: fitsResolution(asset, required),
    quality,
    fit_mode: 'fitPrintArea'
  };
}

async function eligibleProducts(artworkId, countryCode) {
  const country = cleanCountry(countryCode);
  if (!country || !prodigiConfigured()) return { asset: null, products: [] };
  const asset = await findPrintAsset(artworkId);
  if (!asset) return { asset: null, products: [] };
  const candidates = candidateSkusForAsset(asset)
    .map(sku => localProductForSku(sku, asset))
    .filter(Boolean)
    .sort((a, b) => {
      const area = p => Number(p.dimensions && p.dimensions.width || 0) * Number(p.dimensions && p.dimensions.height || 0);
      return area(a) - area(b);
    });
  const qualityFloor = asset.preview_fallback ? 220 : 200;
  const products = candidates
    .filter(product => Math.min(Number(product.dimensions?.width || 0), Number(product.dimensions?.height || 0)) >= MIN_FINE_ART_SHORT_SIDE_IN)
    .filter(product => product.quality && product.quality.effective_ppi >= qualityFloor)
    .slice(0, 6);
  return { asset, products };
}

async function createQuote({ sku, countryCode, quantity = 1, shippingMethod = null }) {
  const country = cleanCountry(countryCode);
  const safeSku = cleanSku(sku);
  const copies = Math.max(1, Math.min(5, Number(quantity || 1)));
  if (!country || !safeSku) throw Object.assign(new Error('Invalid print quote request'), { code: 'PRINT_QUOTE_INVALID' });
  const payload = {
    destinationCountryCode: country,
    currencyCode: 'EUR',
    items: [{ sku: safeSku, copies, attributes: {}, assets: [{ printArea: 'default' }] }]
  };
  if (shippingMethod) payload.shippingMethod = shippingMethod;
  const body = await prodigiRequest('/v4.0/quotes', { method: 'POST', body: JSON.stringify(payload) });
  const quotes = Array.isArray(body && body.quotes) ? body.quotes : [];
  const preferred = quotes.find(q => String(q.shipmentMethod || '').toLowerCase() === 'standard')
    || quotes.find(q => String(q.shipmentMethod || '').toLowerCase() === 'budget')
    || quotes[0];
  if (!preferred || !preferred.costSummary) throw Object.assign(new Error('No shipping quote available'), { code: 'PRINT_NO_QUOTE' });
  return { quote: preferred, quantity: copies, sku: safeSku, country };
}

function retailFromQuote(quoteResult) {
  const quote = quoteResult.quote;
  const wholesaleItems = cents(quote.costSummary && quote.costSummary.items && quote.costSummary.items.amount);
  const wholesaleShipping = cents(quote.costSummary && quote.costSummary.shipping && quote.costSummary.shipping.amount);
  const multiplier = Math.max(1, Number(process.env.PRINT_COST_MULTIPLIER || 2));
  const roundTo = Math.max(100, Number(process.env.PRINT_ROUND_TO_CENTS || 500));
  const curatedFloor = fineArtRetailFloorCents(quoteResult.sku) * quoteResult.quantity;
  if (!curatedFloor) throw Object.assign(new Error('Fine-art print size is below the curated minimum'), { code: 'PRINT_SIZE_BELOW_MINIMUM' });
  const product = roundUp(Math.max(wholesaleItems * multiplier, curatedFloor), roundTo);
  const shipping = roundUp(wholesaleShipping, 100);
  return {
    currency: 'eur',
    product_cents: product,
    shipping_cents: shipping,
    total_cents: product + shipping,
    wholesale_items_cents: wholesaleItems,
    wholesale_shipping_cents: wholesaleShipping,
    shipping_method: String(quote.shipmentMethod || 'Standard')
  };
}

function previewPrintAssetUrl(asset, expiresIn = 86400) {
  if (!asset || !asset.preview_fallback || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const expires = Math.floor(Date.now() / 1000) + Math.max(300, Math.min(7 * 86400, Number(expiresIn || 86400)));
  const message = asset.artwork_id + ':' + expires;
  const sig = crypto.createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update(message).digest('hex');
  const url = new URL('/functions/v1/art-print-asset', process.env.SUPABASE_URL || PUBLIC_SUPABASE_URL);
  url.searchParams.set('artwork_id', asset.artwork_id);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('sig', sig);
  return url.toString();
}

async function signedPrintUrl(asset, expiresIn = 86400) {
  if (!asset) return null;
  if (asset.preview_fallback) return previewPrintAssetUrl(asset, expiresIn);
  const client = supabaseAdmin();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(asset.bucket_name || process.env.ART_STORAGE_BUCKET || 'art-originals')
    .createSignedUrl(asset.object_path, expiresIn);
  if (error || !data || !data.signedUrl) return null;
  return data.signedUrl;
}

async function submitOrder({ session, artwork, asset, sku, quantity, shippingMethod, recipientCostCents }) {
  const shipping = session.collected_information && session.collected_information.shipping_details
    ? session.collected_information.shipping_details
    : session.shipping_details;
  const address = shipping && shipping.address;
  if (!shipping || !address || !address.line1 || !address.postal_code || !address.country || !address.city) {
    throw Object.assign(new Error('Shipping address is missing from paid checkout'), { code: 'PRINT_ADDRESS_MISSING' });
  }
  const assetUrl = await signedPrintUrl(asset, 86400);
  if (!assetUrl) throw Object.assign(new Error('Print master could not be signed'), { code: 'PRINT_ASSET_UNAVAILABLE' });
  const merchantReference = 'FBART-' + session.id;
  const body = await prodigiRequest('/v4.0/orders', {
    method: 'POST',
    body: JSON.stringify({
      merchantReference,
      idempotencyKey: 'freddy-art:' + session.id,
      shippingMethod: shippingMethod || 'Standard',
      recipient: {
        name: shipping.name || session.customer_details && session.customer_details.name || 'Art collector',
        email: session.customer_details && session.customer_details.email || undefined,
        address: {
          line1: address.line1,
          line2: address.line2 || undefined,
          postalOrZipCode: address.postal_code,
          countryCode: address.country,
          townOrCity: address.city,
          stateOrCounty: address.state || undefined
        }
      },
      items: [{
        merchantReference: artwork.id,
        sku,
        copies: quantity,
        sizing: 'fitPrintArea',
        attributes: {},
        recipientCost: { amount: (recipientCostCents / 100).toFixed(2), currency: 'EUR' },
        assets: [{ printArea: 'default', url: assetUrl }]
      }],
      metadata: {
        artworkId: artwork.id,
        stripeSessionId: session.id,
        site: 'art.freddybremseth.com'
      }
    })
  });
  return body && body.order ? body.order : null;
}

async function getPrintOrder(stripeSessionId) {
  if (!stripeSessionId) return null;
  const client = supabaseAdmin();
  if (!client) return null;
  const { data, error } = await client
    .from('art_print_orders')
    .select('*')
    .eq('stripe_session_id', stripeSessionId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function savePrintOrder(record) {
  const client = supabaseAdmin();
  if (!client) return null;
  const row = {
    stripe_session_id: record.stripe_session_id,
    artwork_id: record.artwork_id,
    prodigi_order_id: record.prodigi_order_id || null,
    prodigi_environment: prodigiEnvironment(),
    sku: record.sku,
    quantity: record.quantity || 1,
    destination_country: record.destination_country,
    shipping_method: record.shipping_method || null,
    amount_total_cents: Number.isFinite(Number(record.amount_total_cents)) ? Number(record.amount_total_cents) : null,
    currency: 'eur',
    state: record.state || 'paid',
    prodigi_stage: record.prodigi_stage || null,
    issues: Array.isArray(record.issues) ? record.issues : [],
    customer_email: record.customer_email || null,
    last_error: record.last_error || null,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await client
    .from('art_print_orders')
    .upsert(row, { onConflict: 'stripe_session_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function patchPrintOrder(stripeSessionId, patch) {
  const client = supabaseAdmin();
  if (!client || !stripeSessionId) return null;
  const clean = { ...patch, updated_at: new Date().toISOString() };
  delete clean.stripe_session_id;
  const { data, error } = await client
    .from('art_print_orders')
    .update(clean)
    .eq('stripe_session_id', stripeSessionId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function findOrderByMerchantReference(reference) {
  if (!reference || !prodigiConfigured()) return null;
  const params = new URLSearchParams();
  params.set('top', '5');
  params.append('merchantReferences', reference);
  const body = await prodigiRequest('/v4.0/orders?' + params.toString(), { method: 'GET' });
  const orders = Array.isArray(body && body.orders) ? body.orders : [];
  return orders.find(order => order.merchantReference === reference) || orders[0] || null;
}

module.exports = {
  CANDIDATE_SKUS,
  MIN_FINE_ART_SHORT_SIDE_IN,
  skuDimensions,
  fineArtRetailFloorCents,
  cleanCountry,
  cleanSku,
  prodigiEnvironment,
  prodigiConfigured,
  printCheckoutStatus,
  printCheckoutReady,
  findArtworkForPrint,
  findPrintAsset,
  supabasePublic,
  previewPrintAssetUrl,
  productDetails,
  fitQuality,
  localProductForSku,
  eligibleProducts,
  createQuote,
  retailFromQuote,
  submitOrder,
  findOrderByMerchantReference,
  getPrintOrder,
  savePrintOrder,
  patchPrintOrder
};
