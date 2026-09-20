import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const art=JSON.parse(fs.readFileSync(path.join(root,'assets/catalog.json'),'utf8'));
const masters=JSON.parse(fs.readFileSync(path.join(root,'scripts/private-masters-manifest.json'),'utf8'));
const purchasable=art.filter(item=>item.digital_available!==false);
if(art.length<50||masters.length!==purchasable.length)throw Error('Gallery or protected download mapping incomplete');
const styles=JSON.parse(fs.readFileSync(path.join(root,'assets/styles.json'),'utf8'));
if(styles.length<8||new Set(styles.map(s=>s.id)).size!==styles.length)throw Error('Invalid style groups');
const allowed=new Set(styles.map(s=>s.id));
const totals=new Map(styles.map(s=>[s.id,0]));
for(const item of art){if(!allowed.has(item.style_id))throw Error('Unclassified art '+item.id);const entry=styles.find(s=>s.id===item.style_id);if(item.category!==entry.name)throw Error('Wrong style label '+item.id);totals.set(item.style_id,totals.get(item.style_id)+1)}
for(const entry of styles)if(totals.get(entry.id)!==entry.count)throw Error('Style count mismatch '+entry.id);

const excluded=new Set(JSON.parse(fs.readFileSync(path.join(root,'assets/duplicate-exclusions.json'),'utf8')).removed_ids);
const ids=new Set();
for(const a of art){
 if(ids.has(a.id)||excluded.has(a.id))throw Error('Duplicate or excluded artwork '+a.id);ids.add(a.id);
 for(const variant of ['image','thumb']){const p=path.join(root,a[variant].replace(/^\//,''));if(!fs.existsSync(p)||fs.statSync(p).size<1000)throw Error('Missing public preview '+p)}
 const page=path.join(root,'verk',a.id,'index.html');if(!fs.existsSync(page))throw Error('Missing artwork page '+a.id);
 if(a.digital_available!==false){if(a.price_cents!==5000||a.currency!=='eur')throw Error('Invalid active digital price '+a.id)}
 else if(a.price_cents!==null)throw Error('Preview-only work must not advertise a purchasable price '+a.id);
}
for(const m of masters){if(!ids.has(m.id)||!/^[a-z0-9-]+\.(jpg|png)$/.test(m.storage_path))throw Error('Invalid protected master '+m.id);if(art.find(item=>item.id===m.id)?.digital_available===false)throw Error('Preview-only artwork should not have an authorized digital product '+m.id)}
const publicFiles=fs.readdirSync(path.join(root,'assets','art'));if(publicFiles.some(name=>!name.endsWith('.webp')))throw Error('A high-resolution master was accidentally placed in public art assets');
console.log('PASS: '+art.length+' works sorted into '+styles.length+' curated artistic styles, '+publicFiles.length+' public previews, canonical artwork pages, protected source mapping, verified active digital prices and preview-only availability');
