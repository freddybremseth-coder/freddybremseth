(()=>{
'use strict';
const modal=document.getElementById('art-dialog');
const standalone=document.querySelector('[data-artwork-print]');
const preview=document.getElementById('dialog-image')||document.querySelector('.collection-landing-hero figure img');
if((!modal&&!standalone)||!preview)return;
const css=document.createElement('style');
css.textContent=`
.artview-launch{margin:14px 0;width:100%;justify-content:center}
.artview-dialog{width:min(1120px,96vw);max-height:94dvh;border:0;padding:0;background:#f7f4ee;color:#252b29;box-shadow:0 24px 90px #1118}
.artview-dialog::backdrop{background:#111b}
.artview-shell{padding:clamp(16px,3vw,32px)}
.artview-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:15px}
.artview-head h2{font:normal clamp(24px,3vw,38px) Georgia,serif;margin:0}
.artview-close{border:1px solid #c8c2b6;background:transparent;padding:9px 14px}
.artview-layout{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(240px,1fr);gap:24px}
.artview-stage{position:relative;aspect-ratio:1.5;overflow:hidden;background:#e9e3d9 url('/assets/rooms/mediterranean-living.png') center/cover no-repeat;isolation:isolate}
.artview-stage[data-room=gallery]{background-image:url('/assets/rooms/minimal-gallery.png')}
.artview-stage[data-room=bedroom]{background-image:url('/assets/rooms/mediterranean-bedroom.png')}
.artview-stage[data-room=own]{background-image:none}
.artview-furniture{display:none}
.artview-stage[data-room=gallery] .artview-furniture{display:none}
.artview-stage[data-room=bedroom] .artview-furniture{width:78%;left:11%;height:24%;bottom:5%;border-radius:10px;background:#f5eee6}
.artview-hanging{position:absolute;top:9%;left:50%;transform:translateX(-50%);max-height:56%;max-width:66%;display:flex;align-items:center;justify-content:center;filter:drop-shadow(5px 8px 5px #0003)}
.artview-hanging{touch-action:none;cursor:grab}.artview-hanging:active{cursor:grabbing}.artview-hanging img{display:block;max-height:100%;max-width:100%;object-fit:contain}
.artview-hanging[data-frame=black]{padding:7px;background:#1c1c1c}
.artview-hanging[data-frame=white]{padding:9px;background:#fff}
.artview-hanging[data-frame=oak]{padding:9px;background:#b58c58}
.artview-hanging[data-frame=none]{padding:0}.artview-hanging[data-frame=gold]{padding:9px;background:#bda35e}.artview-hanging[data-frame=silver]{padding:9px;background:#a7a9ae}
.artview-note{font-size:12px;color:#666;line-height:1.55;margin:8px 0}
.artview-controls{display:flex;flex-direction:column;gap:15px}
.artview-controls label{display:grid;gap:6px;font-size:12px;font-weight:700}
.artview-controls select,.artview-controls input[type=file]{padding:10px;border:1px solid #bdb6aa;background:#fff;max-width:100%}
.artview-actions{display:flex;flex-wrap:wrap;gap:9px}
.artview-actions button{padding:12px;border:1px solid #252b29;background:#252b29;color:#fff}
.artview-actions button.secondary{background:transparent;color:#252b29}
.artview-status{font-size:12px;line-height:1.5;min-height:36px}
@media(max-width:760px){.artview-layout{grid-template-columns:1fr}.artview-dialog{max-height:96dvh}.artview-stage{aspect-ratio:1.2}}
`;
document.head.appendChild(css);
const button=document.createElement('button');
button.type='button';button.className='btn btn-outline artview-launch';button.textContent='See this artwork on your wall ↗';
const buySection=modal?.querySelector('.print-option')||standalone?.querySelector('.artwork-print-heading');
if(buySection)buySection.after(button);
const dialog=document.createElement('dialog');dialog.className='artview-dialog';dialog.setAttribute('aria-labelledby','artview-title');
dialog.innerHTML=`<div class="artview-shell"><div class="artview-head"><h2 id="artview-title">See it on your wall</h2><button type="button" class="artview-close" data-close aria-label="Close preview">Close ✕</button></div><div class="artview-layout"><div><div class="artview-stage" data-room="living"><div class="artview-furniture"></div><div class="artview-hanging" data-frame="none"><img alt="Artwork displayed in the selected room"></div></div><p class="artview-note">Illustrative interior preview. Exact physical scale requires a reference measurement. Artwork colours may vary by screen and print material.</p></div><div class="artview-controls"><label>Room style<select data-room><option value="living">Contemporary living room</option><option value="bedroom">Calm bedroom</option><option value="gallery">Minimalist gallery wall</option><option value="own">My own room photo</option></select></label><label data-upload-label hidden>Upload a room photo (processed only in your browser)<input data-upload type="file" accept="image/png,image/jpeg,image/webp"></label><label>Prodigi print size<select data-size><option value="">Loading available sizes…</option></select></label><label>Preview scale <input data-scale type="range" min="65" max="150" value="100" step="5" aria-label="Preview scale, approximate"><small>Drag the artwork to position it on the wall.</small></label><label>Frame appearance<select data-frame><option value="none">Unframed · available print</option><option value="black">Black · illustrative only</option><option value="white">White · illustrative only</option><option value="oak">Oak · illustrative only</option></select></label><p class="artview-status" role="status"></p><div class="artview-actions"><button type="button" data-order>Choose this print</button><button type="button" class="secondary" data-download>Save preview</button></div></div></div></div>`;
document.body.appendChild(dialog);
const $=sel=>dialog.querySelector(sel);
const stage=$('.artview-stage'),hanging=$('.artview-hanging'),image=hanging.querySelector('img'),status=$('.artview-status'),size=$('[data-size]');
let roomUrl=null,selectedId='',products=[],frames=[],offsetX=0,offsetY=0,scale=1;
const idFromPath=()=>{const selected=modal?.dataset.artworkId||standalone?.dataset.artworkId||document.body.dataset.artworkId||'';if(/^[a-z0-9-]+$/.test(selected))return selected;const m=location.pathname.match(/^\/(?:verk|artwork)\/([a-z0-9-]+)\/?$/);return m?m[1]:'';};
function sizeLabel(p){const d=p.dimensions||{},unit=(d.units||'in').toLowerCase();const w=Number(d.width),h=Number(d.height);if(!w||!h)return p.sku;const factor=unit==='in'?2.54:unit==='mm'?0.1:1;return Math.round(w*factor)+' × '+Math.round(h*factor)+' cm';}
function positionArt(){hanging.style.transform='translate(calc(-50% + '+offsetX+'px), '+offsetY+'px) scale('+scale+')';}
function fit(){
 const p=products.find(x=>x.sku===size.value);
 const d=p?.dimensions||{}, w=Number(d.width||1),h=Number(d.height||1);
 const major=Math.max(w,h);const proportion=Math.min(1,major/36);
 hanging.style.height=(Math.max(20,proportion*54))+'%';
 hanging.style.aspectRatio=w+'/'+h;
 hanging.style.width='auto';hanging.style.maxWidth='66%';
 if(image.naturalWidth&&image.naturalHeight){
  // The print can include borders when its aspect ratio differs from the artwork.
  image.style.aspectRatio=image.naturalWidth+'/'+image.naturalHeight;
 }
}
function syncFrames(){
 const select=$('select[data-frame]'),chosen=products.find(p=>p.sku===size.value);
 const suffix=chosen?.sku?.replace(/^GLOBAL-FAP-/,'')||'';
 const matching=frames.filter(f=>f.sku.endsWith('-'+suffix));
 select.replaceChildren(new Option('No frame · fine-art paper','none'));
 const displayed=new Set();
 for(const frame of matching){
  for(const color of frame.colors){
   const original=String(color),key=original.toLowerCase();
   const visual=key.includes('black')?'black':key.includes('white')?'white':key.includes('gold')?'gold':key.includes('silver')?'silver':key.includes('natural')||key.includes('oak')||key.includes('brown')?'oak':null;
   if(!visual)continue;
   const id=frame.sku+':'+key;if(displayed.has(id))continue;displayed.add(id);
   const opt=new Option(frame.label+' · '+original+' (preview only)',visual);
   opt.dataset.sku=frame.sku;select.add(opt);
  }
 }
 select.value='none';hanging.dataset.frame='none';
}
async function loadFrameCatalog(){
 frames=[];
 try{
  const response=await fetch('/api/frame-options?artwork_id='+encodeURIComponent(selectedId)+'&country=ES');
  const data=await response.json();
  if(response.ok&&Array.isArray(data.frames))frames=data.frames;
 }catch{}
 syncFrames();
}
async function loadSizes(){
 size.replaceChildren(new Option('Checking Prodigi availability…',''));$('[data-order]').disabled=true;
 status.textContent='Checking sizes offered for this artwork…';products=[];
 try{
  const response=await fetch('/api/print-options?artwork_id='+encodeURIComponent(selectedId)+'&country=ES',{headers:{Accept:'application/json'}});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load sizes');
  products=Array.isArray(data.products)?data.products:[];
  size.replaceChildren();
  if(!products.length){
   const missing=data.configured===false;
   size.add(new Option(missing?'Prodigi not connected in this preview':'No eligible physical print sizes',''));
   size.disabled=true;
   status.textContent=missing?'This test deployment does not have the Prodigi API credentials. Room and frame appearance previews remain available; print selection requires the separate test configuration.':'Prodigi returned no eligible physical print sizes for this artwork.';
   return;
  }
  for(const p of products)size.add(new Option(sizeLabel(p),p.sku));
  size.disabled=false;size.selectedIndex=Math.min(1,products.length-1);$('[data-order]').disabled=false;fit();void loadFrameCatalog();
  status.textContent='Sizes are read from the current Prodigi integration. Frames are visual suggestions only and cannot yet be ordered.';
 }catch(error){size.replaceChildren(new Option('Sizes temporarily unavailable',''));size.disabled=true;status.textContent=error.message;}
}
button.addEventListener('click',()=>{
 selectedId=idFromPath();if(!selectedId){status.textContent='Open this artwork from the gallery first.';return}
 image.src=preview.currentSrc||preview.src;image.alt=preview.alt||'Selected artwork';
 $('select[data-room]').value='living';$('[data-upload-label]').hidden=true;stage.dataset.room='living';stage.style.backgroundImage='';$('select[data-frame]').value='none';hanging.dataset.frame='none';offsetX=0;offsetY=0;scale=1;$('[data-scale]').value='100';positionArt();stage.querySelector('.artview-furniture').style.display='';
 if(modal?.open)modal.close();
 dialog.showModal();void loadSizes();
});
$('[data-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
$('select[data-room]').addEventListener('change',event=>{
 const mode=event.target.value;$('[data-upload-label]').hidden=mode!=='own';
 if(mode==='own'){stage.dataset.room='own';if(!roomUrl)status.textContent='Choose a clear photo of your wall.'}
 else{stage.dataset.room=mode;stage.style.backgroundImage='';stage.style.backgroundSize='';}
});
$('[data-upload]').addEventListener('change',event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){status.textContent='Use a JPEG, PNG or WebP image smaller than 12 MB.';return}
 if(roomUrl)URL.revokeObjectURL(roomUrl);
 roomUrl=URL.createObjectURL(file);stage.style.backgroundImage='url("'+roomUrl+'")';stage.style.backgroundSize='cover';stage.style.backgroundPosition='center';
 stage.querySelector('.artview-furniture').style.display='none';status.textContent='Your image stays on this device. Move and scale are illustrative; measured wall calibration is planned.';
});
$('select[data-room]').addEventListener('change',event=>{if(event.target.value!=='own')stage.querySelector('.artview-furniture').style.display=''});
$('select[data-frame]').addEventListener('change',event=>{hanging.dataset.frame=event.target.value;status.textContent=event.target.value==='none'?'Unframed print preview.':'Frame visualisation only — not an orderable Prodigi product.'});
size.addEventListener('change',()=>{fit();syncFrames()});
$('[data-scale]').addEventListener('input',event=>{scale=Number(event.target.value)/100;positionArt()});
let drag=null;
hanging.addEventListener('pointerdown',event=>{
 if(event.button!==0)return;
 drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:offsetX,startY:offsetY};
 hanging.setPointerCapture(event.pointerId);
});
hanging.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 const box=stage.getBoundingClientRect();
 offsetX=Math.max(-box.width*.36,Math.min(box.width*.36,drag.startX+event.clientX-drag.x));
 offsetY=Math.max(-box.height*.12,Math.min(box.height*.30,drag.startY+event.clientY-drag.y));
 positionArt();
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])hanging.addEventListener(name,()=>{drag=null});

$('[data-order]').addEventListener('click',()=>{
 if(!selectedId)return;dialog.close();if(modal?.open)modal.close();
 // Reopen the existing order flow, which owns shipping, quotes and checkout.
 const trigger=document.querySelector('#print-button');
 if(standalone){
  const wanted=size.value,host=document.getElementById('artwork-print-sizes');
  const selectWhenReady=()=>{
   const option=Array.from(host?.querySelectorAll('[data-sku]')||[]).find(node=>node.dataset.sku===wanted);
   if(option){option.click();option.scrollIntoView({behavior:'smooth',block:'center'});observer.disconnect();clearTimeout(timeout);}
  };
  const observer=new MutationObserver(selectWhenReady);
  if(host)observer.observe(host,{childList:true,subtree:true});
  const timeout=setTimeout(()=>observer.disconnect(),10000);
  selectWhenReady();
 }else if(trigger && !trigger.hidden){
  modal.showModal();trigger.click();
  const wanted=size.value;
  const choices=document.getElementById('print-size-options');
  if(wanted&&choices){
   const selectWhenReady=()=>{
    const option=Array.from(choices.querySelectorAll('[data-print-sku]')).find(node=>node.dataset.printSku===wanted);
    if(option){option.click();observer.disconnect();clearTimeout(timeout);}
   };
   const observer=new MutationObserver(selectWhenReady);
   observer.observe(choices,{childList:true,subtree:true});
   const timeout=setTimeout(()=>observer.disconnect(),10000);
   selectWhenReady();
  }
 }else{
  status.textContent='Print checkout is not available yet for this artwork.';
  dialog.showModal();
 }
});
async function drawCover(ctx,src,w,h){
 const bg=new Image();bg.src=src;
 await new Promise((resolve,reject)=>{if(bg.complete&&bg.naturalWidth){resolve();return}bg.onload=resolve;bg.onerror=reject});
 const ratio=Math.max(w/bg.naturalWidth,h/bg.naturalHeight),bw=bg.naturalWidth*ratio,bh=bg.naturalHeight*ratio;
 ctx.drawImage(bg,(w-bw)/2,(h-bh)/2,bw,bh);
}
$('[data-download]').addEventListener('click',async()=>{
 const action=$('[data-download]');action.disabled=true;status.textContent='Preparing your preview…';
 try{
  if(!image.complete||!image.naturalWidth)throw Error('Artwork image has not loaded yet');
  const rect=stage.getBoundingClientRect(),art=hanging.getBoundingClientRect();
  const ratio=2,w=Math.round(rect.width*ratio),h=Math.round(rect.height*ratio);
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas not supported');
  ctx.scale(ratio,ratio);const sw=rect.width,sh=rect.height;
  const room=$('select[data-room]').value;
  const roomPhotos={living:'/assets/rooms/mediterranean-living.png',bedroom:'/assets/rooms/mediterranean-bedroom.png',gallery:'/assets/rooms/minimal-gallery.png'};
  ctx.fillStyle='#ece7df';ctx.fillRect(0,0,sw,sh);
  if(room==='own'&&roomUrl)await drawCover(ctx,roomUrl,sw,sh);
  else if(roomPhotos[room])await drawCover(ctx,roomPhotos[room],sw,sh);
  const ax=art.left-rect.left,ay=art.top-rect.top,aw=art.width,ah=art.height;
  ctx.shadowColor='#0005';ctx.shadowBlur=8;ctx.shadowOffsetX=5;ctx.shadowOffsetY=7;
  const frame=$('select[data-frame]').value;
  const frameColors={black:'#1c1c1c',white:'#ffffff',oak:'#b58c58',gold:'#bda35e',silver:'#a7a9ae'};
  if(frameColors[frame]){ctx.fillStyle=frameColors[frame];ctx.fillRect(ax,ay,aw,ah);}
  ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
  const pad=frame==='none'?0:9*scale,ix=ax+pad,iy=ay+pad,iw=aw-pad*2,ih=ah-pad*2;
  const aspect=image.naturalWidth/image.naturalHeight;
  let dw=iw,dh=dw/aspect;if(dh>ih){dh=ih;dw=dh*aspect}
  ctx.drawImage(image,ix+(iw-dw)/2,iy+(ih-dh)/2,dw,dh);
  ctx.fillStyle='#252b29';ctx.fillRect(0,sh-22,sw,22);
  ctx.fillStyle='#fff';ctx.font='11px Arial';ctx.fillText('Freddy Bremseth Art · illustrative room preview · not to scale',12,sh-7);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not export the image');
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='freddy-bremseth-artview-'+selectedId+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Preview downloaded. Frame selections are illustrative and not included in an order.';
 }catch(error){status.textContent=error.message||'Unable to save this preview.'}
 finally{action.disabled=false}
});
})();
