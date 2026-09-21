'use strict';
const URL_ROOT='https://ereapsfcsqtdmzosgnnn.supabase.co';
const KEY="sb_publishable_KTywNu5kx3HfcOLInKOUjA_5Py79jZm";
const SITE='https://art.freddybremseth.com';
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end()}
 try{
  const url=URL_ROOT+'/rest/v1/art_gallery_works?select=id,updated_at&published=eq.true&source=in.(admin-upload,admin-edit)&order=created_at.asc&limit=1000';
  const result=await fetch(url,{headers:{apikey:KEY},signal:AbortSignal.timeout(7000)});
  if(!result.ok)throw Error('Gallery catalogue unavailable');
  const rows=await result.json();
  const urls=rows.filter(row=>/^art-[a-z0-9-]{12,95}$/.test(row.id)).map(row=>
   '<url><loc>'+SITE+'/artwork/'+row.id+'/</loc><lastmod>'+String(row.updated_at||'').slice(0,10)+'</lastmod></url>').join('\n');
  res.setHeader('Content-Type','application/xml; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=300, stale-while-revalidate=3600');
  return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls+'\n</urlset>');
 }catch(e){res.setHeader('Cache-Control','no-store');return res.status(503).send('Sitemap temporarily unavailable')}
};
