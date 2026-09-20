'use strict';
const Stripe=require('stripe');
const {createClient}=require('@supabase/supabase-js');
const {findArtwork,findMaster,PRICE_CENTS,baseUrl,ready}=require('./_lib/catalog.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 const base=baseUrl();
 // Browser requests must be from the configured gallery origin. This is not a substitute for server-side price verification.
 const origin=req.headers.origin;if(origin&&origin!==base)return res.status(403).json({error:'Unrecognized origin'});
 if(!ready())return res.status(503).json({error:'Digital sales are not yet configured'});
 if(Number(req.headers['content-length']||0)>2048)return res.status(413).json({error:'Request is too large'});
 const data=(req.body&&typeof req.body==='object')?req.body:JSON.parse(req.body||'{}');
 const art=findArtwork(data.artwork_id);const master=findMaster(data.artwork_id);
 if(!art||art.digital_available===false||!master)return res.status(400).json({error:'This artwork is not available for digital purchase'});
 if(data.digital_consent!==true)return res.status(400).json({error:'Digital delivery consent is required'});
 try{
  // Fail closed: never charge for an artwork whose purchased master is missing.
  const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:file,error:missing}=await storage.storage.from(process.env.ART_STORAGE_BUCKET||'art-originals').info(master.storage_path);
  if(missing||!file)return res.status(503).json({error:'The high-resolution original is not available for sale yet'});
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const session=await stripe.checkout.sessions.create({
   mode:'payment',customer_creation:'always',client_reference_id:art.id,
   line_items:[{price_data:{currency:'eur',unit_amount:PRICE_CENTS,tax_behavior:'inclusive',product_data:{name:'Digital artwork — '+art.title,description:'Personal-use digital artwork by Freddy Bremseth'}},quantity:1}],
   metadata:{artwork_id:art.id,license:'personal',delivery:'digital',digital_consent:'yes'},
   payment_intent_data:{metadata:{artwork_id:art.id,delivery:'digital'}},
   success_url:base+'/verk/'+encodeURIComponent(art.id)+'/?session_id={CHECKOUT_SESSION_ID}',
   cancel_url:base+'/verk/'+encodeURIComponent(art.id)+'/?checkout=cancelled',
   ...(process.env.STRIPE_AUTOMATIC_TAX==='true'?{automatic_tax:{enabled:true}}:{})
  });
  if(!session.url)return res.status(502).json({error:'Stripe did not return a checkout link'});
  return res.status(200).json({url:session.url});
 }catch(error){console.error('Art checkout:',error?.type||error?.code||'stripe_error');return res.status(502).json({error:'Secure checkout could not be started'})}
};
