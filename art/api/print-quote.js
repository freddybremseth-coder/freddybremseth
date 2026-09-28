'use strict';
const {printCheckoutReady,findArtworkForPrint,eligibleProducts,createQuote,retailFromQuote}=require('./_lib/prodigi.cjs');

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
  const input=req.body&&typeof req.body==='object'?req.body:{};
  const artworkId=String(input.artwork_id||'');
  const sku=String(input.sku||'').toUpperCase();
  const country=String(input.country||'').toUpperCase();
  const quantity=Math.max(1,Math.min(5,Number(input.quantity||1)));
  if(!/^[a-z0-9-]+$/.test(artworkId)||!/^GLOBAL-FAP-[0-9]+X[0-9]+$/.test(sku)||!/^[A-Z]{2}$/.test(country))return res.status(400).json({error:'Invalid print quote'});
  const artwork=await findArtworkForPrint(artworkId);
  if(!artwork)return res.status(404).json({error:'Artwork not found'});
  try{
    const eligible=await eligibleProducts(artworkId,country);
    const product=eligible.products.find(item=>item.sku===sku);
    if(!product)return res.status(409).json({error:'This size is not available for this artwork and destination'});
    const quoteResult=await createQuote({sku,countryCode:country,quantity});
    const retail=retailFromQuote(quoteResult);
    return res.status(200).json({
      artwork:{id:artwork.id,title:artwork.title},
      sku,
      quantity,
      country,
      description:product.description,
      dimensions:product.dimensions,
      shipping_method:retail.shipping_method,
      product_cents:retail.product_cents,
      shipping_cents:retail.shipping_cents,
      total_cents:retail.total_cents,
      currency:'eur',
      checkout_enabled:printCheckoutReady()
    });
  }catch(error){
    const code=String(error?.code||'PRODIGI_UNKNOWN');
    console.error('Print quote',code);
    const safeCode=/^PRODIGI_(?:HTTP_\d{3}|TIMEOUT|NETWORK_ERROR|NOT_CONFIGURED)$/.test(code)?code:(code==='PRINT_NO_QUOTE'?'PRINT_NO_QUOTE':'PRODIGI_UNKNOWN');
    return res.status(502).json({error:'A print and shipping quote could not be created',code:safeCode,environment:require('./_lib/prodigi.cjs').prodigiEnvironment()});
  }
};
