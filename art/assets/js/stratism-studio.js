(()=>{'use strict';
const $=id=>document.getElementById(id);
const form=$('stratism-brief-form');if(!form)return;
const output=$('stratism-brief-output');
const state={brief:null};
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
  schema:'stratism-brief-v1',title,description,reference_note:source||null,
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