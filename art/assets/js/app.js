(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const state={art:[],styles:[],collections:[],filtered:[],count:18,category:'all',style:'all',orientation:'all',motif:'all',colour:'all',price:'all',search:'',sort:'collection',selected:null,lang:'en',checkout:false,print:{byArtworkId:{},defaultPrintUrl:''}};
 const copy={en:{all:'All styles',loading:'Loading the gallery…',results:'artworks',more:'View more artworks ↓',buy:'Buy digital edition · €50 ↗',unavailable:'Digital checkout opening soon',agree:'Please accept the digital delivery terms first.',checkoutError:'Checkout is temporarily unavailable. No payment was taken.',pending:'Confirming your payment…',paid:'Payment confirmed. Your download is available below.',failed:'This payment has not yet been confirmed. You have not been charged by this page.',fileMissing:'Your payment was verified, but the file is not yet ready. Please keep the Stripe confirmation link and contact the gallery.',download:'Download artwork ↓'},no:{all:'Alle stiler',loading:'Laster galleriet…',results:'kunstverk',more:'Vis flere kunstverk ↓',buy:'Kjøp digital utgave · €50 ↗',unavailable:'Digital betaling åpner snart',agree:'Godta vilkårene for digital levering først.',checkoutError:'Betaling er midlertidig utilgjengelig. Ingen betaling er gjennomført.',pending:'Kontrollerer betalingen…',paid:'Betalingen er bekreftet. Du kan laste ned kunstverket.',failed:'Betalingen er ennå ikke bekreftet. Du er ikke belastet av denne siden.',fileMissing:'Betalingen er bekreftet, men filen er ennå ikke tilgjengelig. Ta vare på Stripe-lenken og kontakt galleriet.',download:'Last ned kunstverket ↓'}};
 const text=key=>copy[state.lang][key];
 const showToast=s=>{const node=$('toast');node.textContent=s;node.classList.add('on');clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>node.classList.remove('on'),4600)};
 const safeLink=x=>{try{const u=new URL(x);return (u.protocol==='https:'||u.protocol==='http:')?u.toString():null}catch{return null}};
 const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const detailHref=art=>'/verk/'+encodeURIComponent(art.id)+'/';
 const currentSlug=()=>{const m=location.pathname.match(/^\/verk\/([a-z0-9-]+)\/?$/);return m?m[1]:null};
 const collectionName=art=>state.collections.find(c=>c.id===art.collection_id)?.name||'Studio Archive';
 const byCollection=(a,b)=>state.collections.findIndex(c=>c.id===a.collection_id)-state.collections.findIndex(c=>c.id===b.collection_id)||a.number-b.number;
 const cards=(arts)=>{const frag=document.createDocumentFragment();for(const art of arts){const card=document.createElement('article');card.className='art-card'+(art.id==='drmmetrappen-til-manen'?' art-card-landscape-feature':'');const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','View '+art.title);button.innerHTML=`<span class="art-photo"><img loading="lazy" src="${art.thumb}" alt="${escapeHtml(art.title)}, ${escapeHtml(art.category)} digital artwork" width="${art.width}" height="${art.height}"><span class="art-overlay">Explore artwork ↗</span></span><span class="art-card-meta"><span><span class="art-title">${escapeHtml(art.title)}</span><span class="art-category">${escapeHtml(collectionName(art))} · ${art.digital_available===false?'Gallery preview':`€${(art.price_cents/100).toFixed(0)} digital`}</span></span><span class="art-number">${String(art.number).padStart(3,'0')}</span></span>`;button.addEventListener('click',()=>openArt(art,true));card.appendChild(button);frag.appendChild(card)}return frag};
 function setCollection(category){
  if(category!=='all'&&!state.collections.some(c=>c.id===category))return;
  state.category=category;state.count=18;render();
  $('collection').scrollIntoView({behavior:'smooth',block:'start'});
 }
 function makeCollections(){
  const host=$('categories');host.replaceChildren();
  const all=document.createElement('button');all.type='button';all.className='chip';all.dataset.category='all';all.textContent='All collections ('+state.art.length+')';host.appendChild(all);
  for(const collection of state.collections){const button=document.createElement('button');button.type='button';button.className='chip';button.dataset.category=collection.id;button.textContent=collection.name+' ('+state.art.filter(a=>a.collection_id===collection.id).length+')';host.appendChild(button)}
  const styleSelect=$('style-filter');styleSelect.replaceChildren(new Option('All artistic styles','all'));
  for(const style of state.styles){if(state.art.some(a=>a.style_id===style.id))styleSelect.add(new Option(style.name,style.id))}
  const cardsHost=$('collection-cards');cardsHost.replaceChildren();
  for(const collection of state.collections.filter(c=>c.featured)){
   const count=state.art.filter(a=>a.collection_id===collection.id).length;
   const button=document.createElement('a');button.href='/collections/'+encodeURIComponent(collection.id)+'/';button.className='collection-tile';
   const image=document.createElement('img');image.src=collection.cover;image.alt='Artwork preview for '+collection.name;image.loading='lazy';
   const text=document.createElement('span');text.className='collection-tile-copy';
   const title=document.createElement('strong');title.textContent=collection.name;
   const intro=document.createElement('span');intro.textContent=collection.description;
   const total=document.createElement('small');total.textContent=count+' artworks · Explore collection ↗';
   text.append(title,intro,total);button.append(image,text);cardsHost.appendChild(button);
  }
 }
 // Selective discovery cues. Only label motifs and palettes supported by artwork titles.
 // An untagged artwork still appears in its collection and in "All" results.
 function cuesFor(art){
  const id=art.id;
  const motifs=[];
  if(/kvinne|ansikt|portrett|dronning|gudinne|barn|byste|musiker|kyss|menneske|skikkelse|vandreren/.test(id))motifs.push('people');
  if(/hav|sol|landskap|innsj|fjord|hage|kyst|terrasse|blomst|natur|botanisk|vann|elven|leopard|svaner/.test(id))motifs.push('nature');
  if(/portal|drer|doren|katedral|kafe|kabinett|vindu|speil|trapp|stigen/.test(id))motifs.push('architecture');
  if(art.style_id==='abstract')motifs.push('abstract');
  const colours=[];
  if(/gull|gyld|forgylt|solnedgang|terrakotta/.test(id))colours.push('gold');
  if(/bla|hav|fjord|vann|innsj|kyst/.test(id))colours.push('blue');
  if(/graffiti|fargerik|neon|malerstorm|gatekunst/.test(id))colours.push('vivid');
  if(/grnt|botanisk|blomst|natur/.test(id))colours.push('green');
  if(/jord|sediment|teksturert|marmor/.test(id))colours.push('earth');
  return {motifs,colours};
 }
 function priceMatches(art){
  if(state.price==='all')return true;
  if(art.digital_available===false||art.price_cents==null)return false;
  const value=art.price_cents/100;
  if(state.price==='under-100')return value<100;
  if(state.price==='100-500')return value>=100&&value<500;
  if(state.price==='500-1500')return value>=500&&value<1500;
  if(state.price==='1500-5000')return value>=1500&&value<=5000;
  return true;
 }
 function render(){
  const collection=state.collections.find(c=>c.id===state.category);
  state.filtered=state.art.filter(art=>(!collection||art.collection_id===collection.id)
   &&(state.style==='all'||art.style_id===state.style)
   &&(state.orientation==='all'||art.orientation===state.orientation)
   &&(state.motif==='all'||cuesFor(art).motifs.includes(state.motif))
   &&(state.colour==='all'||cuesFor(art).colours.includes(state.colour))
   &&priceMatches(art)
   &&(!state.search||(art.title+' '+art.category+' '+art.story+' '+art.style_description+' '+collectionName(art)).toLocaleLowerCase().includes(state.search)));
  const grid=$('gallery');grid.replaceChildren();
  const grouped=state.category==='all'&&state.sort==='collection';
  grid.classList.toggle('gallery-grouped',grouped);
  for(const chip of $('categories').querySelectorAll('.chip')){const active=chip.dataset.category===state.category;chip.classList.toggle('active',active);chip.setAttribute('aria-pressed',String(active))}
  $('result-count').textContent=state.filtered.length+' artworks'+(collection?' · '+collection.name:grouped?' · four signature collections + studio archive':'');
  $('active-style-description').textContent=collection?collection.description:'Four signature collections plus our studio archive. Refine by style, motif, selective colour cues, orientation, price or title.';
  $('load-more').hidden=true;
  if(grouped){
   const narrowed=!!(state.search||state.style!=='all'||state.orientation!=='all'||state.motif!=='all'||state.colour!=='all'||state.price!=='all');
   for(const entry of state.collections){
    const works=state.filtered.filter(a=>a.collection_id===entry.id);if(!works.length)continue;
    const section=document.createElement('section');section.className='style-group';section.id='collection-'+entry.id;section.setAttribute('aria-label',entry.name);
    const heading=document.createElement('div');heading.className='style-group-heading';const h=document.createElement('h3');h.textContent=entry.name;
    const summary=document.createElement('p');summary.textContent=entry.description;
    const top=document.createElement('div');top.append(h,summary);
    const open=document.createElement('a');open.className='style-browse';open.href='/collections/'+encodeURIComponent(entry.id)+'/';open.textContent='View all '+works.length+' artworks ↗';
    heading.append(top,open);section.appendChild(heading);
    const segment=document.createElement('div');segment.className='style-group-grid gallery-grid';segment.appendChild(cards(narrowed?works:works.slice(0,4)));section.appendChild(segment);grid.appendChild(section);
   }
  }else{
   const sorted=[...state.filtered];
   if(state.sort==='az')sorted.sort((a,b)=>a.title.localeCompare(b.title));
   else if(state.sort==='za')sorted.sort((a,b)=>b.title.localeCompare(a.title));
   else if(state.sort==='price-low')sorted.sort((a,b)=>(a.price_cents===null)-(b.price_cents===null)||(a.price_cents??Infinity)-(b.price_cents??Infinity)||byCollection(a,b));
   else if(state.sort==='price-high')sorted.sort((a,b)=>(a.price_cents===null)-(b.price_cents===null)||(b.price_cents??-Infinity)-(a.price_cents??-Infinity)||byCollection(a,b));
   else sorted.sort(byCollection);
   const segment=document.createElement('div');segment.className='gallery-grid';segment.appendChild(cards(sorted.slice(0,state.count)));grid.appendChild(segment);
   $('load-more').hidden=state.count>=sorted.length;
  }
  $('load-more').textContent=text('more');
  $('no-results').hidden=state.filtered.length!==0;
 }
 function printLinkFor(art){return safeLink(state.print.byArtworkId?.[art.id]||state.print.defaultPrintUrl||art.print_url)}
 function updateBuy(){const btn=$('checkout-button');const available=state.selected?.digital_available!==false;btn.disabled=!available||!state.checkout||!$('digital-consent').checked;btn.textContent=!available?'Edition not yet available':state.checkout?text('buy'):text('unavailable')}
 function fillRelated(art){
  const host=$('dialog-related');host.replaceChildren();
  const relatives=state.art.filter(candidate=>candidate.id!==art.id&&candidate.collection_id===art.collection_id).slice(0,3);
  $('dialog-collection-link').href='/collections/'+encodeURIComponent(art.collection_id)+'/';
  $('dialog-collection-link').textContent='Browse '+collectionName(art)+' ↗';
  for(const relative of relatives){
   const link=document.createElement('a');link.href=detailHref(relative);
   const image=document.createElement('img');image.src=relative.thumb;image.alt=relative.title;image.loading='lazy';
   const caption=document.createElement('span');caption.textContent=relative.title;
   link.append(image,caption);host.appendChild(link);
  }
  $('dialog-related').closest('.dialog-related').hidden=relatives.length===0;
 }
 let zoom=1;
 function setZoom(next){
  zoom=Math.max(1,Math.min(3,Math.round(next*2)/2));
  const image=$('zoom-image');
  image.style.width=zoom===1?'auto':zoom*100+'%';
  image.style.maxWidth=zoom===1?'100%':'none';
  image.style.maxHeight=zoom===1?'100%':'none';
  $('zoom-level').textContent=Math.round(zoom*100)+'%';
  $('zoom-out').disabled=zoom<=1;$('zoom-in').disabled=zoom>=3;
 }
 function openZoom(){
  if(!state.selected)return;
  const preview=$('zoom-image');preview.src=state.selected.image;preview.alt=state.selected.title+' — gallery preview';
  $('zoom-title').textContent=state.selected.title+' · Public gallery preview';
  setZoom(1);const dialog=$('art-zoom-dialog');if(!dialog.open)dialog.showModal();
 }
 function openArt(art,push){state.selected=art;$('dialog-image').src=art.image;$('dialog-image').alt=art.title;$('dialog-title').textContent=art.title;$('dialog-index').textContent='ARTWORK / '+String(art.number).padStart(3,'0');$('dialog-category').textContent=art.category;$('dialog-collection').textContent=collectionName(art)+(art.digital_available===false?' · Gallery preview':' · Digital artwork €'+(art.price_cents/100).toFixed(0));$('dialog-story').textContent=art.story;$('dialog-edition').textContent=art.edition;$('dialog-size').textContent=art.width+' × '+art.height+' px (public preview source)';$('digital-consent').checked=false;const forSale=art.digital_available!==false;$('digital-consent').closest('.consent').hidden=!forSale;const label=$('dialog-price-label');label.textContent=forSale?'Digital edition':'Gallery preview · Not yet for sale';if(forSale){const strong=document.createElement('strong');strong.textContent='€'+(art.price_cents/100).toFixed(0);label.appendChild(strong)}$('checkout-help').textContent=forSale?'Secure checkout by Stripe · The full-size file is not publicly accessible.':'This work is displayed for viewing. No paid download or physical edition has been configured.';updateBuy();fillRelated(art);const url=printLinkFor(art);$('print-link').hidden=!url;$('print-placeholder').hidden=!!url;if(url)$('print-link').href=url;
  if(push&&location.pathname!==detailHref(art))history.pushState({art:art.id},'',detailHref(art));
  const dialog=$('art-dialog');dialog.classList.toggle('landscape-artwork',art.id==='drmmetrappen-til-manen');if(!dialog.open)dialog.showModal();document.title=art.title+' — Freddy Bremseth Art';}
 function closeArt(){const lightbox=$('art-zoom-dialog');if(lightbox.open)lightbox.close();const dialog=$('art-dialog');if(dialog.open)dialog.close()}
 async function beginCheckout(){if(!state.selected||state.selected.digital_available===false)return;if(!$('digital-consent').checked){showToast(text('agree'));return}const btn=$('checkout-button');btn.disabled=true;btn.textContent=state.lang==='no'?'Starter betaling…':'Starting checkout…';try{const res=await fetch('/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({artwork_id:state.selected.id,digital_consent:true})});const data=await res.json();if(!res.ok||!safeLink(data.url)||!data.url.startsWith('https://checkout.stripe.com/'))throw Error(data.error||'Checkout unavailable');location.assign(data.url)}catch(e){showToast(text('checkoutError'));updateBuy()}}
 async function verifyPurchase(sessionId){const dialog=$('purchase-dialog');if(!dialog.open)dialog.showModal();$('purchase-status').textContent=text('pending');$('download-link').hidden=true;$('purchase-retry').hidden=true;try{const r=await fetch('/api/confirm-download?session_id='+encodeURIComponent(sessionId),{headers:{'Accept':'application/json'}});const data=await r.json();if(!r.ok){if(data.payment_verified){$('purchase-status').textContent=text('fileMissing')}else $('purchase-status').textContent=data.error||text('failed');$('purchase-retry').hidden=false;return}if(!safeLink(data.download_url))throw new Error('Invalid download URL');$('purchase-title').textContent=data.title||'Your artwork is ready.';$('purchase-status').textContent=text('paid');$('download-link').href=data.download_url;$('download-link').hidden=false;$('download-link').textContent=text('download')}catch{$('purchase-status').textContent=text('failed');$('purchase-retry').hidden=false}}
 async function init(){
  try{
   const [catalog,styles,curation,status,print]=await Promise.all([
    fetch('/assets/catalog.json').then(r=>{if(!r.ok)throw Error('Catalog unavailable');return r.json()}),
    fetch('/assets/styles.json').then(r=>{if(!r.ok)throw Error('Styles unavailable');return r.json()}),
    fetch('/assets/collections.json').then(r=>{if(!r.ok)throw Error('Collections unavailable');return r.json()}),
    fetch('/api/status').then(r=>r.ok?r.json():({sales_enabled:false})).catch(()=>({sales_enabled:false})),
    fetch('/assets/print-links.json').then(r=>r.ok?r.json():({})).catch(()=>({}))
   ]);
   state.styles=Array.isArray(styles)?styles:[];
   state.collections=curation.collections;
   state.art=catalog.map(art=>({...art,collection_id:curation.byArtworkId[art.id]||curation.byStyle[art.style_id]}));
   if(state.art.some(art=>!state.collections.some(c=>c.id===art.collection_id)))throw Error('Artwork without a curated collection');
   state.checkout=!!status.sales_enabled;state.print=print;makeCollections();
   $('art-count').textContent=state.art.length;$('end-number').textContent=state.art.length;
   render();$('year').textContent=new Date().getFullYear();
   const slug=currentSlug();if(slug){const match=state.art.find(a=>a.id===slug);if(match)openArt(match,false)}
   const sessionId=new URLSearchParams(location.search).get('session_id');
   if(sessionId&&/^cs_(test_|live_)?[a-zA-Z0-9_]+$/.test(sessionId))verifyPurchase(sessionId);
  }catch(e){$('gallery').textContent='The gallery could not be loaded. Please refresh this page.';console.error(e)}
 }
 $('categories').addEventListener('click',event=>{const button=event.target.closest('[data-category]');if(button)setCollection(button.dataset.category)});
 $('art-search').addEventListener('input',event=>{state.search=event.target.value.toLocaleLowerCase().trim();state.count=18;render()});
 $('art-sort').addEventListener('change',event=>{state.sort=event.target.value;state.count=18;render()});
 $('style-filter').addEventListener('change',event=>{state.style=event.target.value;state.count=18;render()});
 $('orientation-filter').addEventListener('change',event=>{state.orientation=event.target.value;state.count=18;render()});
 $('motif-filter').addEventListener('change',event=>{state.motif=event.target.value;state.count=18;render()});
 $('colour-filter').addEventListener('change',event=>{state.colour=event.target.value;state.count=18;render()});
 $('price-filter').addEventListener('change',event=>{state.price=event.target.value;state.count=18;render()});
 $('clear-filters').addEventListener('click',()=>{state.category='all';state.style='all';state.orientation='all';state.motif='all';state.colour='all';state.price='all';state.search='';state.sort='collection';state.count=18;
  $('art-search').value='';$('art-sort').value='collection';$('style-filter').value='all';$('orientation-filter').value='all';$('motif-filter').value='all';$('colour-filter').value='all';$('price-filter').value='all';render()});
 $('load-more').addEventListener('click',()=>{state.count+=18;render()});
 $('digital-consent').addEventListener('change',updateBuy);
 $('art-zoom-trigger').addEventListener('click',openZoom);
 $('zoom-in').addEventListener('click',()=>setZoom(zoom+.5));
 $('zoom-out').addEventListener('click',()=>setZoom(zoom-.5));
 $('zoom-reset').addEventListener('click',()=>setZoom(1));
 $('zoom-close').addEventListener('click',()=>$('art-zoom-dialog').close());
 $('art-zoom-dialog').addEventListener('click',event=>{if(event.target===$('art-zoom-dialog'))event.currentTarget.close()});
 $('checkout-button').addEventListener('click',beginCheckout);
 for(const button of document.querySelectorAll('#art-dialog .dialog-close'))button.addEventListener('click',()=>closeArt());$('art-dialog').addEventListener('close',()=>{if(currentSlug()){history.replaceState({},'','/');document.title='Freddy Bremseth Art — Art that stays with you'}});$('art-dialog').addEventListener('click',e=>{if(e.target===$('art-dialog'))closeArt()});$('purchase-close').addEventListener('click',()=>$('purchase-dialog').close());$('purchase-retry').addEventListener('click',()=>{const id=new URLSearchParams(location.search).get('session_id');if(id)verifyPurchase(id)});addEventListener('popstate',()=>{const slug=currentSlug();const art=state.art.find(a=>a.id===slug);if(art)openArt(art,false);else closeArt()});
 init();
})();
