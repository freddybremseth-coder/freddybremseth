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


test('archive previews qualify for safe small-format printing',()=>{
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
 assert.match(app,/archived work is offered only in small formats/);
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
