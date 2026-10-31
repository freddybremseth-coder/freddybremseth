'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const prodigi = require('../api/_lib/prodigi.cjs');

test('sandbox print order builds the correct payload without contacting Stripe or Prodigi', async (t) => {
  const originalFetch = global.fetch;
  const names = ['PRODIGI_ENVIRONMENT', 'PRODIGI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PRINT_SALES_ENABLED', 'PRINT_SAMPLE_APPROVED', 'PRINT_LEGAL_APPROVED'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {
    global.fetch = originalFetch;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  });

  process.env.PRODIGI_ENVIRONMENT = 'sandbox';
  process.env.PRODIGI_API_KEY = 'mock-only-key';
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-only-signing-secret';
  process.env.PRINT_SALES_ENABLED = 'false';
  process.env.PRINT_SAMPLE_APPROVED = 'false';
  process.env.PRINT_LEGAL_APPROVED = 'false';

  let captured;
  global.fetch = async (url, options) => {
    captured = { url: String(url), options };
    return { ok: true, json: async () => ({ order: { id: 'mock-sandbox-order' } }) };
  };

  const artworkId = 'art-nouveau-dronning-med-iris-og-svaner';
  const sessionId = 'cs_test_mock_prodigi_payload_20261031';
  const result = await prodigi.submitOrder({
    session: {
      id: sessionId,
      customer_details: { name: 'Test Customer', email: 'print-test@example.invalid' },
      collected_information: {
        shipping_details: {
          name: 'Test Customer',
          address: { line1: 'Example Street 1', postal_code: '03000', city: 'Alicante', country: 'ES' }
        }
      }
    },
    artwork: { id: artworkId },
    asset: { artwork_id: artworkId, preview_fallback: true },
    sku: 'GLOBAL-FAP-16X20',
    quantity: 1,
    shippingMethod: 'Standard',
    recipientCostCents: 13900
  });

  assert.equal(result.id, 'mock-sandbox-order');
  assert.equal(captured.url, 'https://api.sandbox.prodigi.com/v4.0/orders');
  assert.equal(captured.options.method, 'POST');
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.merchantReference, 'FBART-' + sessionId);
  assert.equal(payload.idempotencyKey, 'freddy-art:' + sessionId);
  assert.equal(payload.recipient.address.countryCode, 'ES');
  assert.equal(payload.recipient.address.townOrCity, 'Alicante');
  assert.equal(payload.items[0].merchantReference, artworkId);
  assert.equal(payload.items[0].sku, 'GLOBAL-FAP-16X20');
  assert.equal(payload.items[0].copies, 1);
  assert.equal(payload.items[0].sizing, 'fitPrintArea');
  assert.equal(payload.items[0].recipientCost.amount, '139.00');
  assert.equal(payload.items[0].assets[0].printArea, 'default');
  const printUrl = new URL(payload.items[0].assets[0].url);
  assert.equal(printUrl.origin, 'https://example.supabase.co');
  assert.equal(printUrl.pathname, '/functions/v1/art-print-asset');
  assert.equal(printUrl.searchParams.get('artwork_id'), artworkId);
  assert.match(printUrl.searchParams.get('sig') || '', /^[a-f0-9]{64}$/);
  assert.equal(prodigi.printCheckoutReady(), false);
});
