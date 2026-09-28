'use strict';
const Stripe=require('stripe');
const {findArtworkForPrint,findPrintAsset,submitOrder,printCheckoutReady}=require('./_lib/prodigi.cjs');

async function rawBody(req){
  if(Buffer.isBuffer(req.body))return req.body;
  if(typeof req.body==='string')return Buffer.from(req.body);
  const chunks=[];
  for await(const chunk of req)chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).end()}
  if(!printCheckoutReady())return res.status(503).end();
  const signature=req.headers['stripe-signature'];
  if(typeof signature!=='string')return res.status(400).send('Missing signature');
  try{
    const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
    const payload=await rawBody(req);
    const event=stripe.webhooks.constructEvent(payload,signature,process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type!=='checkout.session.completed'&&event.type!=='checkout.session.async_payment_succeeded')return res.status(200).json({received:true});
    const incoming=event.data&&event.data.object;
    if(!incoming||incoming.metadata?.delivery!=='print')return res.status(200).json({received:true});
    const session=await stripe.checkout.sessions.retrieve(incoming.id);
    if(session.payment_status!=='paid')return res.status(200).json({received:true});
    const artworkId=session.metadata?.artwork_id;
    const sku=session.metadata?.prodigi_sku;
    const quantity=Math.max(1,Math.min(5,Number(session.metadata?.print_quantity||1)));
    const shippingMethod=session.metadata?.shipping_method||'Standard';
    const recipientCostCents=Math.max(0,Number(session.metadata?.print_product_cents||0));
    const artwork=await findArtworkForPrint(artworkId);
    const asset=await findPrintAsset(artworkId);
    if(!artwork||!asset||!sku)throw new Error('Print fulfillment metadata or master is missing');
    const order=await submitOrder({session,artwork,asset,sku,quantity,shippingMethod,recipientCostCents});
    if(order&&order.id){
      await stripe.checkout.sessions.update(session.id,{metadata:{prodigi_order_id:order.id}});
    }
    return res.status(200).json({received:true,prodigi_order_id:order&&order.id||null});
  }catch(error){
    console.error('Stripe print webhook',error?.type||error?.code||error?.message||'unknown');
    return res.status(400).send('Webhook error');
  }
}
module.exports=handler;
module.exports.config={api:{bodyParser:false}};
