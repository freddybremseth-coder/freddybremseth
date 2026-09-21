'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const catalog=JSON.parse(read('assets/catalog.json'));
const collection=JSON.parse(read('assets/collections.json'));
test('curated variant seeds correspond to existing gallery originals in the same collection',()=>{
 const pairs=[
  ['en-katedral-for-utbrente-drmmer','katedralen-av-uendelige-drmmer'],
  ['kart-over-minner-og-ruiner','kartografi-over-minner-og-ruiner'],
  ['forgylt-glasshjerte-med-blomster','knust-glasshjerte-med-gyldne-blomster'],
  ['kubistisk-kafe-med-drmmende-utsikt','kubistisk-kafescene-med-gitar-og-stilleben']
 ];
 const publicArchiveIds=new Set(['katedralen-av-uendelige-drmmer','kartografi-over-minner-og-ruiner']);
 for(const [main,variant] of pairs){
  const mainWork=catalog.find(a=>a.id===main);
  assert.ok(mainWork,main+' is in the canonical original catalog');
  const variantWork=catalog.find(a=>a.id===variant);
  assert.ok(variantWork||publicArchiveIds.has(variant),variant+' is in the public archived catalog');
  if(variantWork)assert.equal(
   collection.byArtworkId[main]||collection.byStyle[mainWork.style_id],
   collection.byArtworkId[variant]||collection.byStyle[variantWork.style_id],
   'variants remain within the same collection'
  );
 }
});
test('homepage groups only manually linked artwork IDs and preserves variant detail selection',()=>{
 const js=read('assets/js/app.js'),html=read('index.html'),css=read('assets/css/site.css');
 for(const marker of ['loadPublicVariantGroups','state.variantById','visibleArt()','familyFor(art.id)','renderVariants(art)','aria-pressed','openArt(relative,true)'])
  assert.ok(js.includes(marker),marker);
 assert.match(js,/state\.filtered=visibleArt\(\)\.filter/);
 assert.match(js,/\$\('art-count'\)\.textContent=visibleArt\(\)\.length/);
 assert.match(html,/id="art-variants"/);
 assert.match(css,/\.art-variants-choices/);
 assert.match(css,/\.art-variant-choice img[^}]*object-fit:contain/s);
});
test('individual collection pages and admin use the same explicit groups',()=>{
 const collectionSync=read('assets/js/collection-sync.js'),admin=read('assets/js/admin.js'),adminHTML=read('admin/index.html');
 assert.match(collectionSync,/art_gallery_variants/);
 assert.match(collectionSync,/old\?\.remove\(\)/);
 assert.match(collectionSync,/art-card-variant-count/);
 assert.match(admin,/function manageVariant\(work\)/);
 assert.match(admin,/function sameCollectionPrimaries\(work\)/);
 assert.match(admin,/function isVariant\(id\)/);
 assert.match(admin,/Show separately as its own artwork/);
 assert.match(admin,/variant_primary_id/);
 assert.match(admin,/method:'DELETE'/);
 assert.match(adminHTML,/source-files/);
 assert.ok(!/service_role|SUPABASE_SERVICE_ROLE_KEY/.test(admin), 'do not reveal private Supabase keys');
});
test('all edited gallery scripts remain syntactically valid',()=>{
 for(const file of ['assets/js/app.js','assets/js/admin.js','assets/js/collection-sync.js']){
  const run=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
  assert.equal(run.status,0,file+': '+run.stderr);
 }
});
