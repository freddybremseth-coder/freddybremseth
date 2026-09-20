const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const artworks=read('assets/catalog.json');
const styles=read('assets/styles.json');
const curation=read('assets/collections.json');
const collectionFor=art=>curation.byArtworkId[art.id]||curation.byStyle[art.style_id];
test('every unique artwork retains its existing style',()=>{
 assert.ok(artworks.length>=63);
 assert.equal(new Set(artworks.map(a=>a.id)).size,artworks.length);
 assert.equal(styles.length,11);
 for(const art of artworks){
  const style=styles.find(s=>s.id===art.style_id);
  assert.ok(style,'Missing style: '+art.id);
  assert.equal(art.category,style.name);
  assert.equal(typeof art.style_description,'string');
 }
 for(const style of styles){
  assert.equal(artworks.filter(a=>a.style_id===style.id).length,style.count);
  assert.ok(style.count>0);
 }
});
test('four featured collections and the separate studio archive cover every existing artwork',()=>{
 assert.equal(curation.collections.filter(c=>c.featured).length,4);
 assert.equal(curation.collections.length,5);
 assert.deepEqual(curation.collections.filter(c=>c.featured).map(c=>c.id),[
  'human-condition','words-that-matter','mediterranean-soul','earth-and-emotion'
 ]);
 assert.equal(curation.collections.find(c=>c.id==='studio-archive').featured,false);
 assert.ok(artworks.every(art=>curation.collections.some(c=>c.id===collectionFor(art))));
 for(const collection of curation.collections){
  assert.ok(artworks.some(art=>collectionFor(art)===collection.id),'Empty collection '+collection.id);
  assert.ok(fs.existsSync(path.join(root,collection.cover.replace(/^\//,''))));
 }
 for(const id of Object.keys(curation.byArtworkId))assert.ok(artworks.some(a=>a.id===id),'Unknown collection override '+id);
});
test('existing artwork URLs, protected masters and actual €50 digital price are preserved',()=>{
 const privateMasters=read('scripts/private-masters-manifest.json');
 assert.deepEqual(artworks.filter(a=>a.digital_available!==false).map(a=>a.id).sort(),privateMasters.map(a=>a.id).sort());
 for(const art of artworks){
  if(art.digital_available!==false){assert.equal(art.price_cents,5000);assert.equal(art.currency,'eur')}else{assert.equal(art.price_cents,null)}
  assert.ok(fs.existsSync(path.join(root,'verk',art.id,'index.html')));
 }
});
test('gallery controls use curated collections without inventing physical checkout',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 for(const id of ['collection-cards','categories','style-filter','orientation-filter','motif-filter','colour-filter','price-filter','art-sort','clear-filters','active-style-description']){
  assert.ok(html.includes('id="'+id+'"'),id);
 }
 assert.match(app,/collection_id/);
 assert.match(app,/curation\.byArtworkId/);
 assert.match(app,/state\.filtered\.filter\(a=>a\.collection_id===entry\.id\)/);
 assert.match(html,/Physical prints and unique hand-finished works are not yet on sale/);
 assert.ok(!html.includes('€5,000 original'));
});

test('new gallery previews have no advertised price or enabled paid checkout',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 const checkout=fs.readFileSync(path.join(root,'api/create-checkout.js'),'utf8');
 assert.match(html,/id="dialog-price-label"/);
 assert.match(app,/digital_available===false/);
 assert.match(app,/Edition not yet available/);
 assert.match(checkout,/art\.digital_available===false/);
 const previewOnly=artworks.filter(a=>a.digital_available===false);
 for(const art of previewOnly)assert.equal(art.price_cents,null);
});

test('retain the existing baroque artwork, exclude its renamed visual duplicate',()=>{
 const exclusions=read('assets/duplicate-exclusions.json').removed_ids;
 assert.ok(artworks.some(a=>a.id==='barokk-studie-med-musiker-og-vanitas-stilleben'));
 assert.ok(!artworks.some(a=>a.id==='barokk-studie-med-musikk-og-maneskinn'));
 assert.ok(exclusions.includes('barokk-studie-med-musikk-og-maneskinn'));
});
test('artwork titles use sentence-style capitalization except proper names',()=>{
 const allowed=new Set(['Freddys','Mediterranean']);
 for(const item of artworks){
  assert.equal(typeof item.title,'string');
  for(const token of item.title.trim().split(/\s+/).slice(1)){
   const clean=token.replace(/^[^\p{L}]+|[^\p{L}]+$/gu,'');
   if(clean && /^\p{Lu}/u.test(clean) && !allowed.has(clean)){
     assert.fail('Unexpected middle-of-title uppercase: '+item.id+' ('+item.title+')');
   }
  }
 }
});

test('five dedicated collections have complete indexable, mobile-friendly static pages',()=>{
 const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
 const homepage=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8');
 const names=new Set();
 for(const collection of curation.collections){
  assert.ok(/^[a-z0-9-]+$/.test(collection.id));
  const url='/collections/'+collection.id+'/';
  const html=fs.readFileSync(path.join(root,'collections',collection.id,'index.html'),'utf8');
  assert.match(html,new RegExp('<link rel="canonical" href="https://art\\.freddybremseth\\.com'+url+'">'));
  assert.match(sitemap,new RegExp('<loc>https://art\\.freddybremseth\\.com'+url+'</loc>'));
  assert.ok(homepage.includes('href="'+url+'"')||curation.collections.some(other=>other.id!==collection.id&&fs.readFileSync(path.join(root,'collections',other.id,'index.html'),'utf8').includes('href="'+url+'"')),'Collection is not linked from any gallery page: '+collection.id);
  assert.ok(html.includes('name="'+collection.name.replaceAll('&','&amp;')+'"')||html.includes('<h1>'+collection.name.replaceAll('&','&amp;')+'</h1>'));
  const works=artworks.filter(item=>collectionFor(item)===collection.id);
  assert.ok(works.length>0);
  for(const art of works){
   const link='/verk/'+art.id+'/';
   assert.ok(html.includes('href="'+link+'"'),'Missing '+art.id+' in '+collection.id);
   assert.ok(!names.has(art.id),'Artwork appears in more than one collection: '+art.id);
   names.add(art.id);
  }
  assert.ok(!html.includes('/api/create-checkout'),'No standalone collection page should bypass secure checkout');
 }
 assert.equal(names.size,artworks.length);
 assert.match(homepage,/class="collection-cards"/);
 assert.match(app,/\/collections\/.*collection\.id/);
 assert.match(css,/\.collection-landing-hero/);
 assert.match(css,/prefers-reduced-motion/);
});
test('editorial artwork view uses public preview only and preserves server checkout',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 assert.match(html,/id="art-zoom-dialog"/);
 assert.match(html,/id="dialog-related"/);
 assert.match(html,/id="dialog-collection-link"/);
 assert.match(app,/state\.selected\.image/);
 assert.match(app,/function fillRelated\(art\)/);
 assert.match(app,/function openZoom\(\)/);
 assert.match(app,/fetch\('\/api\/create-checkout'/);
 assert.match(html,/digitally created works developed with AI-assisted techniques/);
});

test('five repeated images are removed while original gallery artwork IDs remain canonical',()=>{
 const pairs={
  'impresjonistisk-hagefest-ved-innsjen':'impresjonistisk-hagefest-ved-elven',
  'romantisk-solnedgang-pa-verandaen':'melankolsk-solnedgang-ved-havet',
  'stormlys-over-det-gamle-fjordlandskapet':'vandreren-ved-det-stormfulle-fjordlandskapet',
  'modig-bykvinne-i-graffitiunivers':'modig-dronning-i-fargerik-gatekunst',
  'renessansebibliotek-med-lrde-og-solnedgang':'renessansestudie-med-symbolske-skatter'
 };
 const exclusions=read('assets/duplicate-exclusions.json').removed_ids;
 const masterIds=new Set(read('scripts/private-masters-manifest.json').map(item=>item.id));
 const pageIds=new Set(artworks.map(item=>item.id));
 assert.equal(artworks.length,113,'63 established works plus 50 unique imported works');
 for(const [removed,kept] of Object.entries(pairs)){
  assert.ok(exclusions.includes(removed),'Duplicate must stay excluded: '+removed);
  assert.ok(pageIds.has(kept),'Established artwork must remain: '+kept);
  assert.ok(masterIds.has(kept),'Existing protected original must remain: '+kept);
  assert.ok(!pageIds.has(removed),'Repeated new preview must not be published: '+removed);
  assert.ok(!fs.existsSync(path.join(root,'assets/art',removed+'-view.webp')),'Excluded view must not exist: '+removed);
  assert.ok(!fs.existsSync(path.join(root,'assets/art',removed+'-thumb.webp')),'Excluded thumbnail must not exist: '+removed);
 }
 const manifest=read('assets/new-import-manifest.json');
 assert.equal(manifest.length,50,'Deduplicated import manifest has 50 new artworks');
});
test('homepage hero image differs from every featured collection cover',()=>{
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const match=home.match(/id="hero-img-main"\s+src="([^"]+)"/);
 assert.ok(match,'Homepage hero is present');
 const hero=match[1];
 assert.ok(fs.existsSync(path.join(root,hero.replace(/^\//,''))),'Hero artwork has a real public preview');
 assert.ok(artworks.some(art=>art.image===hero),'Hero image belongs to the curated gallery');
 for(const collection of curation.collections.filter(item=>item.featured)){
  assert.notEqual(hero,collection.cover.replace('-thumb.webp','-view.webp'),
   'Hero artwork must not repeat the adjacent featured collection image: '+collection.name);
 }
 assert.ok(home.includes('<meta property="og:image" content="https://art.freddybremseth.com'+hero+'">'));
});
