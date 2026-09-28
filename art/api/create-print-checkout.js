'use strict';
const Stripe=require('stripe');
const {baseUrl}=require('./_lib/catalog.cjs');
const {printCheckoutReady,findArtworkForPrint,eligibleProducts,createQuote,retailFromQuote}=require('./_lib/prodigi.cjs');

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
  if(!printCheckoutReady())return res.status(503).json({error:'Print checkout is not live yet'});
  const input=req.body&&typeof req.body==='object'?req.body:{};
  const artworkId=String(input.artwork_id||'');
  const sku=String(input.sku||'').toUpperCase();
  const country=String(input.country||'').toUpperCase();
  const quantity=Math.max(1,Math.min(5,Number(input.quantity||1)));
  if(!/^[a-z0-9-]+$/.test(artworkId)||!/^GLOBAL-FAP-[0-9]+X[0-9]+$/.test(sku)||!/^[A-Z]{2}$/.test(country))return res.status(400).json({error:'Invalid print checkout'});
  const base=baseUrl();if(!base)return res.status(503).json({error:'Site checkout is not configured'});
  const artwork=await findArtworkForPrint(artworkId);
  if(!artwork)return res.status(404).json({error:'Artwork not found'});
  try{
    const eligible=await eligibleProducts(artworkId,country);
    const product=eligible.products.find(item=>item.sku===sku);
    if(!product)return res.status(409).json({error:'This size is not available for this artwork and destination'});
    const quoteResult=await createQuote({sku,countryCode:country,quantity});
    const retail=retailFromQuote(quoteResult);
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const session=await stripe.checkout.sessions.create({
      mode:'payment',
      customer_creation:'always',
      client_reference_id:artwork.id,
      shipping_address_collection:{allowed_countries:[country]},
      line_items:[
        {price_data:{currency:'eur',unit_amount:retail.product_cents,tax_behavior:'inclusive',product_data:{name:'Fine-art print — '+artwork.title,description:product.description}},quantity:1},
        ...(retail.shipping_cents>0?[{price_data:{currency:'eur',unit_amount:retail.shipping_cents,tax_behavior:'inclusive',product_data:{name:'Print shipping',description:retail.shipping_method+' delivery via Prodigi'}},quantity:1}]:[])
      ],
      metadata:{
        artwork_id:artwork.id,
        delivery:'print',
        prodigi_sku:sku,
        print_quantity:String(quantity),
        destination_country:country,
        shipping_method:retail.shipping_method,
        print_product_cents:String(retail.product_cents),
        print_total_cents:String(retail.total_cents)
      },
      payment_intent_data:{metadata:{artwork_id:artwork.id,delivery:'print',prodigi_sku:sku}},
      success_url:base+'/verk/'+encodeURIComponent(artwork.id)+'/?print_session_id={CHECKOUT_SESSION_ID}',
      cancel_url:base+'/verk/'+encodeURIComponent(artwork.id)+'/?print_checkout=cancelled',
      ...(process.env.STRIPE_AUTOMATIC_TAX==='true'?{automatic_tax:{enabled:true}}:{})
    });
    if(!session.url)return res.status(502).json({error:'Stripe did not return a checkout link'});
    return res.status(200).json({url:session.url});
  }catch(error){
    console.error('Print checkout',error?.type||error?.code||error?.message||'unknown');
    return res.status(502).json({error:'Secure print checkout could not be started'});
  }
};
