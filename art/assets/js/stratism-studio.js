(()=>{'use strict';
const $=id=>document.getElementById(id);
const form=$('stratism-brief-form');if(!form)return;
const output=$('stratism-brief-output');
const state={brief:null,reference:null,previewUrl:null,variants:[],selectedVariant:-1,busy:false};
const CM_PER_INCH=2.54;
function printCheck(width,height){
 const short=Math.min(width,height),long=Math.max(width,height);
 return [{shortCm:30,longCm:40},{shortCm:40,longCm:50},{shortCm:60,longCm:75},{shortCm:80,longCm:100}]
 .map(size=>({label:size.shortCm+' × '+size.longCm+' cm',
  requiredShort:Math.ceil(size.shortCm/CM_PER_INCH*300),
  requiredLong:Math.ceil(size.longCm/CM_PER_INCH*300),
  pixelPass:short>=Math.ceil(size.shortCm/CM_PER_INCH*300)&&long>=Math.ceil(size.longCm/CM_PER_INCH*300),
  aspectPass:Math.abs(short/long-size.shortCm/size.longCm)<=0.015}))
 .map(v=>({...v,passes:v.pixelPass&&v.aspectPass}));
}
const MAX_VARIANTS=3;
function refreshVariantUI(){
 const gallery=$('stratism-variant-gallery');
 gallery.replaceChildren();
 const count=state.variants.length;
 $('stratism-variant-count').textContent=count+' av '+MAX_VARIANTS;
 state.variants.forEach((variant,index)=>{
  const button=document.createElement('button');
  button.type='button';
  button.className='stratism-variant-choice'+(state.selectedVariant===index?' chosen':'');
  button.setAttribute('aria-pressed',String(state.selectedVariant===index));
  button.setAttribute('aria-label','Velg forslag '+(index+1));
  const image=document.createElement('img');
  image.src=(variant.revision&&variant.showRevision)?variant.revision.url:variant.url;image.alt='Stratism-forslag '+(index+1);
  const caption=document.createElement('span');
  caption.textContent='Forslag '+(index+1)+(variant.revision?' · Revidert':'')+(state.selectedVariant===index?' · Valgt':'');
  button.append(image,caption);
  button.addEventListener('click',()=>{state.selectedVariant=index;refreshVariantUI()});
  gallery.appendChild(button);
 });
 $('stratism-result').hidden=count===0;
 const selected=state.variants[state.selectedVariant];
 const revisionSelect=$('stratism-revision-select');
 revisionSelect.replaceChildren();
 for(const [value,label] of [['0','Originalforslag'],...(selected?.revision?[['1','Forbedret versjon']]:[])]){
  const option=document.createElement('option');option.value=value;option.textContent=label;revisionSelect.appendChild(option);
 }
 revisionSelect.value=selected?.showRevision?'1':'0';
 revisionSelect.disabled=!selected||!selected.revision||state.busy;
 $('stratism-refine-selected').disabled=!selected||!!selected.revision||state.busy;
 $('stratism-save-preview').disabled=!selected||state.busy;
 $('stratism-selected-description').textContent=state.selectedVariant<0?'Velg en prøve for å laste ned.':
  'Forslag '+(state.selectedVariant+1)+' er valgt til lokal nedlasting. Ikke salg- eller printgodkjent.';
 const generate=$('stratism-generate-private');
 generate.textContent=count?'Generer nytt forslag ('+(count+1)+' av '+MAX_VARIANTS+')':'Generer forslag 1 (AI)';
 generate.disabled=!state.brief||count>=MAX_VARIANTS||state.busy;
}
function clearVariants(){
 for(const variant of state.variants){URL.revokeObjectURL(variant.url);if(variant.revision)URL.revokeObjectURL(variant.revision.url);}
 state.variants=[];state.selectedVariant=-1;refreshVariantUI();
}
const referenceInput=$('stratism-reference-file');
referenceInput.addEventListener('change',async()=>{
 const file=referenceInput.files?.[0];
 clearVariants();state.reference=null;
 if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null;}
 const preview=$('stratism-reference-preview');
 preview.hidden=true;preview.removeAttribute('src');
 $('stratism-reference-status').textContent='Ingen referansefil valgt.';
 $('stratism-print-capacity').textContent='Oppløsningskontrollen gjelder bare valgt fil.';
 if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>50*1024*1024||file.size<100)
 { $('stratism-reference-status').textContent='Velg JPG, PNG eller WebP mellom 100 byte og 50 MB.';return; }
 const url=URL.createObjectURL(file);state.previewUrl=url;
 try{
  const image=new Image();
  image.src=url;await image.decode();
  if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>160000000)throw Error('Ugyldige eller for store bildedimensjoner.');
  state.reference={name:file.name.slice(0,120),width:image.naturalWidth,height:image.naturalHeight,bytes:file.size,type:file.type};
  preview.src=url;preview.hidden=false;
  $('stratism-reference-status').textContent='Referanse: '+state.reference.width+' × '+state.reference.height+' px · '+(file.size/1048576).toFixed(1)+' MB. Ikke lastet opp.';
  const checks=printCheck(state.reference.width,state.reference.height);
  $('stratism-print-capacity').textContent=checks.map(v=>v.label+': '+(v.passes?'pikselkrav oppfylt':'ikke oppfylt')).join(' · ')+'. Dette er bare matematisk oppløsning, ikke printgodkjenning.';
 }catch(e){
  state.reference=null;URL.revokeObjectURL(url);state.previewUrl=null;
  $('stratism-reference-status').textContent='Kunne ikke lese bildet: '+e.message;
 }
});

const clean=(value,max=2000)=>String(value||'').trim().slice(0,max);
function buildBrief(){
 const description=clean($('stratism-description').value);
 if(description.length<12)throw Error('Beskriv motivet med minst 12 tegn.');
 const source=clean($('stratism-source').value,120);
 const chord=$('stratism-chord').value;
 const emphasis=$('stratism-emphasis').value;
 const strength=$('stratism-strength').value;
 const title=clean($('stratism-title').value,100)||'Untitled Stratism';
 return {
  schema:'stratism-brief-v1',title,description,reference_note:source||null,reference_metadata:state.reference,
  style:{name:'Stratism',rules_version:'working-v0.9',sequence:['presence','feeling','memory','erasure','absence'],
   palette:chord,emphasis,colour_strength:strength,signature:'Freddy Bremseth',
   constraints:['one continuous subject','no broad dominant colour stripe','no global embossed texture',
    'no paper-flake simulation','preserve selected meaningful features','visible unpainted linen']},
  render_instruction:`Create one contemplative fine-art Stratism painting of: ${description}. The subject must remain recognizable, while five states of time unfold from precise presence, through restrained emotion, translucent memory, selective abrasion and finally absence on bare linen. Preserve the subject's defining features. Palette: ${chord}; intensity: ${strength}. Emphasize: ${emphasis}. Avoid repeated digital texture, hard horizontal boundaries and peeled-paper collage. A small discreet cursive signature "Freddy Bremseth" must appear at the bottom right, and no other text.`,
  production:{provider:'NOT_CONNECTED',generation_status:'BRIEF_ONLY',commercial_release:false,
   print_release:false,planned_assets:['web','digital-master','print-300ppi-after-proofing'],
   human_approval_required:true}
 };
}
form.addEventListener('submit',ev=>{
 ev.preventDefault();
 try{clearVariants();state.brief=buildBrief();output.textContent=state.brief.render_instruction;
 $('stratism-brief-status').textContent='Brief opprettet lokalt. Ingen bildejobb er sendt og ingenting er publisert.';
 $('stratism-download-brief').disabled=false;refreshVariantUI();}
 catch(error){$('stratism-brief-status').textContent=error.message;output.textContent='';state.brief=null;$('stratism-download-brief').disabled=true;refreshVariantUI();}
});
$('stratism-download-brief').addEventListener('click',()=>{
 if(!state.brief)return;
 const data=JSON.stringify(state.brief,null,2);
 const blob=new Blob([data],{type:'application/json'});
 const link=document.createElement('a');const url=URL.createObjectURL(blob);
 link.href=url;link.download='stratism-brief.json';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),500);
});
$('stratism-generate-private').addEventListener('click',async()=>{
 if(!state.brief||state.variants.length>=MAX_VARIANTS||state.busy)return;
 state.busy=true;refreshVariantUI();
 const variation=state.variants.length+1;
 $('stratism-brief-status').textContent='Genererer privat Stratism-konsept (ingen publisering)…';
 try{
  let session;try{session=JSON.parse(sessionStorage.getItem('art-admin-session')||'null')}catch{}
  if(!session?.access_token)throw Error('Logg inn som administrator igjen.');
    let referenceJpeg=null;
  // The reference stays in-browser unless the administrator explicitly asks to generate.
  // Resize a temporary derivative: never use this JPEG as a sale or print master.
  if(referenceInput.files?.[0]&&state.reference){
   const img=$('stratism-reference-preview');
   if(!img.complete||!img.naturalWidth)throw Error('Referansefotoet er ikke ferdig innlest.');
   const maxEdge=1400,scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   canvas.getContext('2d',{alpha:false}).drawImage(img,0,0,canvas.width,canvas.height);
   const encoded=canvas.toDataURL('image/jpeg',0.76).split(',')[1];
   if(encoded.length>1_800_000)throw Error('Referansefotoet er for stort for sikker forhåndsvisning. Velg et mindre bilde.');
   referenceJpeg=encoded;
  }
  const response=await fetch('/api/stratism-generate',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({description:state.brief.description,
     chord:state.brief.style.palette,emphasis:state.brief.style.emphasis,
     strength:state.brief.style.colour_strength,reference_jpeg_base64:referenceJpeg,variation})
  });
  const data=await response.json();
  if(!response.ok)throw Error(String(data.error||'Generering feilet').slice(0,180));
  if(data.not_print_approved!==true||data.not_sale_approved!==true||data.stored!==false)
   throw Error('Uventet genereringsstatus. Bildet er ikke vist.');
  // Hold de tre forslagene privat i denne nettlesersesjonen.
  const encoded=data.image_base64;
  if(typeof encoded!=='string'||encoded.length>9_000_000)throw Error('Ugyldig bilde fra generator.');
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
  state.variants.push({url,variation,createdAt:new Date().toISOString()});
  state.selectedVariant=state.variants.length-1;
  refreshVariantUI();
  $('stratism-brief-status').textContent='Privat konsept opprettet'+(data.reference_used?' fra referansefoto':' fra beskrivelse')+'. Ikke lagret på server, ikke godkjent for salg eller print.';
 }catch(error){$('stratism-brief-status').textContent=error.message}
 finally{refreshVariantUI()}
});
$('stratism-save-preview').addEventListener('click',()=>{
 const variant=state.variants[state.selectedVariant];if(!variant)return;
 const a=document.createElement('a');a.href=variant.showRevision&&variant.revision?variant.revision.url:variant.url;
 a.download='stratism-private-review-'+variant.variation+(variant.showRevision?'-refined':'')+'.jpg';
 document.body.appendChild(a);a.click();a.remove();
});
$('stratism-revision-select').addEventListener('change',()=>{
 const variant=state.variants[state.selectedVariant];if(!variant)return;
 variant.showRevision=$('stratism-revision-select').value==='1'&&!!variant.revision;
 refreshVariantUI();
});
$('stratism-refine-selected').addEventListener('click',async()=>{
 const index=state.selectedVariant,variant=state.variants[index];
 if(!variant||variant.revision||!state.brief||state.busy)return;
 state.busy=true;refreshVariantUI();
 $('stratism-brief-status').textContent='Forbedrer valgt kunstverk. Originalen beholdes…';
 try{
  let session;try{session=JSON.parse(sessionStorage.getItem('art-admin-session')||'null')}catch{}
  if(!session?.access_token)throw Error('Logg inn på nytt som administrator.');
  const source=new Image();source.src=variant.url;await source.decode();
  const scale=Math.min(1,1400/Math.max(source.naturalWidth,source.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
  canvas.getContext('2d',{alpha:false}).drawImage(source,0,0,canvas.width,canvas.height);
  const imageData=canvas.toDataURL('image/jpeg',0.77).split(',')[1];
  if(imageData.length>1_800_000)throw Error('Prøvebildet er for stort for revisjon.');
  const mode=$('stratism-refinement-kind').value;
  const response=await fetch('/api/stratism-generate',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token},
   body:JSON.stringify({description:state.brief.description,chord:state.brief.style.palette,
    emphasis:state.brief.style.emphasis,strength:state.brief.style.colour_strength,
    variation:variant.variation,revision_mode:mode,revision_jpeg_base64:imageData})
  });
  const data=await response.json();
  if(!response.ok)throw Error(String(data.error||'Revisjon feilet').slice(0,180));
  if(data.not_print_approved!==true||data.not_sale_approved!==true||data.stored!==false||data.refinement_applied!==mode)
   throw Error('Uventet svar fra revisjonsmotoren.');
  const encoded=data.image_base64;
  if(typeof encoded!=='string'||encoded.length>9_000_000)throw Error('Ugyldig revisjonsbilde.');
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
  variant.revision={url,mode,createdAt:new Date().toISOString()};
  variant.showRevision=true;state.selectedVariant=index;
  $('stratism-brief-status').textContent='Forbedret versjon klar. Originalen er fortsatt tilgjengelig. Ingen publisering.';
 }catch(error){$('stratism-brief-status').textContent=error.message}
 finally{state.busy=false;refreshVariantUI()}
});
$('stratism-reset-variants').addEventListener('click',()=>{
 clearVariants();
 $('stratism-brief-status').textContent='Lokale bildeforslag er tømt. Ingen endringer i galleriet.';
});

})();