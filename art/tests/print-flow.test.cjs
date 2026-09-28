'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const prodigi=require('../api/_lib/prodigi.cjs');

test('print flow keeps the full artwork and allows practical smaller formats',()=>{
 const quality=prodigi.fitQuality(
  {pixel_width:1480,pixel_height:740},
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
