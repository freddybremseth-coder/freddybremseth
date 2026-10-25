(()=>{
'use strict';
const modal=document.getElementById('art-dialog');
const preview=document.getElementById('dialog-image');
if(!modal||!preview)return;
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
.artview-stage{position:relative;aspect-ratio:1.45;overflow:hidden;background:linear-gradient(#dedbd4 0 71%,#c2b4a1 71%);isolation:isolate}
.artview-stage[data-room=gallery]{background:linear-gradient(#f4f0e9 0 85%,#c8c1b4 85%)}
.artview-stage[data-room=bedroom]{background:linear-gradient(#e9dfd3 0 74%,#bcad9f 74%)}
.artview-furniture{position:absolute;left:15%;width:70%;height:17%;bottom:11%;background:#bbb3a9;border-radius:45% 45% 6px 6px;box-shadow:0 11px 0 #aaa297,0 16px 15px #0002}
.artview-stage[data-room=gallery] .artview-furniture{display:none}
.artview-stage[data-room=bedroom] .artview-furniture{width:78%;left:11%;height:24%;bottom:5%;border-radius:10px;background:#f5eee6}
.artview-hanging{position:absolute;top:9%;left:50%;transform:translateX(-50%);max-height:56%;max-width:66%;display:flex;align-items:center;justify-content:center;filter:drop-shadow(5px 8px 5px #0003)}
.artview-hanging img{display:block;max-height:100%;max-width:100%;object-fit:contain}
.artview-hanging[data-frame=black]{padding:7px;background:#1c1c1c}
.artview-hanging[data-frame=white]{padding:9px;background:#fff}
.artview-hanging[data-frame=oak]{padding:9px;background:#b58c58}
.artview-hanging[data-frame=none]{padding:0}
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
const buySection=modal.querySelector('.print-option');
if(buySection)buySection.after(button);
const dialog=document.createElement('dialog');dialog.className='artview-dialog';dialog.setAttribute('aria-labelledby','artview-title');
dialog.innerHTML=`<div class="artview-shell"><div class="artview-head"><h2 id="artview-title">See it on your wall</h2><button type="button" class="artview-close" data-close aria-label="Close preview">Close ✕</button></div><div class="artview-layout"><div><div class="artview-stage" data-room="living"><div class="artview-furniture"></div><div class="artview-hanging" data-frame="none"><img alt="Artwork displayed in the selected room"></div></div><p class="artview-note">Illustrative interior preview. Exact physical scale requires a reference measurement. Artwork colours may vary by screen and print material.</p></div><div class="artview-controls"><label>Room style<select data-room><option value="living">Contemporary living room</option><option value="bedroom">Calm bedroom</option><option value="gallery">Minimalist gallery wall</option><option value="own">My own room photo</option></select></label><label data-upload-label hidden>Upload a room photo (processed only in your browser)<input data-upload type="file" accept="image/png,image/jpeg,image/webp"></label><label>Prodigi print size<select data-size><option value="">Loading available sizes…</option></select></label><label>Frame appearance<select data-frame><option value="none">Unframed · available print</option><option value="black">Black · illustrative only</option><option value="white">White · illustrative only</option><option value="oak">Oak · illustrative only</option></select></label><p class="artview-status" role="status"></p><div class="artview-actions"><button type="button" data-order>Choose this print</button><button type="button" class="secondary" data-download>Save preview</button></div></div></div></div>`;
document.body.appendChild(dialog);
const $=sel=>dialog.querySelector(sel);
const stage=$('.artview-stage'),hanging=$('.artview-hanging'),image=hanging.querySelector('img'),status=$('.artview-status'),size=$('[data-size]');
let roomUrl=null,selectedId='',products=[],renderSize=0;
const idFromPath=()=>{const m=location.pathname.match(/^\/verk\/([a-z0-9-]+)\/?$/);return m?m[1]:'';};
function sizeLabel(p){const d=p.dimensions||{},unit=(d.units||'in').toLowerCase();const w=Number(d.width),h=Number(d.height);if(!w||!h)return p.sku;const factor=unit==='in'?2.54:unit==='mm'?0.1:1;return Math.round(w*factor)+' × '+Math.round(h*factor)+' cm';}
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
async function loadSizes(){
 size.replaceChildren(new Option('Checking Prodigi availability…',''));
 status.textContent='Checking sizes offered for this artwork…';products=[];
 try{
  const response=await fetch('/api/print-options?artwork_id='+encodeURIComponent(selectedId)+'&country=ES',{headers:{Accept:'application/json'}});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Unable to load sizes');
  products=Array.isArray(data.products)?data.products:[];
  size.replaceChildren();
  if(!products.length){size.add(new Option('No eligible physical print sizes',''));size.disabled=true;status.textContent='This artwork has no orderable Prodigi print size right now.';return}
  for(const p of products)size.add(new Option(sizeLabel(p),p.sku));
  size.disabled=false;size.selectedIndex=Math.min(1,products.length-1);fit();
  status.textContent='Sizes are read from the current Prodigi integration. Frames are visual suggestions only and cannot yet be ordered.';
 }catch(error){size.replaceChildren(new Option('Sizes temporarily unavailable',''));size.disabled=true;status.textContent=error.message;}
}
button.addEventListener('click',()=>{
 selectedId=idFromPath();if(!selectedId){status.textContent='Open this artwork from the gallery first.';return}
 image.src=preview.currentSrc||preview.src;image.alt=preview.alt||'Selected artwork';
 $('[data-room]').value='living';stage.dataset.room='living';stage.style.backgroundImage='';$('[data-frame]').value='none';hanging.dataset.frame='none';
 if(modal.open)modal.close();
 dialog.showModal();void loadSizes();
});
$('[data-close]').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});
$('[data-room]').addEventListener('change',event=>{
 const mode=event.target.value;$('[data-upload-label]').hidden=mode!=='own';
 if(mode==='own'){stage.dataset.room='gallery';if(!roomUrl)status.textContent='Choose a clear photo of your wall.'}
 else{stage.dataset.room=mode;stage.style.backgroundImage='';stage.style.backgroundSize='';}
});
$('[data-upload]').addEventListener('change',event=>{
 const file=event.target.files?.[0];if(!file)return;
 if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>12*1024*1024){status.textContent='Use a JPEG, PNG or WebP image smaller than 12 MB.';return}
 if(roomUrl)URL.revokeObjectURL(roomUrl);
 roomUrl=URL.createObjectURL(file);stage.style.backgroundImage='url("'+roomUrl+'")';stage.style.backgroundSize='cover';stage.style.backgroundPosition='center';
 stage.querySelector('.artview-furniture').style.display='none';status.textContent='Your image stays on this device. Move and scale are illustrative; measured wall calibration is planned.';
});
$('[data-room]').addEventListener('change',event=>{if(event.target.value!=='own')stage.querySelector('.artview-furniture').style.display=''});
$('[data-frame]').addEventListener('change',event=>{hanging.dataset.frame=event.target.value;status.textContent=event.target.value==='none'?'Unframed print preview.':'Frame visualisation only — not an orderable Prodigi product.'});
size.addEventListener('change',fit);
$('[data-order]').addEventListener('click',()=>{
 if(!selectedId)return;dialog.close();if(modal.open)modal.close();
 // Reopen the existing order flow, which owns shipping, quotes and checkout.
 const trigger=document.querySelector('#print-button');
 if(trigger && !trigger.hidden){
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
$('[data-download]').addEventListener('click',()=>{
 status.textContent='Use your browser’s screenshot or print function to save this preview. Downloadable composites are planned.';
});
})();
