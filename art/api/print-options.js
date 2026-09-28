'use strict';
const {prodigiConfigured,prodigiEnvironment,printCheckoutReady,findArtworkForPrint,eligibleProducts}=require('./_lib/prodigi.cjs');

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
  const artworkId=typeof req.query?.artwork_id==='string'?req.query.artwork_id:'';
  const country=typeof req.query?.country==='string'?req.query.country.toUpperCase():'ES';
  if(!/^[a-z0-9-]+$/.test(artworkId)||!/^[A-Z]{2}$/.test(country))return res.status(400).json({error:'Invalid print request'});
  const artwork=await findArtworkForPrint(artworkId);
  if(!artwork)return res.status(404).json({error:'Artwork not found'});
  if(!prodigiConfigured())return res.status(200).json({configured:false,sales_enabled:false,environment:prodigiEnvironment(),products:[]});
  try{
    const {asset,products}=await eligibleProducts(artworkId,country);
    return res.status(200).json({
      configured:true,
      sales_enabled:printCheckoutReady(),
      environment:prodigiEnvironment(),
      artwork:{id:artwork.id,title:artwork.title},
      master_ready:!!asset,
      asset_source:asset&&asset.preview_fallback?'archive_preview':'master',
      products:products.map(product=>({
        sku:product.sku,
        description:product.description,
        dimensions:product.dimensions,
        recommended_resolution:product.resolution,
        fit_mode:product.fit_mode,
        quality:product.quality
      }))
    });
  }catch(error){
    console.error('Print options',error?.code||error?.message||'unknown');
    return res.status(502).json({error:'Print options are temporarily unavailable'});
  }
};
