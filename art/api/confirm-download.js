'use strict';
const Stripe=require('stripe');
const {createClient}=require('@supabase/supabase-js');
const {findArtwork,findMaster,PRICE_CENTS,ready}=require('./_lib/catalog.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store, private');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 if(!ready())return res.status(503).json({error:'Downloads are not configured yet'});
 const id=req.query?.session_id;
 if(typeof id!=='string'||id.length>255||!/^cs_(?:test_|live_)?[a-zA-Z0-9_]+$/.test(id))return res.status(400).json({error:'Invalid Stripe session'});
 try{
  const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
  const session=await stripe.checkout.sessions.retrieve(id);
  const artworkId=session.metadata?.artwork_id;
  const art=findArtwork(artworkId);const master=findMaster(artworkId);
  if(!art||!master||session.client_reference_id!==artworkId||session.metadata?.delivery!=='digital'||session.mode!=='payment'||session.payment_status!=='paid'||session.currency!=='eur'||session.amount_total!==PRICE_CENTS){return res.status(403).json({error:'No verified paid purchase for this artwork'})}
  const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await storage.storage.from(process.env.ART_STORAGE_BUCKET||'art-originals').createSignedUrl(master.storage_path,300,{download:'Freddy_Bremseth_'+art.id+'.'+master.storage_path.split('.').pop()});
  if(error||!data?.signedUrl){console.error('Missing private art master',art.id,error?.message);return res.status(503).json({error:'Payment verified but artwork file is not ready. Keep your confirmation link and contact the gallery.',payment_verified:true})}
  return res.status(200).json({title:art.title,download_url:data.signedUrl,expires_in_seconds:300});
 }catch(error){console.error('Art download:',error?.type||error?.code||'payment_check_error');return res.status(502).json({error:'Unable to verify payment right now; please retry using your Stripe confirmation link'})}
};
