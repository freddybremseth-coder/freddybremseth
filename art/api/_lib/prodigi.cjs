'use strict';

const CANDIDATE_SKUS = [
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

const cleanCountry = value => typeof value === 'string' && /^[A-Z]{2}$/.test(value) ? value : null;
const cleanSku = value => typeof value === 'string' && /^GLOBAL-FAP-[0-9]+X[0-9]+$/i.test(value) ? value.toUpperCase() : null;
const cents = value => Math.round(Number(value || 0) * 100);
const roundUp = (value, step = 500) => Math.ceil(Math.max(0, value) / step) * step;

function prodigiEnvironment() {
  return String(process.env.PRODIGI_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
}

function prodigiBaseUrl() {
  return prodigiEnvironment() === 'live' ? 'https://api.prodigi.com' : 'https://api.sandbox.prodigi.com';
}

function prodigiConfigured() {
  return Boolean(process.env.PRODIGI_API_KEY);
}

function printCheckoutReady() {
  return process.env.PRINT_SALES_ENABLED === 'true'
    && process.env.PRINT_SAMPLE_APPROVED === 'true'
    && process.env.PRINT_LEGAL_APPROVED === 'true'
    && prodigiEnvironment() === 'live'
    && prodigiConfigured()
    && Boolean(process.env.STRIPE_SECRET_KEY)
    && Boolean(process.env.STRIPE_WEBHOOK_SECRET)
    && Boolean(process.env.SUPABASE_URL)
    && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function prodigiRequest(path, options = {}) {
  if (!prodigiConfigured()) throw Object.assign(new Error('Prodigi is not configured'), { code: 'PRODIGI_NOT_CONFIGURED' });
  const response = await fetch(prodigiBaseUrl() + path, {
    ...options,
    headers: {
      'X-API-Key': process.env.PRODIGI_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {})
    }
  });
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
  const client = supabaseAdmin();
  if (!client) return null;
  const { data, error } = await client
    .from('art_gallery_works')
    .select('id,title_en,description_en,pixel_width,pixel_height,published,review_status')
    .eq('id', artworkId)
    .eq('published', true)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, title: data.title_en || data.id, description: data.description_en || '', pixel_width: data.pixel_width, pixel_height: data.pixel_height, review_status: data.review_status };
}

async function findPrintAsset(artworkId) {
  if (typeof artworkId !== 'string' || !/^[a-z0-9-]+$/.test(artworkId)) return null;
  const client = supabaseAdmin();
  if (!client) return null;
  const { data, error } = await client
    .from('art_gallery_assets')
    .select('artwork_id,asset_role,bucket_name,object_path,mime_type,pixel_width,pixel_height,verified_at')
    .eq('artwork_id', artworkId)
    .in('asset_role', ['print', 'master']);
  if (error || !Array.isArray(data) || !data.length) return null;

  const ranked = data
    .filter(row => row.bucket_name === (process.env.ART_STORAGE_BUCKET || 'art-originals'))
    .filter(row => ['image/jpeg', 'image/png'].includes(String(row.mime_type || '').toLowerCase()) || /\.(jpe?g|png)$/i.test(row.object_path || ''))
    .sort((a, b) => {
      const role = row => row.asset_role === 'print' ? 2 : 1;
      const verified = row => row.verified_at ? 1 : 0;
      const pixels = row => Number(row.pixel_width || 0) * Number(row.pixel_height || 0);
      return role(b) - role(a) || verified(b) - verified(a) || pixels(b) - pixels(a);
    });
  return ranked[0] || null;
}

async function productDetails(sku) {
  const safe = cleanSku(sku);
  if (!safe) return null;
  try {
    const body = await prodigiRequest('/v4.0/products/' + encodeURIComponent(safe), { method: 'GET' });
    return body && body.product ? body.product : null;
  } catch (error) {
    if (error.status === 404 || error.status === 400) return null;
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
  if (!width || !height) return CANDIDATE_SKUS.slice(0, 6);
  const ratio = Math.min(width, height) / Math.max(width, height);
  return CANDIDATE_SKUS
    .map(sku => {
      const match = sku.match(/-(\d+)X(\d+)$/);
      const a = Number(match && match[1] || 1);
      const b = Number(match && match[2] || 1);
      return { sku, delta: Math.abs(ratio - Math.min(a, b) / Math.max(a, b)), area: a * b };
    })
    .sort((x, y) => x.delta - y.delta || x.area - y.area)
    .slice(0, 7)
    .map(item => item.sku);
}

async function eligibleProducts(artworkId, countryCode) {
  const country = cleanCountry(countryCode);
  if (!country || !prodigiConfigured()) return { asset: null, products: [] };
  const asset = await findPrintAsset(artworkId);
  if (!asset) return { asset: null, products: [] };
  const candidates = candidateSkusForAsset(asset);
  const details = await Promise.all(candidates.map(productDetails));
  const products = details.filter(Boolean).map(product => {
    const variant = variantForCountry(product, country);
    const required = resolutionForVariant(variant);
    return {
      sku: String(product.sku || '').toUpperCase(),
      description: String(product.description || 'Enhanced matte fine-art print'),
      dimensions: product.productDimensions || null,
      resolution: required,
      aspect_delta: aspectDelta(asset, product),
      quality_ok: fitsResolution(asset, required)
    };
  }).filter(product => product.sku && product.quality_ok && product.aspect_delta <= 0.035)
    .sort((a, b) => {
      const area = p => Number(p.dimensions && p.dimensions.width || 0) * Number(p.dimensions && p.dimensions.height || 0);
      return area(a) - area(b);
    });
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
  const artistFee = Math.max(0, Number(process.env.PRINT_ARTIST_FEE_CENTS || 5000));
  const roundTo = Math.max(100, Number(process.env.PRINT_ROUND_TO_CENTS || 500));
  const product = roundUp(wholesaleItems * multiplier + artistFee * quoteResult.quantity, roundTo);
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

async function signedPrintUrl(asset, expiresIn = 86400) {
  const client = supabaseAdmin();
  if (!client || !asset) return null;
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
        sizing: 'fillPrintArea',
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
  cleanCountry,
  cleanSku,
  prodigiEnvironment,
  prodigiConfigured,
  printCheckoutReady,
  findArtworkForPrint,
  findPrintAsset,
  productDetails,
  eligibleProducts,
  createQuote,
  retailFromQuote,
  submitOrder,
  findOrderByMerchantReference
};
