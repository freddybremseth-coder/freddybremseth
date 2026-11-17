(()=>{'use strict';
const $=id=>document.getElementById(id);
const form=$('stratism-brief-form');if(!form)return;
const output=$('stratism-brief-output');
const state={brief:null,reference:null,previewUrl:null,variants:[],selectedVariant:-1,busy:false};
async function stratismRequest(payload){
 const getToken=window.ART_ADMIN_GET_ACCESS_TOKEN;
 if(typeof getToken!=='function')throw Error('Administratorinnloggingen er ikke tilgjengelig.');
 const send=async forceRefresh=>fetch('/api/stratism-generate',{
   method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+await getToken({forceRefresh})},
   body:JSON.stringify(payload)
 });
 let response=await send(false);
 if(response.status===401)response=await send(true);
 return response;
}
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
  button.disabled=state.busy;
  button.addEventListener('click',()=>{if(state.busy)return;state.selectedVariant=index;refreshVariantUI()});
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
 $('stratism-reset-variants').disabled=state.busy;
 $('stratism-export-project').disabled=!state.brief||state.busy;
 $('stratism-cloud-save').disabled=!state.brief||state.busy;
 $('stratism-cloud-refresh').disabled=state.busy;
 $('stratism-cloud-select').disabled=state.busy;
 $('stratism-cloud-open').disabled=state.busy||!$('stratism-cloud-select').value;
 $('stratism-import-project').disabled=state.busy;
 $('stratism-reference-file').disabled=state.busy;
 for(const input of form.querySelectorAll('input,select,textarea,button'))input.disabled=state.busy;
 $('stratism-selected-description').textContent=state.selectedVariant<0?'Velg en prøve for å laste ned.':
  'Forslag '+(state.selectedVariant+1)+' er valgt til lokal nedlasting. Ikke salg- eller printgodkjent.';
 const generate=$('stratism-generate-private');
 generate.textContent=count?'Generer nytt forslag ('+(count+1)+' av '+MAX_VARIANTS+')':'Generer forslag 1 (AI)';
 generate.disabled=!state.brief||count>=MAX_VARIANTS||state.busy;
}
function clearVariants(){
 if(state.busy)return;
 for(const variant of state.variants){URL.revokeObjectURL(variant.url);if(variant.revision)URL.revokeObjectURL(variant.revision.url);}
 state.variants=[];state.selectedVariant=-1;refreshVariantUI();
}
const referenceInput=$('stratism-reference-file');
referenceInput.addEventListener('change',async()=>{
 if(state.busy)return;
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
 ev.preventDefault();if(state.busy)return;
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
  const response=await stratismRequest({description:state.brief.description,
     chord:state.brief.style.palette,emphasis:state.brief.style.emphasis,
     strength:state.brief.style.colour_strength,reference_jpeg_base64:referenceJpeg,variation});
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
 finally{state.busy=false;refreshVariantUI()}
});
$('stratism-save-preview').addEventListener('click',()=>{
 const variant=state.variants[state.selectedVariant];if(!variant)return;
 const a=document.createElement('a');a.href=variant.showRevision&&variant.revision?variant.revision.url:variant.url;
 a.download='stratism-private-review-'+variant.variation+(variant.showRevision?'-refined':'')+'.jpg';
 document.body.appendChild(a);a.click();a.remove();
});
$('stratism-revision-select').addEventListener('change',()=>{
 if(state.busy)return;
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

  const source=new Image();source.src=variant.url;await source.decode();
  const scale=Math.min(1,1400/Math.max(source.naturalWidth,source.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
  canvas.getContext('2d',{alpha:false}).drawImage(source,0,0,canvas.width,canvas.height);
  const imageData=canvas.toDataURL('image/jpeg',0.77).split(',')[1];
  if(imageData.length>1_800_000)throw Error('Prøvebildet er for stort for revisjon.');
  const mode=$('stratism-refinement-kind').value;
  const response=await stratismRequest({description:state.brief.description,chord:state.brief.style.palette,
    emphasis:state.brief.style.emphasis,strength:state.brief.style.colour_strength,
    variation:variant.variation,revision_mode:mode,revision_jpeg_base64:imageData});
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

// A portable, private archive is an intentional user download, NOT cloud storage.
// Generated JPG concepts are never promoted to digital or print masters here.
const ARCHIVE_SCHEMA='stratism-project-v1';
const MAX_ARCHIVE_BYTES=48*1024*1024;
const MAX_ARCHIVE_IMAGE_CHARS=9_000_000;
function binaryToBase64(bytes){
 let out='';const chunk=32768;
 for(let i=0;i<bytes.length;i+=chunk)out+=String.fromCharCode(...bytes.subarray(i,i+chunk));
 return btoa(out);
}
function base64ToJpegUrl(encoded){
 if(typeof encoded!=='string'||encoded.length<100||encoded.length>MAX_ARCHIVE_IMAGE_CHARS||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Ugyldige bildedata i prosjektfilen.');
 const binary=atob(encoded);
 if(binary.charCodeAt(0)!==255||binary.charCodeAt(1)!==216||binary.charCodeAt(2)!==255)
  throw Error('Prosjektfilen inneholder et bilde som ikke er JPEG.');
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
}
async function urlToBase64(url){
 const response=await fetch(url);
 if(!response.ok)throw Error('Kunne ikke lese et privat prøvebilde fra nettleseren.');
 const blob=await response.blob();
 if(blob.type!=='image/jpeg'||blob.size>6_750_000)throw Error('Et prøvebilde er for stort for prosjektfilen.');
 return binaryToBase64(new Uint8Array(await blob.arrayBuffer()));
}
function validArchiveBrief(brief){
 return !!brief&&brief.schema==='stratism-brief-v1'&&
 typeof brief.title==='string'&&brief.title.length<=100&&
 typeof brief.description==='string'&&brief.description.length>=12&&brief.description.length<=2000&&
 !!brief.style&&['muted olive green and warm ochre','restrained ultramarine and slate',
 'soft amber and oxblood','muted violet and mauve','neutral earth and linen'].includes(brief.style.palette)&&
 ['selected roots and trunk contours','the eyes and a few facial contours',
 'the principal architectural lines',"the main subject's distinctive features"].includes(brief.style.emphasis)&&
 ['subtle','very subtle','moderate but subordinate to subject'].includes(brief.style.colour_strength);
}
function saveDownload(data,name){
 const blob=new Blob([data],{type:'application/json'});
 const url=URL.createObjectURL(blob);
 const link=document.createElement('a');
 link.href=url;link.download=name;
 document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function serializePrivateProject(){
 if(!state.brief)throw Error('Opprett en brief før lagring.');
  const variants=[];
  for(const v of state.variants){
   variants.push({variation:v.variation,createdAt:v.createdAt,showRevision:!!v.showRevision,
    image_base64:await urlToBase64(v.url),revision:v.revision?{
      mode:v.revision.mode,createdAt:v.revision.createdAt,
      image_base64:await urlToBase64(v.revision.url)
    }:null});
  }
  const brief={...state.brief,reference_metadata:null};
  const archive={schema:ARCHIVE_SCHEMA,saved_at:new Date().toISOString(),brief,
   variants,selected_variant:state.selectedVariant,
   approvals:{commercial_release:false,print_release:false}};
  const json=JSON.stringify(archive);
  return json;
}
$('stratism-export-project').addEventListener('click',async()=>{
 if(state.busy||!state.brief)return;
 state.busy=true;refreshVariantUI();
 $('stratism-brief-status').textContent='Pakker privat prosjektfil…';
 try{
  const json=await serializePrivateProject();
  if(json.length>MAX_ARCHIVE_BYTES)throw Error('Prosjektet overskrider sikker størrelsesgrense for lokal eksport.');
  const slug=state.brief.title.toLowerCase().normalize('NFKD')
   .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'kunstverk';
  saveDownload(json,'stratism-'+slug+'.json');
  $('stratism-brief-status').textContent='Prosjektfil lastet ned på din enhet. Ta en sikkerhetskopi; dette er ikke skylagring.';
 }catch(error){$('stratism-brief-status').textContent=error.message}
 finally{state.busy=false;refreshVariantUI()}
});
function restorePrivateProject(archive){
 let temporaryUrls=[];
 try{
  if(archive?.schema!==ARCHIVE_SCHEMA||!validArchiveBrief(archive.brief)||
   !Array.isArray(archive.variants)||archive.variants.length>MAX_VARIANTS||
   archive.approvals?.commercial_release!==false||archive.approvals?.print_release!==false)
   throw Error('Ugyldig eller ukjent Stratism-prosjektformat.');
  if(!Number.isInteger(archive.selected_variant)||archive.selected_variant< -1||
   archive.selected_variant>=archive.variants.length||
   (archive.variants.length>0&&archive.selected_variant===-1))
   throw Error('Ugyldig valg i prosjektfilen.');
  const restored=[];
  for(let i=0;i<archive.variants.length;i++){
   const entry=archive.variants[i];
   if(entry?.variation!==i+1||typeof entry.createdAt!=='string'||
    entry.createdAt.length>50)throw Error('Ugyldig prosjektvariant.');
   const url=base64ToJpegUrl(entry.image_base64);temporaryUrls.push(url);
   let revision=null;
   if(entry.revision!=null){
    if(!['subtler-colour','preserve-details','more-linen','remove-texture'].includes(entry.revision.mode)||
      typeof entry.revision.createdAt!=='string'||entry.revision.createdAt.length>50)
      throw Error('Ugyldig revidert prosjektbilde.');
    const revUrl=base64ToJpegUrl(entry.revision.image_base64);temporaryUrls.push(revUrl);
    revision={url:revUrl,mode:entry.revision.mode,createdAt:entry.revision.createdAt};
   }
   restored.push({url,variation:i+1,createdAt:entry.createdAt,revision,
    showRevision:!!revision&&entry.showRevision===true});
  }
  // Only commit restored data after every image and field has been validated.
  for(const old of state.variants){URL.revokeObjectURL(old.url);if(old.revision)URL.revokeObjectURL(old.revision.url)}
  state.variants=restored;state.selectedVariant=archive.selected_variant;
  state.brief={...archive.brief,reference_metadata:null,
   production:{provider:'NOT_CONNECTED',generation_status:'BRIEF_ONLY',
    commercial_release:false,print_release:false,human_approval_required:true}};
  $('stratism-title').value=state.brief.title;
  $('stratism-source').value=state.brief.reference_note||'';
  $('stratism-description').value=state.brief.description;
  $('stratism-chord').value=state.brief.style.palette;
  $('stratism-emphasis').value=state.brief.style.emphasis;
  $('stratism-strength').value=state.brief.style.colour_strength;
  output.textContent=state.brief.render_instruction||'Stratism-brief hentet fra prosjektfil.';
  // No original reference image is in the archive; require re-selection before image edits.
  referenceInput.value='';state.reference=null;
  if(state.previewUrl){URL.revokeObjectURL(state.previewUrl);state.previewUrl=null}
  $('stratism-reference-preview').hidden=true;
  $('stratism-reference-preview').removeAttribute('src');
  $('stratism-reference-status').textContent='Referansefoto må velges på nytt etter import.';
  $('stratism-print-capacity').textContent='Originalt referansefoto er ikke lagret i prosjektfilen.';
  $('stratism-download-brief').disabled=false;
  temporaryUrls=[];
  $('stratism-brief-status').textContent='Privat prosjekt åpnet. Bilder og revisjoner er gjenopprettet; ingen publisering.';
 }catch(error){
 for(const url of temporaryUrls)URL.revokeObjectURL(url);
 throw error;
 }
}
$('stratism-import-project').addEventListener('change',async()=>{
 const input=$('stratism-import-project');
 const file=input.files?.[0];
 input.value='';
 if(!file||state.busy)return;
 state.busy=true;refreshVariantUI();
 try{
  if(file.size>MAX_ARCHIVE_BYTES||file.size<20)throw Error('Prosjektfilen er ugyldig eller for stor.');
  const archive=JSON.parse(await file.text());
  restorePrivateProject(archive);
 }catch(error){
  $('stratism-brief-status').textContent='Import mislyktes: '+error.message;
 }finally{state.busy=false;refreshVariantUI()}
});

$('stratism-reset-variants').addEventListener('click',()=>{
 if(state.busy)return;
 clearVariants();
 $('stratism-brief-status').textContent='Lokale bildeforslag er tømt. Ingen endringer i galleriet.';
});

})();