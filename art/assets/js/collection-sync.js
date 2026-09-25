(()=>{'use strict';
const cfg=window.ART_GALLERY_CONFIG;
if(!cfg?.url||!cfg?.anonKey)return;
const match=location.pathname.match(/^\/collections\/([a-z0-9-]+)\/?$/);
if(!match)return;
const collection=match[1],grid=document.querySelector('#collection-works .gallery-grid');
if(!grid)return;
const publicImage=path=>cfg.url+'/storage/v1/object/public/art-previews/'+path.split('/').map(encodeURIComponent).join('/');
const remoteLink=art=>/^art-[a-z0-9-]{12,95}$/.test(art.id)?'/artwork/'+art.id+'/':'/verk/'+art.id+'/';
function makeCard(art){
 const card=document.createElement('article');card.className='art-card';
 const a=document.createElement('a');a.href=remoteLink(art);
 const photo=document.createElement('span');photo.className='art-photo';
 const img=document.createElement('img');img.loading='lazy';img.alt=art.title_en;img.src=art.public_thumb_path?publicImage(art.public_thumb_path):art.legacy_thumb_url;
 img.width=art.pixel_width||1122;img.height=art.pixel_height||1402;photo.append(img);
 const meta=document.createElement('span');meta.className='art-card-meta';
 const info=document.createElement('span');const title=document.createElement('span');title.className='art-title';title.textContent=art.title_en;
 const style=document.createElement('span');style.className='art-category';style.textContent=art.style_id.replaceAll('-',' ')+' · Gallery preview';
 info.append(title,style);meta.append(info);a.append(photo,meta);card.append(a);return card;
}
(async()=>{
 const select='id,title_en,style_id,collection_id,public_thumb_path,legacy_thumb_url,pixel_width,pixel_height,source,published';
 const [res,groupsRes]=await Promise.all([
  fetch(cfg.url+'/rest/v1/art_gallery_works?select='+encodeURIComponent(select)+'&published=eq.true&limit=1000',{headers:{apikey:cfg.anonKey}}),
  fetch(cfg.url+'/rest/v1/art_gallery_variants?select=variant_id,primary_id,sort_order&limit=1000',{headers:{apikey:cfg.anonKey}}).catch(()=>null)
 ]);
 if(!res.ok)return;
 const rows=await res.json(),edited=rows.filter(art=>['admin-upload','admin-edit','admin-smart-zip'].includes(art.source));
 const variants=groupsRes?.ok?await groupsRes.json():[];
 const variantsById=new Map(variants.map(row=>[row.variant_id,row]));
 const variantsByPrimary=new Map();
 for(const row of variants){const list=variantsByPrimary.get(row.primary_id)||[];list.push(row);variantsByPrimary.set(row.primary_id,list)}

 for(const art of edited){
  if(!/^[a-z0-9-]+$/.test(art.id))continue;
  const old=[...grid.querySelectorAll('article.art-card')].find(card=>card.querySelector('a')?.getAttribute('href')?.includes('/'+art.id+'/'));
  if(variantsById.has(art.id)){old?.remove();continue}
  if(art.collection_id!==collection){old?.remove();continue}
  if(old)old.replaceWith(makeCard(art));else grid.append(makeCard(art));
 }
 // Legacy build-time collection cards must also respect the curated database
 // grouping, even when a variant was imported before the admin UI existed.
 for(const row of variants){
  const old=[...grid.querySelectorAll('article.art-card')].find(card=>{
   const href=card.querySelector('a')?.getAttribute('href')||'';
   return href==='/verk/'+row.variant_id+'/'||href==='/artwork/'+row.variant_id+'/';
  });
  old?.remove();
 }
 for(const [parentId,items] of variantsByPrimary){
  const parent=[...grid.querySelectorAll('article.art-card')].find(card=>{
   const href=card.querySelector('a')?.getAttribute('href')||'';
   return href==='/verk/'+parentId+'/'||href==='/artwork/'+parentId+'/';
  });
  if(!parent)continue;
  parent.querySelector('.art-card-variant-count')?.remove();
  const tag=document.createElement('span');tag.className='art-card-variant-count';
  tag.textContent='+'+items.length+' '+(items.length===1?'variant':'variants');
  parent.append(tag);
 }
 const total=grid.querySelectorAll('article.art-card').length;
 const count=document.querySelector('.collection-gallery-header p');if(count)count.textContent=total+' artworks · Physical prints are not on sale yet';
 const heroCount=document.getElementById('collection-work-count');if(heroCount)heroCount.textContent=String(total);
 const empty=document.getElementById('collection-empty-note');if(empty&&total)empty.remove();
 const figure=document.getElementById('collection-cover-figure'),hero=document.getElementById('collection-cover-img');
 if(figure?.dataset.autoCover==='true'&&hero){
  const candidate=edited.find(art=>art.collection_id===collection&&!variantsById.has(art.id)&&(art.public_thumb_path||art.legacy_thumb_url));
  if(candidate){
   hero.src=candidate.public_thumb_path?publicImage(candidate.public_thumb_path):candidate.legacy_thumb_url;
   hero.alt=candidate.title_en+' — selected work from this collection';
   figure.hidden=false;
  }
 }
})().catch(()=>{});
})();
