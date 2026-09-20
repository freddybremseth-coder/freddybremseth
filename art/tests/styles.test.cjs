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
 assert.deepEqual(artworks.map(a=>a.id).sort(),privateMasters.map(a=>a.id).sort());
 for(const art of artworks){
  assert.equal(art.price_cents,5000);assert.equal(art.currency,'eur');
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
