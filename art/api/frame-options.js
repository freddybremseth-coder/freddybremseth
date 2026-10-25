'use strict';
// Read-only framed-product discovery. Never makes framed SKUs orderable.
const {prodigiConfigured,findArtworkForPrint,findPrintAsset,eligibleProducts,productDetails}=require('./_lib/prodigi.cjs');
const FRAME_SERIES=[
 {kind:'classic',prefix:'GLOBAL-CFP-',label:'Classic wooden frame'},
 {kind:'aluminium',prefix:'GLOBAL-FRA-ALU-',label:'Aluminium frame'}
];
const cache=new Map();
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const artworkId=typeof req.query?.artwork_id==='string'?req.query.artwork_id:'';
 const country=typeof req.query?.country==='string'?req.query.country.toUpperCase():'ES';
 if(!/^[a-z0-9-]+$/.test(artworkId)||!/^[A-Z]{2}$/.test(country))return res.status(400).json({error:'Invalid request'});
 if(!prodigiConfigured())return res.status(200).json({configured:false,frames:[],orderable:false});
 const artwork=await findArtworkForPrint(artworkId);
 if(!artwork)return res.status(404).json({error:'Artwork not found'});
 const asset=await findPrintAsset(artworkId);
 if(!asset)return res.status(200).json({configured:true,frames:[],orderable:false,reason:'print_master_unavailable'});
 try{
  const eligible=await eligibleProducts(artworkId,country);
  const sizes=eligible.products.slice(0,4).map(p=>p.sku.replace(/^GLOBAL-FAP-/,''));
  const requests=FRAME_SERIES.flatMap(series=>sizes.map(size=>({series,sku:series.prefix+size})));
  const resolved=await Promise.all(requests.map(async request=>{
   const key=country+':'+request.sku;
   const cached=cache.get(key);if(cached&&cached.exp>Date.now())return cached.value;
   try{
    const product=await productDetails(request.sku);
    const variants=Array.isArray(product?.variants)?product.variants:[];
    const eligibleVariants=variants.filter(v=>Array.isArray(v.shipsTo)&&v.shipsTo.includes(country));
    const colors=[...new Set(eligibleVariants.map(v=>v.attributes?.color||v.attributes?.frameColour).filter(c=>typeof c==='string'&&c.length<=32))];
    const dimensions=product?.productDimensions||null;
    const result=product&&eligibleVariants.length?{
     sku:request.sku,kind:request.series.kind,label:request.series.label,
     dimensions,colors,description:String(product.description||'').slice(0,180)
    }:null;
    cache.set(key,{value:result,exp:Date.now()+30*60*1000});return result;
   }catch(error){return null}
  }));
  return res.status(200).json({configured:true,orderable:false,frames:resolved.filter(Boolean),note:'Catalogue discovery only; checkout and pricing for framed products are not enabled.'});
 }catch(error){
  console.error('Frame catalogue lookup failed',String(error?.code||'unknown'));
  return res.status(502).json({error:'Framed catalogue temporarily unavailable',frames:[],orderable:false});
 }
};
