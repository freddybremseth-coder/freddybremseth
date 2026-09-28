'use strict';
const Stripe=require('stripe');
const {findOrderByMerchantReference}=require('./_lib/prodigi.cjs');

module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
  const id=req.query?.session_id;
  if(typeof id!=='string'||id.length>255||!/^cs_(?:test_|live_)?[a-zA-Z0-9_]+$/.test(id))return res.status(400).json({error:'Invalid Stripe session'});
  try{
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const session=await stripe.checkout.sessions.retrieve(id);
    if(session.metadata?.delivery!=='print'||session.payment_status!=='paid')return res.status(403).json({error:'No verified paid print purchase'});
    const order=await findOrderByMerchantReference('FBART-'+session.id);
    if(!order)return res.status(202).json({paid:true,submitted:false,status:'Payment confirmed. Preparing your print order.'});
    const shipments=Array.isArray(order.shipments)?order.shipments.map(shipment=>({
      status:shipment.status||null,
      tracking_url:shipment.tracking&&shipment.tracking.url||null,
      tracking_number:shipment.tracking&&shipment.tracking.number||null
    })):[];
    return res.status(200).json({
      paid:true,
      submitted:true,
      prodigi_order_id:order.id,
      stage:order.status&&order.status.stage||null,
      issues:order.status&&Array.isArray(order.status.issues)?order.status.issues:[],
      shipments
    });
  }catch(error){
    console.error('Print order status',error?.type||error?.code||error?.message||'unknown');
    return res.status(502).json({error:'Unable to verify the print order right now'});
  }
};
