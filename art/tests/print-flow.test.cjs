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
