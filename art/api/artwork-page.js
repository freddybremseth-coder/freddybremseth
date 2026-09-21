'use strict';
const BASE='https://ereapsfcsqtdmzosgnnn.supabase.co';
const KEY="sb_publishable_KTywNu5kx3HfcOLInKOUjA_5Py79jZm";
const SITE='https://art.freddybremseth.com';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end()}
 const id=req.query?.id;
 if(typeof id!=='string'||!/^art-[a-z0-9-]{12,95}$/.test(id))return res.status(404).send('Artwork not found');
 try{
  const url=BASE+'/rest/v1/art_gallery_works?select=id,title_en,description_en,collection_id,style_id,public_preview_path,pixel_width,pixel_height,published&published=eq.true&id=eq.'+encodeURIComponent(id)+'&limit=1';
  const result=await fetch(url,{headers:{apikey:KEY},signal:AbortSignal.timeout(7000)});
  if(!result.ok)throw Error('Catalogue unavailable');
  const rows=await result.json(),art=rows[0];
  if(!art||!art.published||!art.public_preview_path||!art.public_preview_path.endsWith('.webp')||!art.public_preview_path.split('/').every(part=>/^[a-z0-9-]+(?:\.webp)?$/.test(part)))return res.status(404).send('Artwork not found');
  const image=BASE+'/storage/v1/object/public/art-previews/'+art.public_preview_path.split('/').map(encodeURIComponent).join('/');
  const canonical=SITE+'/artwork/'+encodeURIComponent(art.id)+'/';
  const name=art.title_en,desc=art.description_en||'A digital artwork by Freddy Bremseth.';
  const ld=JSON.stringify({'@context':'https://schema.org','@type':'VisualArtwork',name,description:desc,artform:'Digital art',creator:{'@type':'Person',name:'Freddy Bremseth'},image,url:canonical}).replace(/</g,'\\u003c');
  res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=120');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.status(200).setHeader('Content-Type','text/html; charset=utf-8');
  return res.end('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="index,follow,max-image-preview:large"><title>'+esc(name)+' — Freddy Bremseth Art</title><meta name="description" content="'+esc(desc)+'"><link rel="canonical" href="'+canonical+'"><meta property="og:type" content="article"><meta property="og:title" content="'+esc(name)+' — Freddy Bremseth Art"><meta property="og:description" content="'+esc(desc)+'"><meta property="og:image" content="'+esc(image)+'"><link rel="stylesheet" href="/assets/css/site.css"><script type="application/ld+json">'+ld+'</script></head><body><div class="announcement">Freddy Bremseth · Art Studio &amp; Gallery</div><header class="site-header"><a href="/" class="brand">FREDDY BREMSETH <small>ART STUDIO &amp; GALLERY</small></a><nav><a href="/#collection">All artworks</a><a href="/collections/'+encodeURIComponent(art.collection_id)+'/">Collection</a></nav></header><main class="collection-landing"><div class="collection-landing-inner"><nav class="collection-crumbs"><a href="/">Gallery</a> / <a href="/collections/'+encodeURIComponent(art.collection_id)+'/">'+esc(art.collection_id.replaceAll('-',' '))+'</a></nav><section class="collection-landing-hero"><div><p class="eyebrow">FREDDY BREMSETH ART · '+esc(art.style_id.replaceAll('-',' '))+'</p><h1>'+esc(name)+'</h1><p class="collection-landing-lede">'+esc(desc)+'</p><p>Gallery preview only. A high-resolution digital edition is not yet available for purchase.</p><a class="btn btn-dark" href="/#collection">Explore the entire gallery ↗</a></div><figure><img src="'+esc(image)+'" alt="'+esc(name)+'" width="'+Number(art.pixel_width)||1122+'" height="'+Number(art.pixel_height)||1402+'"><figcaption>Public gallery preview · High-resolution original held separately</figcaption></figure></section></div></main><footer class="footer"><a href="/">© Freddy Bremseth Art · Return to gallery</a></footer></body></html>');
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(503).send('Artwork catalogue temporarily unavailable')}
};
