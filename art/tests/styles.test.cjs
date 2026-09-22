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
const variantPairs=read('assets/curated-variants.json');
const curatedVariantIds=new Set(variantPairs.filter(row=>artworks.some(a=>a.id===row.variant_id)&&artworks.some(a=>a.id===row.primary_id)).map(row=>row.variant_id));
test('every unique artwork retains its existing style',()=>{
 assert.ok(artworks.length>=63);
 assert.equal(new Set(artworks.map(a=>a.id)).size,artworks.length);
 assert.equal(styles.length,12);
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
test('five featured collections and the separate studio archive cover every existing artwork',()=>{
 assert.equal(curation.collections.filter(c=>c.featured).length,5);
 assert.equal(curation.collections.length,6);
 assert.deepEqual(curation.collections.filter(c=>c.featured).map(c=>c.id),[
  'human-condition','words-that-matter','symbolic-street-art','mediterranean-soul','earth-and-emotion'
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
test('all published artwork titles use English display names with stable original slugs',()=>{
 const ids=new Set();
 for(const art of artworks){
  assert.equal(typeof art.title,'string');
  assert.ok(art.title.trim().length>3,'Missing title: '+art.id);
  assert.ok(art.title.split('').every(ch=>ch.codePointAt(0)>=32 && ch.codePointAt(0)<=126),'Title contains non-English characters: '+art.id+' ('+art.title+')');
  assert.ok(!ids.has(art.id),'Duplicate artwork ID: '+art.id);
  ids.add(art.id);
 }
});

test('six dedicated collections have complete indexable, mobile-friendly static pages',()=>{
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
  const works=artworks.filter(item=>collectionFor(item)===collection.id&&!curatedVariantIds.has(item.id));
  assert.ok(works.length>0);
  for(const art of works){
   const link='/verk/'+art.id+'/';
   assert.ok(html.includes('href="'+link+'"'),'Missing '+art.id+' in '+collection.id);
   assert.ok(!names.has(art.id),'Artwork appears in more than one collection: '+art.id);
   names.add(art.id);
  }
  assert.ok(!html.includes('/api/create-checkout'),'No standalone collection page should bypass secure checkout');
 }
 assert.equal(names.size,artworks.length-curatedVariantIds.size);
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
 assert.equal(artworks.length,123,'63 established works plus 50 imported works plus 10 individual Kintsugi previews');
 for(const [removed,kept] of Object.entries(pairs)){
  assert.ok(exclusions.includes(removed),'Duplicate must stay excluded: '+removed);
  assert.ok(pageIds.has(kept),'Established artwork must remain: '+kept);
  assert.ok(masterIds.has(kept),'Existing protected original must remain: '+kept);
  assert.ok(!pageIds.has(removed),'Repeated new preview must not be published: '+removed);
  const redirect=read('vercel.json').redirects.find(rule=>rule.source==='/verk/'+removed+'/');
  assert.ok(redirect,'Previously published duplicate artwork URL must redirect: '+removed);
  assert.equal(redirect.destination,'/verk/'+kept+'/');
  assert.equal(redirect.permanent,true);
  assert.ok(!fs.existsSync(path.join(root,'assets/art',removed+'-view.webp')),'Excluded view must not exist: '+removed);
  assert.ok(!fs.existsSync(path.join(root,'assets/art',removed+'-thumb.webp')),'Excluded thumbnail must not exist: '+removed);
 }
 const manifest=read('assets/new-import-manifest.json');
 assert.equal(manifest.length,50,'Deduplicated import manifest has 50 new artworks');
});
test('ten separate Kintsugi works appear in The Human Condition and Symbolic Realism as preview-only art',()=>{
 const manifest=read('assets/kintsugi-import-manifest.json');
 assert.equal(manifest.length,10);
 assert.equal(new Set(manifest.map(a=>a.id)).size,10);
 for(const item of manifest){
  const artwork=artworks.find(a=>a.id===item.id);
  assert.ok(artwork,'Missing Kintsugi artwork: '+item.id);
  assert.equal(artwork.title,item.title);
  assert.equal(artwork.style_id,'symbolic-realism');
  assert.equal(collectionFor(artwork),'human-condition');
  assert.equal(artwork.digital_available,false);
  assert.equal(artwork.price_cents,null);
  for(const prop of ['image','thumb']){
   assert.ok(artwork[prop].startsWith('/assets/art/kintsugi-2026-') && artwork[prop].endsWith('.webp'));
   assert.ok(fs.existsSync(path.join(root,artwork[prop].slice(1))));
  }
  assert.ok(fs.existsSync(path.join(root,'verk',item.id,'index.html')));
  const page=fs.readFileSync(path.join(root,'verk',item.id,'index.html'),'utf8');
  assert.ok(page.includes('<title>'+item.title+' — Freddy Bremseth Art</title>'));
  assert.ok(!page.includes('Digital edition €50.'));
 }
 const collectionPage=fs.readFileSync(path.join(root,'collections/human-condition/index.html'),'utf8');
 for(const art of manifest)assert.ok(collectionPage.includes('/verk/'+art.id+'/'));
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

test('Drømmetrappen til månen retains the full original horizontal composition in all gallery views',()=>{
 const art=artworks.find(item=>item.id==='drmmetrappen-til-manen');
 assert.ok(art,'Original artwork must remain in the catalogue');
 assert.equal(art.orientation,'Landscape');
 const image=fs.readFileSync(path.join(root,art.image.replace(/^\//,'')));
 const thumbnail=fs.readFileSync(path.join(root,art.thumb.replace(/^\//,'')));
 const webpSize=bytes=>{
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  const frame=bytes.indexOf(Buffer.from([0x9d,0x01,0x2a]));
  assert.ok(frame>=0,'Expected a valid VP8 frame header');
  return [bytes.readUInt16LE(frame+3)&0x3fff,bytes.readUInt16LE(frame+5)&0x3fff];
 };
 assert.deepEqual(webpSize(image),[1480,740]);
 assert.deepEqual(webpSize(thumbnail),[640,320]);
 assert.equal(art.width,1480);
 assert.equal(art.height,740);
 const css=fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8');
 const js=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 const page=fs.readFileSync(path.join(root,'verk',art.id,'index.html'),'utf8');
 const collection=fs.readFileSync(path.join(root,'collections','human-condition','index.html'),'utf8');
 assert.match(css,/\.art-card-landscape-feature[\s\S]*column-span:\s*all/);
 assert.match(css,/\.art-card-landscape-feature \.art-photo img[\s\S]*object-fit:\s*contain/);
 assert.match(css,/dialog\.landscape-artwork \.dialog-layout/);
 assert.match(js,/art\.id==='drmmetrappen-til-manen'\?' art-card-landscape-feature'/);
 assert.match(js,/dialog\.classList\.toggle\('landscape-artwork'/);
 assert.match(page,/class="art-card art-card-landscape-feature"/);
 assert.ok(collection.includes('class="art-card art-card-landscape-feature"'));
 assert.ok(collection.includes('src="'+art.image+'"'),'The large landscape card must use the full public preview');
 assert.ok(!collection.includes('src="'+art.thumb+'"'),'Do not upscale the tiny thumbnail to full panorama width');
});

test('Symbolic Street Art appears as a distinct navigable art style and curated collection',()=>{
 const style=styles.find(s=>s.id==='symbolic-street-art');
 const collection=curation.collections.find(c=>c.id==='symbolic-street-art');
 assert.equal(style.name,'Symbolic Street Art');
 assert.equal(style.count,3);
 assert.equal(collection.featured,true);
 for(const id of ["fargerikt-portrett-av-motstandskraft","kongelig-gatekunst-hap-smerte-og-kjrlighet","modig-dronning-i-fargerik-gatekunst"]){
  const art=artworks.find(a=>a.id===id);
  assert.equal(art.style_id,style.id);
  assert.equal(collectionFor(art),collection.id);
 }
 assert.ok(fs.readFileSync(path.join(root,'index.html'),'utf8').includes('href="/collections/symbolic-street-art/"'));
});

test('featured collection covers are unique and belong to their collections',()=>{
 const featured=curation.collections.filter(c=>c.featured);
 assert.equal(new Set(featured.map(c=>c.cover)).size,featured.length);
 for(const collection of featured){
  assert.ok(artworks.some(a=>a.thumb===collection.cover&&collectionFor(a)===collection.id),
    'Cover must be part of its own collection: '+collection.id);
 }
});
test('discovery gallery supports a varied shuffle on an undecorated background',()=>{
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 const css=fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8');
 assert.match(html,/id="remix-gallery"/);
 assert.match(html,/value="discover"/);
 assert.match(app,/function visualShuffle|const visualShuffle=/);
 assert.match(app,/sort:'discover'/);
 assert.match(app,/state\.mixSeed\+\+/);
 assert.match(css,/\.gallery-section\{background:#faf9f6\}/);
 assert.match(css,/\.gallery-section \.art-photo,\.collection-landing \.art-photo\{background:transparent\}/);
});

test('near-identical works share a single gallery card across collections without breaking detail URLs',()=>{
 const primary='en-roligere-lysere-verden';
 const variant='terrakottasolen-over-det-bla-landskapet';
 assert.ok(variantPairs.some(row=>row.variant_id===variant&&row.primary_id===primary));
 assert.equal(collectionFor(artworks.find(a=>a.id===primary)),'mediterranean-soul');
 assert.equal(collectionFor(artworks.find(a=>a.id===variant)),'mediterranean-soul');
 const human=fs.readFileSync(path.join(root,'collections/human-condition/index.html'),'utf8');
 const mediterranean=fs.readFileSync(path.join(root,'collections/mediterranean-soul/index.html'),'utf8');
 assert.ok(!human.includes('href="/verk/'+variant+'/"'));
 assert.ok(!human.includes('href="/verk/'+primary+'/"'));
 assert.ok(!mediterranean.includes('href="/verk/'+variant+'/"'));
 assert.ok(mediterranean.includes('href="/verk/'+primary+'/"'));
 for(const id of [primary,variant])assert.ok(fs.existsSync(path.join(root,'verk',id,'index.html')));
});
test('curated local variants are loaded when the live variants endpoint is unavailable',()=>{
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 assert.match(app,/curated-variants\\.json/);
 assert.match(app,/Using curated local variants/);
 const ids=new Set();
 for(const row of variantPairs){
  assert.ok(row.variant_id!==row.primary_id);
  assert.ok(!ids.has(row.variant_id));ids.add(row.variant_id);
 }
});
