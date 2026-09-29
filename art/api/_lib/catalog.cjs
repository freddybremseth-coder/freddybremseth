'use strict';
const {createClient}=require('@supabase/supabase-js');
const artworks=require('../../assets/catalog.json');
const masters=require('../../scripts/private-masters-manifest.json');
const byId=new Map(artworks.map(a=>[a.id,a]));
const masterById=new Map(masters.map(m=>[m.id,m]));
const PRICE_CENTS=5000;
function findArtwork(id){return typeof id==='string'?byId.get(id):undefined}
function findMaster(id){return typeof id==='string'?masterById.get(id):undefined}
function baseUrl(){const s=process.env.SITE_URL||'';let u;try{u=new URL(s)}catch{return null}if(u.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&u.hostname==='localhost'))return null;return u.origin}
function ready(){return process.env.DIGITAL_SALES_ENABLED==='true'&&!!(process.env.STRIPE_SECRET_KEY&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&baseUrl())}

function adminClient(){
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return null;
 return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}

async function findDigitalPurchase(id){
 const staticArt=findArtwork(id),staticMaster=findMaster(id);
 if(staticArt&&staticArt.digital_available!==false&&staticMaster){
  return {art:{id:staticArt.id,title:staticArt.title,digital_available:true},master:{storage_path:staticMaster.storage_path,bucket_name:process.env.ART_STORAGE_BUCKET||'art-originals'}};
 }
 if(typeof id!=='string'||!/^art-[a-z0-9-]{12,95}$/.test(id))return null;
 const client=adminClient();if(!client)return null;
 const {data:work,error:workError}=await client.from('art_gallery_works').select('id,title_en,digital_available,published').eq('id',id).eq('published',true).eq('digital_available',true).maybeSingle();
 if(workError||!work)return null;
 const {data:assets,error:assetError}=await client.from('art_gallery_assets').select('asset_role,bucket_name,object_path,mime_type,pixel_width,pixel_height').eq('artwork_id',id).eq('bucket_name','art-originals').in('asset_role',['digital','master']);
 if(assetError||!Array.isArray(assets))return null;
 const safe=assets.filter(asset=>['image/jpeg','image/png'].includes(String(asset.mime_type||'').toLowerCase())&&asset.object_path);
 safe.sort((a,b)=>{
  const role=x=>x.asset_role==='digital'?2:x.asset_role==='master'?1:0;
  const pixels=x=>Number(x.pixel_width||0)*Number(x.pixel_height||0);
  return role(b)-role(a)||pixels(b)-pixels(a);
 });
 const asset=safe[0];if(!asset)return null;
 return {art:{id:work.id,title:work.title_en,digital_available:true},master:{storage_path:asset.object_path,bucket_name:asset.bucket_name||'art-originals'}};
}
module.exports={artworks,masters,PRICE_CENTS,findArtwork,findMaster,findDigitalPurchase,baseUrl,ready};
