'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('admin UI and all dependencies are self-contained and expose no service key',()=>{
 const html=read('admin/index.html'),js=read('assets/js/admin.js'),config=read('assets/js/gallery-config.js'),css=read('assets/css/admin.css');
 for(const item of ['source-files','collection-default','style-default','review-list','upload-mode','catalog-list','login-form'])assert.ok(html.includes('id="'+item+'"'));
 assert.match(html,/noindex,nofollow/);
 assert.ok(!/SERVICE_ROLE_KEY|service_role/.test(js+config+html),'Admin must not expose server secrets');
 assert.match(js,/art_gallery_admin_users/);
 assert.match(js,/art-previews/);
 assert.match(js,/art-originals/);
 assert.match(js,/review_status:'pending'/);
 assert.match(js,/digital_available:false/);
 assert.match(js,/DecompressionStream/);
 assert.match(js,/collection_id:item.collection_id/);
 assert.match(css,/@media/);
 for(const script of ['assets/js/admin.js','assets/js/gallery-config.js','assets/js/collection-sync.js','assets/js/app.js','api/artwork-page.js']){
  const check=spawnSync(process.execPath,['--check',script],{cwd:root,encoding:'utf8'});
  assert.equal(check.status,0,script+': '+check.stderr);
 }
});
test('new artwork pages use dedicated route without rewriting stable existing /verk/ URLs',()=>{
 const vercel=JSON.parse(read('vercel.json'));
 assert.ok(vercel.rewrites.some(rule=>rule.source==='/artwork/:id/'&&rule.destination==='/api/artwork-page?id=:id'));
 assert.ok(!vercel.rewrites.some(rule=>rule.source.startsWith('/verk/')));
 const html=read('index.html'),app=read('assets/js/app.js'),builder=read('scripts/build-public.mjs');
 assert.ok(html.includes('/assets/js/gallery-config.js'));
 assert.match(app,/loadSupabaseCatalogue/);
 assert.match(app,/mergedCatalogue/);
 assert.match(app,/art\.dynamic\?'\/artwork\/'/);
 assert.match(builder,/['"]admin['"]/);
});
test('collection builder includes live manually selected categories',()=>{
 const builder=read('scripts/build-pages.mjs');
 assert.ok(builder.includes('/assets/js/collection-sync.js'));
 const sync=read('assets/js/collection-sync.js');
 assert.match(sync,/collection_id!==collection/);
 assert.match(sync,/admin-upload/);
 assert.match(sync,/admin-edit/);
});
