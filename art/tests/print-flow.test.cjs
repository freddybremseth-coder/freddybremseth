'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const prodigi=require('../api/_lib/prodigi.cjs');

test('print flow keeps the full artwork and allows practical smaller formats',()=>{
 const quality=prodigi.fitQuality(
  {pixel_width:6002,pixel_height:7632},
  {width:2400,height:3000}
 );
 assert.ok(quality);
 assert.equal(quality.acceptable,true);
 assert.ok(quality.effective_ppi>=180);
 const source=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 assert.match(source,/sizing:\s*'fitPrintArea'/);
 assert.doesNotMatch(source,/aspect_delta\s*<=\s*0\.035/);
});

test('gallery exposes print buying and visible size cards before checkout',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8');
 assert.match(html,/id="print-size-options"/);
 assert.match(html,/id="print-quantity"/);
 assert.match(html,/Order fine-art print · choose size/);
 assert.match(app,/art-card-print/);
 assert.match(app,/selectPrintSku\(recommended\.sku,true\)/);
 assert.match(app,/print_session_id/);
 assert.match(css,/\.print-size-card/);
});

test('print API returns fit and quality guidance for each paper size',()=>{
 const handler=fs.readFileSync(path.join(root,'api/print-options.js'),'utf8');
 assert.match(handler,/fit_mode:product\.fit_mode/);
 assert.match(handler,/quality:product\.quality/);
});


test('legacy web previews can be measured safely but are not sold as premium mini prints',()=>{
 const small=prodigi.fitQuality(
  {pixel_width:1122,pixel_height:1402},
  {width:1200,height:1800}
 );
 const medium=prodigi.fitQuality(
  {pixel_width:1122,pixel_height:1402},
  {width:1500,height:2100}
 );
 assert.ok(small.effective_ppi>=280);
 assert.ok(medium.effective_ppi>=220);
 assert.ok(prodigi.CANDIDATE_SKUS.includes('GLOBAL-FAP-4X6'));
 assert.ok(prodigi.CANDIDATE_SKUS.includes('GLOBAL-FAP-5X7'));
 assert.equal(prodigi.MIN_FINE_ART_SHORT_SIDE_IN,8);
 assert.equal(prodigi.isCuratedFineArtProduct(prodigi.localProductForSku('GLOBAL-FAP-4X6',{pixel_width:1122,pixel_height:1402}),220),false);
});

test('archive print asset URLs are signed and point to the converter function',()=>{
 const oldUrl=process.env.SUPABASE_URL;
 const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://example.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-secret';
 const url=prodigi.previewPrintAssetUrl({artwork_id:'quiet-figure',preview_fallback:true},3600);
 assert.ok(url);
 const parsed=new URL(url);
 assert.equal(parsed.pathname,'/functions/v1/art-print-asset');
 assert.equal(parsed.searchParams.get('artwork_id'),'quiet-figure');
 assert.match(parsed.searchParams.get('sig')||'',/^[0-9a-f]{64}$/);
 if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
 if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
});

test('print options tell the gallery whether a master or archive preview is used',()=>{
 const handler=fs.readFileSync(path.join(root,'api/print-options.js'),'utf8');
 assert.match(handler,/asset_source:asset&&asset\.preview_fallback\?'archive_preview':'master'/);
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 assert.match(app,/web-size source/);
});


test('dynamic artwork pages expose print ordering and correct Stripe return path',()=>{
 const page=fs.readFileSync(path.join(root,'api/artwork-page.js'),'utf8');
 const client=fs.readFileSync(path.join(root,'assets/js/artwork-print.js'),'utf8');
 const checkout=fs.readFileSync(path.join(root,'api/create-print-checkout.js'),'utf8');
 assert.match(page,/artwork-print\.js/);
 assert.match(page,/data-artwork-print/);
 assert.match(page,/Order this artwork as a print/);
 assert.doesNotMatch(page,/Gallery preview only\. A high-resolution digital edition is not yet available for purchase\./);
 assert.match(client,/\/api\/print-options\?artwork_id=/);
 assert.match(client,/\/api\/print-quote/);
 assert.match(client,/\/api\/create-print-checkout/);
 assert.match(checkout,/artwork\.id\.startsWith\('art-'\)\?'\/artwork\/':'\/verk\/'/);
});


test('print catalogue can resolve published artworks without a Vercel Supabase URL',()=>{
 const source=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 assert.match(source,/PUBLIC_SUPABASE_URL = 'https:\/\/ereapsfcsqtdmzosgnnn\.supabase\.co'/);
 assert.match(source,/supabaseAdmin\(\) \|\| supabasePublic\(\)/);
 assert.doesNotMatch(source,/&& Boolean\(process\.env\.SUPABASE_URL\)/);
});

test('print asset discovery falls back to published preview metadata when private asset access is unavailable',()=>{
 const source=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 assert.match(source,/const client = supabaseAdmin\(\);\s*let data = null;/);
 assert.match(source,/asset_role: 'archive-preview'/);
 assert.match(source,/preview_fallback: true/);
});


test('dynamic artwork print flow explains the exact live checkout blocker',()=>{
 const options=fs.readFileSync(path.join(root,'api/print-options.js'),'utf8');
 const client=fs.readFileSync(path.join(root,'assets/js/artwork-print.js'),'utf8');
 assert.match(options,/checkout_status:printCheckoutStatus\(\)/);
 assert.match(client,/SANDBOX test mode/);
 assert.match(client,/STRIPE_WEBHOOK_SECRET/);
 assert.match(client,/SUPABASE_SERVICE_ROLE_KEY/);
 assert.match(client,/PRINT_SAMPLE_APPROVED/);
 assert.match(client,/PRINT_LEGAL_APPROVED/);
 assert.match(client,/PRINT_SALES_ENABLED/);
});


test('Prodigi print asset selection can use a higher-resolution private digital JPEG',()=>{
 const source=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 assert.match(source,/\['print', 'master', 'digital'\]/);
 assert.match(source,/pixels\(b\) - pixels\(a\)/);
});

test('Prodigi failures return safe actionable diagnostics',()=>{
 const options=fs.readFileSync(path.join(root,'api/print-options.js'),'utf8');
 const prodigiSource=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 const client=fs.readFileSync(path.join(root,'assets/js/artwork-print.js'),'utf8');
 assert.match(prodigiSource,/PRODIGI_TIMEOUT/);
 assert.match(options,/HTTP_\\d\{3\}/);
 assert.match(client,/Sandbox and Live API keys are separate/);
 assert.match(client,/rate-limiting size lookup/);
});


test('print size options are derived locally before Prodigi quote',()=>{
 const source=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 assert.match(source,/function localProductForSku\(/);
 assert.match(source,/dimensions: \{ width, height, units: 'in' \}/);
 const eligible=source.slice(source.indexOf('async function eligibleProducts'),source.indexOf('async function createQuote'));
 assert.doesNotMatch(eligible,/productDetailsBatch/);
 assert.doesNotMatch(eligible,/prodigiRequest/);
 assert.match(eligible,/qualityFloor = asset\.preview_fallback \? 220 : 200/);
});

test('2244x2804 artwork gets practical local print sizes without a catalogue request',()=>{
 const asset={pixel_width:2244,pixel_height:2804};
 const p4=prodigi.localProductForSku('GLOBAL-FAP-4X6',asset);
 const p8=prodigi.localProductForSku('GLOBAL-FAP-8X10',asset);
 const p16=prodigi.localProductForSku('GLOBAL-FAP-16X20',asset);
 assert.equal(p4.dimensions.width,4);
 assert.equal(p4.dimensions.height,6);
 assert.ok(p4.quality.effective_ppi>=300);
 assert.ok(p8.quality.effective_ppi>=270);
 assert.ok(p16.quality.effective_ppi<200);
});

test('quote endpoint returns safe Prodigi diagnostics after size selection',()=>{
 const quote=fs.readFileSync(path.join(root,'api/print-quote.js'),'utf8');
 const client=fs.readFileSync(path.join(root,'assets/js/artwork-print.js'),'utf8');
 assert.match(quote,/PRINT_NO_QUOTE/);
 assert.match(quote,/PRODIGI_UNKNOWN/);
 assert.match(client,/Prodigi rejected the API key/);
 assert.match(client,/does not currently offer a shipping quote/);
});


test('curated shop stays separate from the gallery purchase flow',()=>{
 const shop=fs.readFileSync(path.join(root,'shop/index.html'),'utf8');
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const dynamic=fs.readFileSync(path.join(root,'api/artwork-page.js'),'utf8');
 const builder=fs.readFileSync(path.join(root,'scripts/build-public.mjs'),'utf8');
 const pages=fs.readFileSync(path.join(root,'scripts/build-pages.mjs'),'utf8');
 assert.match(shop,/Art first\.<br><em>Objects second\.<\/em>/);
 assert.match(shop,/Fine-art prints/);
 assert.match(shop,/Framed art &amp; canvas/);
 assert.match(shop,/Art beyond the wall/);
 assert.match(shop,/no generic merchandise catalogue/i);
 assert.match(home,/href="\/shop\/"/);
 assert.match(dynamic,/href="\/shop\/"/);
 assert.match(builder,/['"]shop['"]/);
 assert.match(pages,/domain\+'\/shop\/'/);
});


test('gallery print dialog explains exact readiness blocker',()=>{
 const client=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 assert.match(client,/function printBlockerMessage/);
 assert.match(client,/SUPABASE_SERVICE_ROLE_KEY is missing from the Art Vercel project/);
 assert.match(client,/Prodigi Sandbox is working/);
 assert.match(client,/STRIPE_WEBHOOK_SECRET/);
 assert.match(client,/representative sample print still needs approval/);
 assert.match(client,/lastPrintOptions=data/);
 assert.match(client,/printBlockerMessage\(lastPrintOptions\)/);
});


test('Gilded Ruin source supports curated 8x10, 8x12 and 11x14 without cropping',()=>{
 const asset={pixel_width:2048,pixel_height:3072};
 const eligible=sku=>prodigi.isCuratedFineArtProduct(prodigi.localProductForSku(sku,asset),200);
 assert.equal(eligible('GLOBAL-FAP-4X6'),false);
 assert.equal(eligible('GLOBAL-FAP-5X7'),false);
 assert.equal(eligible('GLOBAL-FAP-8X10'),true);
 assert.equal(eligible('GLOBAL-FAP-8X12'),true);
 assert.equal(eligible('GLOBAL-FAP-11X14'),true);
 assert.equal(eligible('GLOBAL-FAP-12X16'),false);
});

test('fine-art retail floors rise with physical size and replace the fixed artist fee',()=>{
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-4X6'),0);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-8X10'),7900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-8X12'),7900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-11X14'),9900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-12X18'),11900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-16X24'),15900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-20X30'),19900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-24X36'),24900);
 assert.equal(prodigi.fineArtRetailFloorCents('GLOBAL-FAP-30X40'),32900);
 const oldMultiplier=process.env.PRINT_COST_MULTIPLIER;
 const oldRound=process.env.PRINT_ROUND_TO_CENTS;
 process.env.PRINT_COST_MULTIPLIER='2';process.env.PRINT_ROUND_TO_CENTS='500';
 const retail=prodigi.retailFromQuote({
  sku:'GLOBAL-FAP-8X12',quantity:1,
  quote:{shipmentMethod:'Standard',costSummary:{items:{amount:'10.00'},shipping:{amount:'9.00'}}}
 });
 assert.equal(retail.product_cents,7900);
 assert.equal(retail.shipping_cents,900);
 assert.equal(retail.total_cents,8800);
 if(oldMultiplier===undefined)delete process.env.PRINT_COST_MULTIPLIER;else process.env.PRINT_COST_MULTIPLIER=oldMultiplier;
 if(oldRound===undefined)delete process.env.PRINT_ROUND_TO_CENTS;else process.env.PRINT_ROUND_TO_CENTS=oldRound;
});

test('fine-art options enforce the curated minimum and moderate border tolerance',()=>{
 const source=fs.readFileSync(path.join(root,'api/_lib/prodigi.cjs'),'utf8');
 assert.match(source,/MIN_FINE_ART_SHORT_SIDE_IN = 8/);
 assert.match(source,/aspect_delta.*<= 0\.15/);
 assert.match(source,/isCuratedFineArtProduct/);
 const options=fs.readFileSync(path.join(root,'api/print-options.js'),'utf8');
 assert.match(options,/fine_art_min_short_side_in/);
 const dynamic=fs.readFileSync(path.join(root,'assets/js/artwork-print.js'),'utf8');
 assert.match(dynamic,/Fine-art editions start at 8 inches/);
 assert.match(dynamic,/SUPABASE_SERVICE_ROLE_KEY/);
});


test('print options imports every runtime symbol used in its response',()=>{
 const source=fs.readFileSync(path.join(root,'api/print-options.js'),'utf8');
 const importLine=source.match(/const \{([^}]+)\}=require\('\.\/_lib\/prodigi\.cjs'\);/);
 assert.ok(importLine,'print-options must import its Prodigi runtime dependencies');
 assert.match(importLine[1],/MIN_FINE_ART_SHORT_SIDE_IN/);
 const prodigi=require(path.join(root,'api/_lib/prodigi.cjs'));
 assert.equal(prodigi.MIN_FINE_ART_SHORT_SIDE_IN,8);
});
