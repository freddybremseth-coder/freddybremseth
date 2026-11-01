'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const prodigi = require('../api/_lib/prodigi.cjs');

test('private print master signs the correct storage object and blocks failed signing', async (t) => {
  const oldLoad = Module._load;
  const oldFetch = global.fetch;
  const names = ['PRODIGI_ENVIRONMENT', 'PRODIGI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PRINT_SALES_ENABLED'];
  const oldEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
  t.after(() => {
    Module._load = oldLoad;
    global.fetch = oldFetch;
    for (const name of names) {
      if (oldEnv[name] === undefined) delete process.env[name];
      else process.env[name] = oldEnv[name];
    }
  });
  process.env.PRODIGI_ENVIRONMENT = 'sandbox';
  process.env.PRODIGI_API_KEY = 'fake-test-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-service-key';
  process.env.PRINT_SALES_ENABLED = 'false';

  const artworkId = 'art-nouveau-dronning-med-iris-og-svaner';
  const objectPath = artworkId + '/6a895fbd-0a10-4f0d-9758-637d808ea7a3/print.jpg';
  const signedUrl = 'https://example.supabase.co/storage/v1/object/sign/art-originals/print.jpg?token=mock';
  let signCalls = 0;
  let failSigning = false;
  let submissions = 0;
  Module._load = function(request, parent, isMain) {
    if (request === '@supabase/supabase-js') return {
      createClient: () => ({
        storage: { from: bucket => {
          assert.equal(bucket, 'art-originals');
          return { createSignedUrl: async (path, duration) => {
            signCalls++;
            assert.equal(path, objectPath);
            assert.equal(duration, 86400);
            return failSigning
              ? { data: null, error: { message: 'mock signing failure' } }
              : { data: { signedUrl }, error: null };
          } };
        } }
      })
    };
    return oldLoad.call(this, request, parent, isMain);
  };
  let payload;
  global.fetch = async (url, options) => {
    submissions++;
    assert.equal(String(url), 'https://api.sandbox.prodigi.com/v4.0/orders');
    payload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ order: { id: 'mock-private-master-order' } }) };
  };
  const args = {
    session: {
      id: 'cs_test_private_master_20261031',
      customer_details: { name: 'Test Customer', email: 'test@example.invalid' },
      collected_information: { shipping_details: {
        name: 'Test Customer',
        address: { line1: 'Example Street 1', postal_code: '03000', city: 'Alicante', country: 'ES' }
      } }
    },
    artwork: { id: artworkId },
    asset: { artwork_id: artworkId, asset_role: 'print', bucket_name: 'art-originals', object_path: objectPath, pixel_width: 4724, pixel_height: 5905 },
    sku: 'GLOBAL-FAP-16X20',
    quantity: 1,
    shippingMethod: 'Standard',
    recipientCostCents: 13900
  };
  const result = await prodigi.submitOrder(args);
  assert.equal(result.id, 'mock-private-master-order');
  assert.equal(signCalls, 1);
  assert.equal(submissions, 1);
  assert.equal(payload.items[0].assets[0].url, signedUrl);
  assert.equal(payload.items[0].merchantReference, artworkId);
  assert.equal(payload.items[0].sku, args.sku);
  assert.equal(payload.idempotencyKey, 'freddy-art:' + args.session.id);
  assert.equal(prodigi.printCheckoutReady(), false);

  failSigning = true;
  await assert.rejects(prodigi.submitOrder(args), { code: 'PRINT_ASSET_UNAVAILABLE' });
  assert.equal(signCalls, 2);
  assert.equal(submissions, 1, 'failed signing must not submit an order');
});
