(()=>{'use strict';
const $=id=>document.getElementById(id);
const form=$('stratism-brief-form');if(!form)return;
const output=$('stratism-brief-output');
const state={brief:null,reference:null,previewUrl:null};
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
const referenceInput=$('stratism-reference-file');
referenceInput.addEventListener('change',async()=>{
 const file=referenceInput.files?.[0];
 state.reference=null;
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
 try{state.brief=buildBrief();output.textContent=state.brief.render_instruction;
 $('stratism-brief-status').textContent='Brief opprettet lokalt. Ingen bildejobb er sendt og ingenting er publisert.';
 $('stratism-download-brief').disabled=false;}
 catch(error){$('stratism-brief-status').textContent=error.message;output.textContent='';state.brief=null;$('stratism-download-brief').disabled=true;}
});
$('stratism-download-brief').addEventListener('click',()=>{
 if(!state.brief)return;
 const data=JSON.stringify(state.brief,null,2);
 const blob=new Blob([data],{type:'application/json'});
 const link=document.createElement('a');const url=URL.createObjectURL(blob);
 link.href=url;link.download='stratism-brief.json';document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),500);
});
})();