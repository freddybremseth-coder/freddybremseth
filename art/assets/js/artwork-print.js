(()=>{'use strict';
 const root=document.querySelector('[data-artwork-print]');
 if(!root)return;
 const artworkId=root.dataset.artworkId||'';
 if(!/^[a-z0-9-]+$/.test(artworkId))return;
 const $=id=>document.getElementById(id);
 const money=cents=>'€'+(Number(cents||0)/100).toFixed(2);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const dimensionData=product=>{
  const d=product?.dimensions||{},w=Number(d.width||0),h=Number(d.height||0),units=String(d.units||'in').toLowerCase();
  if(!w||!h)return {primary:'Print size',secondary:'',max:0};
  const trim=n=>Number.isInteger(n)?String(n):n.toFixed(1).replace(/\.0$/,'');
  if(units==='in'||units==='inch'||units==='inches')return {primary:trim(w)+' × '+trim(h)+' in',secondary:Math.round(w*2.54)+' × '+Math.round(h*2.54)+' cm',max:Math.max(w,h)};
  if(units==='mm')return {primary:trim(w/10)+' × '+trim(h/10)+' cm',secondary:trim(w/25.4)+' × '+trim(h/25.4)+' in',max:Math.max(w,h)/25.4};
  if(units==='cm')return {primary:trim(w)+' × '+trim(h)+' cm',secondary:trim(w/2.54)+' × '+trim(h/2.54)+' in',max:Math.max(w,h)/2.54};
  return {primary:trim(w)+' × '+trim(h)+' '+units,secondary:'',max:Math.max(w,h)};
 };
 let quote=null,readiness=null;
 function setMessage(message,type=''){
  const node=$('artwork-print-message');node.textContent=message;node.dataset.state=type;
 }
 function selectSize(sku,autoQuote=true){
  $('artwork-print-sku').value=sku||'';
  for(const button of root.querySelectorAll('[data-sku]')){
   const on=button.dataset.sku===sku;
   button.classList.toggle('active',on);
   button.setAttribute('aria-pressed',String(on));
  }
  quote=null;$('artwork-print-quote').hidden=true;$('artwork-print-buy').hidden=true;
  if(autoQuote&&sku)void updateQuote();
 }
 async function loadOptions(){
  const country=$('artwork-print-country').value;
  const host=$('artwork-print-sizes');host.innerHTML='<p class="print-size-loading">Finding available print sizes…</p>';
  setMessage('Checking print sizes and delivery for this artwork…');
  try{
   const response=await fetch('/api/print-options?artwork_id='+encodeURIComponent(artworkId)+'&country='+encodeURIComponent(country),{headers:{Accept:'application/json'}});
   const data=await response.json();
   if(!response.ok){
    let message=data.error||'Print sizes are unavailable';
    if(data.code==='PRODIGI_HTTP_401'||data.code==='PRODIGI_HTTP_403')message='Prodigi rejected the API key for '+String(data.environment||'this').toUpperCase()+' environment. The Sandbox and Live API keys are separate.';
    else if(data.code==='PRODIGI_HTTP_429')message='Prodigi is rate-limiting size lookup. Please try again.';
    else if(data.code==='PRODIGI_TIMEOUT'||data.code==='PRODIGI_NETWORK_ERROR')message='Prodigi did not answer the size request in time. Please try again.';
    else if(data.code==='PRODIGI_CATALOG_UNAVAILABLE')message='Prodigi could not return the print catalogue for this artwork right now.';
    throw Error(message);
   }
   readiness=data.checkout_status||null;
   if(!data.configured){host.innerHTML='<p class="print-size-empty">Print ordering is temporarily unavailable.</p>';setMessage('Print ordering is temporarily unavailable.');return}
   if(!Array.isArray(data.products)||!data.products.length){
    const needsMaster=data.asset_source==='archive_preview';
    host.innerHTML='<p class="print-size-empty">'+(needsMaster?'A larger Print Master is required for this artwork.':'No curated fine-art size is available for this destination yet.')+'</p>';
    setMessage(needsMaster?'This artwork currently has only a web-size source available to the print service. Fine-art editions start at 8 inches on the shortest paper side; add the private Print Master to unlock larger formats.':'No curated fine-art size is available for this destination yet.');
    return
   }
   host.replaceChildren();
   for(const product of data.products){
    const dims=dimensionData(product);
    const button=document.createElement('button');button.type='button';button.className='print-size-card';button.dataset.sku=product.sku;button.setAttribute('aria-pressed','false');
    button.innerHTML='<span class="print-size-tier">'+(dims.max<=12?'Fine art':dims.max<=20?'Medium':dims.max<=30?'Large':'Statement')+'</span><strong>'+esc(dims.primary)+'</strong>'+(dims.secondary?'<span>'+esc(dims.secondary)+'</span>':'')+'<small>'+esc(product.quality?.label||'Fine-art print')+'</small>';
    button.addEventListener('click',()=>selectSize(product.sku,true));host.appendChild(button);
   }
   const chosen=data.products.find(p=>p.quality?.recommended&&dimensionData(p).max>=14&&dimensionData(p).max<=24)
    ||data.products.find(p=>p.quality?.recommended)
    ||data.products[0];
   setMessage(data.asset_source==='archive_preview'
    ?'This artwork is temporarily using a web-size source. Add the private Print Master to unlock the full fine-art range.'
    :data.asset_source==='private_master_metadata'
      ?'Private Print Master found. Sandbox is sizing this artwork from its '+data.products.length+' eligible fine-art format'+(data.products.length===1?'':'s')+'. Live fulfilment remains locked until private storage access is connected.'
      :'Choose a fine-art size to see the complete print and shipping price. Editions start at 8 inches on the shortest paper side.');
   selectSize(chosen.sku,true);
  }catch(error){
   host.innerHTML='<p class="print-size-empty">Print sizes are temporarily unavailable.</p>';setMessage(error.message||'Print ordering is temporarily unavailable.','error');
  }
 }
 async function updateQuote(){
  const sku=$('artwork-print-sku').value;if(!sku)return;
  const quantity=Math.max(1,Math.min(5,Number($('artwork-print-quantity').value||1)));
  setMessage('Calculating print and shipping…');
  try{
   const response=await fetch('/api/print-quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artwork_id:artworkId,sku,country:$('artwork-print-country').value,quantity})});
   const data=await response.json();
   if(!response.ok){
    let message=data.error||'Price unavailable';
    if(data.code==='PRODIGI_HTTP_401'||data.code==='PRODIGI_HTTP_403')message='Prodigi rejected the API key for '+String(data.environment||'this').toUpperCase()+' environment. The Sandbox and Live API keys are separate.';
    else if(data.code==='PRODIGI_HTTP_429')message='Prodigi is rate-limiting the price request. Please try again.';
    else if(data.code==='PRODIGI_TIMEOUT'||data.code==='PRODIGI_NETWORK_ERROR')message='Prodigi did not answer the price request in time. Please try again.';
    else if(data.code==='PRINT_NO_QUOTE')message='Prodigi does not currently offer a shipping quote for this size and destination. Choose another size.';
    throw Error(message);
   }
   quote=data;
   const summary=$('artwork-print-quote');
   summary.innerHTML='<strong>'+esc(data.description||'Fine-art print')+'</strong><span>Print'+(quantity>1?' × '+quantity:'')+' '+money(data.product_cents)+'</span><span>'+esc(data.shipping_method||'Standard')+' shipping '+money(data.shipping_cents)+'</span><b>Total '+money(data.total_cents)+'</b>';
   summary.hidden=false;
   const buy=$('artwork-print-buy');buy.hidden=false;buy.disabled=!data.checkout_enabled;
   buy.textContent=data.checkout_enabled?'Buy this print securely ↗':'Online checkout is not live yet';
   let lockedMessage='Print size and price are available, but customer checkout has not been switched to live production yet.';
   if(!data.checkout_enabled&&readiness){
    if(readiness.environment!=='live'&&!readiness.private_storage)lockedMessage='Prodigi Sandbox is working, but this Art deployment still lacks SUPABASE_SERVICE_ROLE_KEY. Add it to let Sandbox size the artwork from its private Print Master; Live customer purchases also require PRODIGI_ENVIRONMENT=live and a Prodigi Live API key.';
    else if(readiness.environment!=='live')lockedMessage='Prodigi is connected in SANDBOX test mode. Sizes and prices work, but real customer purchases require PRODIGI_ENVIRONMENT=live and a Prodigi Live API key.';
    else if(!readiness.stripe)lockedMessage='Prodigi is live, but the Stripe server key is missing from the Art Vercel project.';
    else if(!readiness.webhook)lockedMessage='Prodigi and Stripe are connected, but STRIPE_WEBHOOK_SECRET is still missing for print fulfilment.';
    else if(!readiness.private_storage)lockedMessage='Print checkout still needs SUPABASE_SERVICE_ROLE_KEY in the Art Vercel project to access the private print master.';
    else if(!readiness.sample_approved)lockedMessage='Live production is connected, but PRINT_SAMPLE_APPROVED is still false.';
    else if(!readiness.legal_approved)lockedMessage='Live production is connected, but PRINT_LEGAL_APPROVED is still false.';
    else if(!readiness.sales_enabled)lockedMessage='Everything is connected, but PRINT_SALES_ENABLED is still false.';
   }
   setMessage(data.checkout_enabled?'Secure checkout by Stripe. Production starts only after payment is confirmed.':lockedMessage,data.checkout_enabled?'ready':'locked');
  }catch(error){quote=null;$('artwork-print-quote').hidden=true;$('artwork-print-buy').hidden=true;setMessage(error.message||'Price unavailable','error')}
 }
 async function checkout(){
  if(!quote)return;
  const button=$('artwork-print-buy');button.disabled=true;button.textContent='Opening secure checkout…';
  try{
   const response=await fetch('/api/create-print-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artwork_id:artworkId,sku:quote.sku,country:quote.country,quantity:quote.quantity||1})});
   const data=await response.json();if(!response.ok||typeof data.url!=='string'||!data.url.startsWith('https://checkout.stripe.com/'))throw Error(data.error||'Checkout unavailable');
   location.assign(data.url);
  }catch(error){setMessage(error.message||'Checkout unavailable','error');button.disabled=false;button.textContent='Buy this print securely ↗'}
 }
 async function showOrderStatus(sessionId){
  setMessage('Payment received. Checking your print order…');
  try{
   const response=await fetch('/api/print-order-status?session_id='+encodeURIComponent(sessionId),{headers:{Accept:'application/json'}});
   const data=await response.json();
   if(response.status===202){setMessage(data.status||'Payment confirmed. Your print order is being prepared.','ready');return}
   if(!response.ok)throw Error(data.error||'Order status unavailable');
   setMessage('Payment confirmed. Your print order has been submitted'+(data.stage?' · '+data.stage:'')+'.','ready');
  }catch(error){setMessage(error.message||'Payment was received. Keep your Stripe confirmation while the print order is checked.','error')}
 }
 $('artwork-print-country').addEventListener('change',()=>void loadOptions());
 $('artwork-print-quantity').addEventListener('change',()=>{if($('artwork-print-sku').value)void updateQuote()});
 $('artwork-print-buy').addEventListener('click',checkout);
 const params=new URLSearchParams(location.search),session=params.get('print_session_id');
 if(session&&/^cs_(test_|live_)?[a-zA-Z0-9_]+$/.test(session))void showOrderStatus(session);
 void loadOptions();
})();