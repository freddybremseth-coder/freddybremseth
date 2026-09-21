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
 const res=await fetch(cfg.url+'/rest/v1/art_gallery_works?select='+encodeURIComponent(select)+'&published=eq.true&limit=1000',{headers:{apikey:cfg.anonKey}});
 if(!res.ok)return;
 const rows=await res.json(),edited=rows.filter(art=>['admin-upload','admin-edit'].includes(art.source));
 for(const art of edited){
  if(!/^[a-z0-9-]+$/.test(art.id))continue;
  const old=[...grid.querySelectorAll('article.art-card')].find(card=>card.querySelector('a')?.getAttribute('href')?.includes('/'+art.id+'/'));
  if(art.collection_id!==collection){old?.remove();continue}
  if(old)old.replaceWith(makeCard(art));else grid.append(makeCard(art));
 }
 const total=grid.querySelectorAll('article.art-card').length;
 const count=document.querySelector('.collection-gallery-header p');if(count)count.textContent=total+' artworks · Physical prints are not on sale yet';
})().catch(()=>{});
})();
