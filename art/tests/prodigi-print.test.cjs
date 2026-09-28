'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const prodigi=require('../api/_lib/prodigi.cjs');

test('Prodigi candidate catalogue keeps documented fine-art SKUs',()=>{
 assert.ok(prodigi.CANDIDATE_SKUS.includes('GLOBAL-FAP-10X10'));
 assert.ok(prodigi.CANDIDATE_SKUS.includes('GLOBAL-FAP-16X24'));
});

test('retail quote keeps shipping separate and rounds safely',()=>{
 const oldMultiplier=process.env.PRINT_COST_MULTIPLIER;
 const oldRound=process.env.PRINT_ROUND_TO_CENTS;
 process.env.PRINT_COST_MULTIPLIER='2';
 process.env.PRINT_ROUND_TO_CENTS='500';
 const price=prodigi.retailFromQuote({
  sku:'GLOBAL-FAP-8X10',
  quantity:1,
  quote:{shipmentMethod:'Standard',costSummary:{items:{amount:'12.34',currency:'EUR'},shipping:{amount:'4.21',currency:'EUR'}}}
 });
 assert.equal(price.product_cents,5900);
 assert.equal(price.shipping_cents,500);
 assert.equal(price.total_cents,6400);
 if(oldMultiplier===undefined)delete process.env.PRINT_COST_MULTIPLIER;else process.env.PRINT_COST_MULTIPLIER=oldMultiplier;
 if(oldRound===undefined)delete process.env.PRINT_ROUND_TO_CENTS;else process.env.PRINT_ROUND_TO_CENTS=oldRound;
});

test('live checkout fails closed unless production approvals and secrets exist',()=>{
 const keys=['PRINT_SALES_ENABLED','PRINT_SAMPLE_APPROVED','PRINT_LEGAL_APPROVED','PRODIGI_ENVIRONMENT','PRODIGI_API_KEY','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 for(const key of keys)delete process.env[key];
 process.env.PRODIGI_ENVIRONMENT='live';
 process.env.PRODIGI_API_KEY='test';
 process.env.STRIPE_SECRET_KEY='test';
 process.env.STRIPE_WEBHOOK_SECRET='test';
 process.env.SUPABASE_URL='https://example.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='test';
 process.env.PRINT_SALES_ENABLED='true';
 assert.equal(prodigi.printCheckoutReady(),false);
 process.env.PRINT_SAMPLE_APPROVED='true';
 process.env.PRINT_LEGAL_APPROVED='true';
 assert.equal(prodigi.printCheckoutReady(),true);
 for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}
});


test('timed percent campaign can create a real €49 introduction price without changing normal price',()=>{
 const keys=['PRINT_PROMOTION_MODE','PRINT_PROMOTION_PERCENT','PRINT_PROMOTION_LABEL','PRINT_PROMOTION_START','PRINT_PROMOTION_END','PRINT_COST_MULTIPLIER','PRINT_ROUND_TO_CENTS'];
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.PRINT_PROMOTION_MODE='percent';
 process.env.PRINT_PROMOTION_PERCENT='17';
 process.env.PRINT_PROMOTION_LABEL='Introduction Edition';
 process.env.PRINT_PROMOTION_START='2020-01-01T00:00:00Z';
 process.env.PRINT_PROMOTION_END='2099-12-31T23:59:59Z';
 process.env.PRINT_COST_MULTIPLIER='2';process.env.PRINT_ROUND_TO_CENTS='500';
 const price=prodigi.retailFromQuote({
  sku:'GLOBAL-FAP-8X10',quantity:1,
  quote:{shipmentMethod:'Standard',costSummary:{items:{amount:'10.00'},shipping:{amount:'4.21'}}}
 });
 assert.equal(price.normal_product_cents,5900);
 assert.equal(price.product_cents,4900);
 assert.equal(price.shipping_cents,500);
 assert.equal(price.total_cents,5400);
 assert.equal(price.discount_cents,1000);
 assert.equal(price.promotion.label,'Introduction Edition');
 for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}
});

test('timed free-shipping campaign passes zero delivery to the customer while retaining normal shipping reference',()=>{
 const keys=['PRINT_PROMOTION_MODE','PRINT_PROMOTION_START','PRINT_PROMOTION_END'];
 const before=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 process.env.PRINT_PROMOTION_MODE='free_shipping';
 process.env.PRINT_PROMOTION_START='2020-01-01T00:00:00Z';
 process.env.PRINT_PROMOTION_END='2099-12-31T23:59:59Z';
 const price=prodigi.retailFromQuote({
  sku:'GLOBAL-FAP-8X10',quantity:1,
  quote:{shipmentMethod:'Standard',costSummary:{items:{amount:'10.00'},shipping:{amount:'9.00'}}}
 });
 assert.equal(price.normal_shipping_cents,900);
 assert.equal(price.shipping_cents,0);
 assert.equal(price.total_cents,5900);
 assert.equal(price.discount_cents,900);
 for(const key of keys){if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key]}
});
