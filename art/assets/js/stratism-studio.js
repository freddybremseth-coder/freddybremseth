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
function validationMessage(code){
 const messages={
  INVALID_SOURCE_OR_COMPOSITION:'Velg en gyldig kilde og komposisjon, og lag en ny brief.',
  CLIENT_CONSENT_REQUIRED:'Bekreft kundens samtykke til bruk av referansebildet.',
  INVALID_PRESET:'Velg en gyldig Stratism-modell og lag en ny brief.',
  DESCRIPTION_REQUIRED:'Beskriv motivet med minst 12 tegn.',
  INVALID_VARIATION:'Velg et gyldig bildeforslag (1–3).',
  INVALID_REFINEMENT:'Denne revisjonsmetoden eller kombinasjonen av bilder er ikke gyldig.',
  UNEXPECTED_QUALITY_REVIEW:'Kvalitetslisten kan bare brukes ved kvalitetsstyrt revisjon.',
  INVALID_REFERENCE:'Referansebildet kunne ikke leses som gyldig JPEG. Velg bildet på nytt.',
  INVALID_REFERENCE_DIMENSIONS:'Referansebildet har ugyldige dimensjoner. Velg et annet bilde.',
  MISSING_REVISION_IMAGE:'Originalbildet til revisjonen mangler. Velg et bilde først.',
  PHOTO_REQUIRED:'Et virkelig motiv krever at du velger et referansefoto.',
  PHOTO_RIGHTS_REQUIRED:'Bekreft bruksretten til referansefotografiet.',
  INVALID_QUALITY_REVIEW:'Marker minst ett gyldig kriterium som skal forbedres.'
 };
 return messages[code]||'Kunstforespørselen ble avvist. Kontroller motivet, bildene og innstillingene.';
}
function providerErrorMessage(response,data){
 if(response.status===400)return validationMessage(data?.code);
 if(response.status===401)return 'Innloggingen er utløpt. Logg inn igjen og kontroller AI-motoren.';
 if(response.status===403)return 'Kontoen er ikke godkjent som galleriadministrator.';
 if(response.status===503)return 'AI-generering er deaktivert eller ikke konfigurert. Kontroller AI-motoren.';
 const byCode={
  PROVIDER_RATE_LIMIT:'Bildeleverandøren har nådd en grense for forespørsler eller tilgjengelig kvote. Ingen nytt forsøk startes automatisk.',
  PROVIDER_AUTH:'OpenAI API-nøkkelen er ikke gyldig. Kontroller Vercel-konfigurasjonen.',
  PROVIDER_ACCESS:'API-kontoen mangler tilgang til valgt bildemodell. Kontroller modellrettigheter.',
  PROVIDER_INVALID_REQUEST:'Bildeleverandøren avviste bildeinnstillingene. Kontroller modell og bildeformat.',
  PROVIDER_UNAVAILABLE:'Bildeleverandøren er midlertidig utilgjengelig. Ingen automatisk ny forespørsel sendes.'
 };
 return byCode[data?.code]||String(data?.error||'Kunne ikke generere bilde.').slice(0,180);
}
function approveImageCharge(action){
 return window.confirm(action+' sender ett betalt AI-bildekall. Ingen automatisk publisering eller printgodkjenning. Vil du fortsette?');
}
const providerReadiness={checked:false,canGenerate:false,checking:false,model:null};
async function checkProviderReadiness(){
 if(providerReadiness.checking||state.busy)return;
 providerReadiness.checking=true;
 $('stratism-provider-readiness').textContent='Kontrollerer AI-motoren – ingen bildejobb startes…';
 $('stratism-check-provider').disabled=true;
 try{
  const getToken=window.ART_ADMIN_GET_ACCESS_TOKEN;
  if(typeof getToken!=='function')throw Error('Logg inn som galleriadministrator først.');
  const send=async(forceRefresh)=>fetch('/api/stratism-readiness',{method:'GET',
   headers:{Authorization:'Bearer '+await getToken({forceRefresh})},cache:'no-store'});
  let response=await send(false);
  if(response.status===401)response=await send(true);
  const data=await response.json();
  if(!response.ok)throw Error(String(data.error||'Kunne ikke kontrollere AI-status').slice(0,160));
  providerReadiness.checked=true;
  providerReadiness.canGenerate=data.can_generate===true&&data.preview_only===true&&
   data.sale_approval===false&&data.print_approval===false;
  providerReadiness.model=typeof data.model==='string'?data.model:null;
  const blockers=Array.isArray(data.blockers)?data.blockers:[];
  const reasons=[];
  if(blockers.includes('GENERATION_DISABLED'))reasons.push('Privat generering er deaktivert i Vercel');
  if(blockers.includes('PROVIDER_KEY_MISSING'))reasons.push('OpenAI API-nøkkel mangler i dette miljøet');
  $('stratism-provider-readiness').textContent=providerReadiness.canGenerate?
   'Konfigurasjonen er klar ('+providerReadiness.model+'). Modelltilgang og kreditter er IKKE bekreftet hos OpenAI. Ingen bildekall er utført.':
   (reasons.length?reasons.join('. ')+'. ':'AI-generering er ikke konfigurert her. ')+
    'Du kan fortsatt lage brief, kontrollere bilder og lagre prosjekter uten kostnad.';
 }catch(e){
  providerReadiness.checked=false;providerReadiness.canGenerate=false;
  $('stratism-provider-readiness').textContent='Kunne ikke bekrefte AI-tilkoblingen: '+e.message;
 }finally{
  providerReadiness.checking=false;
  $('stratism-check-provider').disabled=state.busy;
  refreshVariantUI();
 }
}
$('stratism-check-provider').addEventListener('click',checkProviderReadiness);
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
const STRATISM_PRESET_IDS=['stratum-no4-v1','olivos-de-biar-v1','stratism-working-v09'];
const PRESET_HELP=Object.freeze({
 'stratum-no4-v1':'Hovedmodell (Stratum No. 4): én sterk turkis fargeakkord, presise detaljer, bred ugjennomsiktig maling, mauve vask og lange dryp, skrapet stamme og naturlig rå lin. Format 4:5.',
 'olivos-de-biar-v1':'Bevart første oliventremodell (Olivos de Biar): naturtro bladverk og stamme, myk overgang mot bar lin og fine blyantrøtter. Ingen påtvungne farge- eller skrapebånd.',
 'stratism-working-v09':'Bevart opprinnelig eksperimentell Stratism-motor v0.9. Fem stadier med en friere malerisk overgang, som tidligere.'
});
function activePreset(){return $('stratism-preset').value;}
function updatePresetDescription(){
 $('stratism-preset-description').textContent=PRESET_HELP[activePreset()]||PRESET_HELP['stratum-no4-v1'];
}
const MAX_VARIANTS=3;
const QUALITY_FIELDS=['subject','colour','brush','transitions','linen','texture'];
const QUALITY_VALUES=['pending','pass','revise'];
const QUALITY_LABELS=Object.freeze({
 'stratum-no4-v1':Object.freeze({
  subject:'Motivets identitet gjennom fem materialtilstander',
  colour:'Én tydelig, mettet fargeakkord – ingen konkurrerende farge',
  brush:'Bred, ugjennomsiktig maling med synlige penselkanter',
  transitions:'Fem ulike overganger, mauve vask og utvalgte lange dryp',
  linen:'Bar beige lin, grafittspor og diskré signatur',
  texture:'Ingen digital skjellstruktur eller kunstig relieff'
 }),
 'three-anchors':Object.freeze({
  subject:'Samme gjenkjennelige motiv gjennom hele komposisjonen',
  colour:'Én sterk fargeakkord malt som ugjennomsiktig flate',
  brush:'Tydelige malte flater fremfor digital glød',
  transitions:'Gjennomsiktig vask og lange dryp – uten fem faste bånd',
  linen:'Synlig lin og grafittskisse av samme motiv',
  texture:'Ingen mekanisk tekstur eller påtvunget skrapebånd'
 }),
 'olivos-de-biar-v1':Object.freeze({
  subject:'Naturtro tre, stamme, grener og særpreg',
  colour:'Dempede olivengrønne og naturlige jordfarger',
  brush:'Myke, detaljerte penselstrøk – ingen kunstig glød',
  transitions:'Organisk, myk overgang til bar lin – ikke tvungne dryp',
  linen:'Naturlig lin og fine grafittspor av røttene',
  texture:'Ingen digital skjellstruktur eller kraftige skrapelag'
 }),
 'stratism-working-v09':Object.freeze({
  subject:'Samme motiv bevart gjennom eksperimentelle overganger',
  colour:'Dempet, sammenhengende følelsesmessig fargeuttrykk',
  brush:'Troverdig maling uten mekaniske filtereffekter',
  transitions:'Asymmetriske frie overganger uten stive bånd',
  linen:'Bar lin og varsomme grafittspor',
  texture:'Ingen repetitiv digital tekstur'
 })
});
function activeQualityLabels(){
 const preset=state.brief?.preset||activePreset();
 return QUALITY_LABELS[preset==='stratum-no4-v1'&&state.brief?.composition_mode==='three-anchors'?'three-anchors':preset]
   ||QUALITY_LABELS['stratum-no4-v1'];
}
function qualityFor(variant){
 if(!variant)return null;
 const key=variant.showRevision&&variant.revision?'revision':'original';
 variant.reviews??={};
 variant.reviews[key]??={ratings:{},notes:'',updated_at:null};
 return variant.reviews[key];
}
function failedQualityKeys(variant){
 const review=variant?.reviews?.original;
 return QUALITY_FIELDS.filter(key=>review?.ratings?.[key]==='revise');
}
function refreshRefinementHint(){
 const variant=state.variants[state.selectedVariant];
 const qa=$('stratism-refinement-kind').value==='qa-guided';
 const failed=failedQualityKeys(variant);
 $('stratism-refine-selected').disabled=!variant||!!variant.revision||state.busy||!providerReadiness.canGenerate||(qa&&failed.length===0);
 $('stratism-refine-hint').textContent=qa?
  failed.length?failed.length+' kontrollpunkter markert for målrettet revisjon. Bare originalen redigeres; den beholdes.':
  'Marker minst ett punkt som «Må forbedres» på originalbildet, eller velg én manuell forbedring.':
  'Ett målrettet AI-kall. Originalen beholdes alltid.';
}
$('stratism-refinement-kind').addEventListener('change',refreshRefinementHint);
function validateQuality(value){
 if(value==null)return null; // Compatibility with archives from before reviews existed.
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ugyldig kunstnerisk vurdering.');
 if(Object.keys(value).some(key=>!['original','revision'].includes(key)))throw Error('Ukjent vurderingsfelt i prosjektet.');
 for(const key of ['original','revision']){
  const record=value[key];if(record==null)continue;
  if(typeof record!=='object'||Array.isArray(record)||
    !record.ratings||typeof record.ratings!=='object'||Array.isArray(record.ratings)||
    Object.keys(record).some(field=>!['ratings','notes','updated_at'].includes(field))||
    typeof record.notes!=='string'||record.notes.length>700||
    (record.updated_at!==null&&record.updated_at!==undefined&&
     (typeof record.updated_at!=='string'||record.updated_at.length>40)))throw Error('Ugyldig vurderingsnotat.');
  for(const [criterion,status] of Object.entries(record.ratings)){
   if(!QUALITY_FIELDS.includes(criterion)||!QUALITY_VALUES.includes(status))throw Error('Ugyldig vurderingsstatus.');
  }
 }
 return value;
}
function updateQualityUI(){
 const selected=state.variants[state.selectedVariant],review=qualityFor(selected);
 const mode=state.brief?.preset==='olivos-de-biar-v1'?'Olivos de Biar – vurder myk naturtro gjengivelse, ikke et påtvunget turkisbånd.':
  state.brief?.preset==='stratism-working-v09'?'Stratism Original – vurder et helhetlig, eksperimentelt uttrykk.':
  state.brief?.composition_mode==='three-anchors'?'Tre kjennetegn – fargeflate, dryp og grafitt/lin er grunnkrav.':
  'Stratum No. 4 – vurder alle fem materialtilstandene og bare én mettet fargeakkord.';
 $('stratism-quality-context').textContent=mode+' Manuell vurdering – aldri automatisk salgs- eller printgodkjenning.';
 const controls=[...document.querySelectorAll('[data-stratism-quality]')];
 const labels=activeQualityLabels();
 for(const control of controls){
  const label=control.closest('label');
  if(label&&label.firstChild?.nodeType===3)label.firstChild.nodeValue=labels[control.dataset.stratismQuality]+' ';
  control.value=review?.ratings?.[control.dataset.stratismQuality]||'pending';
  control.disabled=!selected||state.busy;
 }
 $('stratism-quality-notes').value=review?.notes||'';
 $('stratism-quality-notes').disabled=!selected||state.busy;
 const statuses=controls.map(control=>control.value);
 const passed=statuses.filter(x=>x==='pass').length,failed=statuses.filter(x=>x==='revise').length;
 refreshRefinementHint();
 if(selected?.revision)updateRevisionComparison(selected);
 $('stratism-quality-status').textContent=!selected?'Velg et forslag for kunstnerisk gjennomgang.':
  failed?failed+' punkter trenger forbedring · '+passed+' av 6 bestått.':
  passed===6?'Alle seks manuelle kontrollpunkter er bestått. Dette er IKKE salg- eller printgodkjenning.':
  passed+' av 6 kontrollpunkter bestått. Resten er ikke vurdert.';
}
document.querySelectorAll('[data-stratism-quality]').forEach(control=>{
 control.addEventListener('change',()=>{
  if(state.busy)return;
  const review=qualityFor(state.variants[state.selectedVariant]);if(!review)return;
  review.ratings[control.dataset.stratismQuality]=control.value;
  review.updated_at=new Date().toISOString();updateQualityUI();
 });
});
$('stratism-quality-notes').addEventListener('input',()=>{
 if(state.busy)return;
 const review=qualityFor(state.variants[state.selectedVariant]);if(!review)return;
 review.notes=$('stratism-quality-notes').value.slice(0,700);
 review.updated_at=new Date().toISOString();
});
function reviewScore(variant,kind){
 const ratings=variant?.reviews?.[kind]?.ratings||{};
 const passed=QUALITY_FIELDS.filter(key=>ratings[key]==='pass').length;
 const failed=QUALITY_FIELDS.filter(key=>ratings[key]==='revise').length;
 const remaining=6-passed-failed;
 return passed+' av 6 bestått'+(failed?' · '+failed+' må forbedres':'')+(remaining?' · '+remaining+' ikke vurdert':'');
}
function chooseComparedVersion(showRevision){
 const selected=state.variants[state.selectedVariant];
 if(!selected?.revision||state.busy)return;
 selected.showRevision=showRevision;
 refreshVariantUI();
}
$('stratism-choose-original').addEventListener('click',()=>chooseComparedVersion(false));
$('stratism-choose-revision').addEventListener('click',()=>chooseComparedVersion(true));
function updateRevisionComparison(selected){
 const panel=$('stratism-before-after');
 const visible=!!(selected?.revision&&selected?.url&&selected.revision.url);
 panel.hidden=!visible;
 $('stratism-choose-original').disabled=!visible||state.busy;
 $('stratism-choose-revision').disabled=!visible||state.busy;
 $('stratism-choose-original').setAttribute('aria-pressed',String(visible&&!selected.showRevision));
 $('stratism-choose-revision').setAttribute('aria-pressed',String(visible&&!!selected.showRevision));
 if(!visible){
  $('stratism-compare-original').removeAttribute('src');
  $('stratism-compare-revision').removeAttribute('src');
  $('stratism-original-score').textContent='';
  $('stratism-revision-score').textContent='';
  return;
 }
 $('stratism-compare-original').src=selected.url;
 $('stratism-compare-revision').src=selected.revision.url;
 $('stratism-original-score').textContent=' · '+reviewScore(selected,'original');
 $('stratism-revision-score').textContent=' · '+reviewScore(selected,'revision');
}
const STRATISM_PRINT_TARGETS=Object.freeze({
 '40x50':{shortCm:40,longCm:50},
 '60x75':{shortCm:60,longCm:75},
 '80x100':{shortCm:80,longCm:100},
 '30x40':{shortCm:30,longCm:40}
});
function calculateConceptPrintPlan(target,conceptWidth=1280,conceptHeight=1600){
 const size=STRATISM_PRINT_TARGETS[target];
 if(!size)throw Error('Ukjent printstørrelse.');
 const requiredWidth=Math.ceil(size.shortCm/CM_PER_INCH*300);
 const requiredHeight=Math.ceil(size.longCm/CM_PER_INCH*300);
 const scale=Math.max(requiredWidth/conceptWidth,requiredHeight/conceptHeight);
 const ratioMatches=Math.abs(conceptWidth/conceptHeight-size.shortCm/size.longCm)<=0.015;
 return {requiredWidth,requiredHeight,scale,ratioMatches,
  shortCm:size.shortCm,longCm:size.longCm,ppi:300,approved:false};
}
function updatePrintPlan(selected){
 const target=$('stratism-print-target').value;
 const plan=calculateConceptPrintPlan(target);
 const result=$('stratism-print-plan-result');
 result.textContent=plan.shortCm+' × '+plan.longCm+' cm ved 300 PPI krever minst '+
  plan.requiredWidth.toLocaleString('no-NO')+' × '+plan.requiredHeight.toLocaleString('no-NO')+
  ' piksler. Sammenlignet med nye 1280 × 1600-konsepter kreves minst ca. '+
  plan.scale.toFixed(1)+'× lineær oppskalering.'+
  (plan.ratioMatches?' Formatet er 4:5.':' Formatet avviker fra 4:5 og krever et bevisst valg om beskjæring eller omkomponering.')+
  (selected?' Valgt '+(selected.showRevision&&selected.revision?'revisjon':'original')+
   ' er fortsatt en privat prøve.':' Ingen prøve er valgt.')+
  ' Dette er kun en kravberegning, ikke en faktisk oppskalering eller printgodkjenning.';
}
$('stratism-print-target').addEventListener('change',()=>updatePrintPlan(state.variants[state.selectedVariant]));
function updateConceptFileStatus(selected){
 const output=$('stratism-concept-resolution');
 if(!selected){
  output.textContent='Nye AI-konsepter produseres i 1280 × 1600 px. Velg et forslag for å lese om oppløsning og printbegrensninger.';
  return;
 }
 const shortCm=(1280/300*CM_PER_INCH).toFixed(1);
 const longCm=(1600/300*CM_PER_INCH).toFixed(1);
 output.textContent='Valgt '+(selected.showRevision&&selected.revision?'revisjon':'original')+
  ': privat JPEG-konsept. Nye AI-konsepter på 1280 × 1600 px tilsvarer bare ca. '+
  shortCm+' × '+longCm+' cm ved 300 piksler per tomme (PPI). '+
  'Arkiverte bilder kan ha andre dimensjoner. Ingen fil er godkjent for print eller digitalt salg.';
}
// Standalone local screening; never uploads the candidate or marks it sale/print approved.
function parseTiffDimensions(buffer){
 const view=new DataView(buffer);
 if(view.byteLength<16)throw Error('TIFF-filen har for lite lesbar metadata.');
 const order=view.getUint16(0,false),le=order===0x4949;
 if(!le&&order!==0x4d4d)throw Error('Ukjent TIFF-byteorden.');
 if(view.getUint16(2,le)!==42)throw Error('Ugyldig TIFF-signatur.');
 const ifd=view.getUint32(4,le);
 if(ifd<8||ifd+2>view.byteLength)throw Error('TIFF-metadata ligger utenfor kontrollområdet.');
 const count=view.getUint16(ifd,le);
 if(count>4096||ifd+2+count*12>view.byteLength)throw Error('TIFF-metadata er ikke lesbar.');
 let width=0,height=0,orientation=1;
 for(let i=0;i<count;i++){
  const p=ifd+2+i*12,tag=view.getUint16(p,le),type=view.getUint16(p+2,le);
  const elements=view.getUint32(p+4,le);
  if((tag!==256&&tag!==257&&tag!==274)||elements!==1||(type!==3&&type!==4))continue;
  const value=type===3?view.getUint16(p+8,le):view.getUint32(p+8,le);
  if(tag===256)width=value;
  else if(tag===257)height=value;
  else orientation=value;
 }
 if(width<32||height<32||width>50000||height>50000||width*height>800_000_000)
  throw Error('TIFF-filen mangler gyldig bredde eller høyde.');
 if(orientation<1||orientation>8)throw Error('Ugyldig TIFF-orientering.');
 // TIFF orientations 5–8 rotate display dimensions by 90 degrees.
 const rotates=orientation>=5;
 return {width:rotates?height:width,height:rotates?width:height,
  metadataOnly:true,orientation,rotationApplied:rotates};
}
function screenMasterDimensions(width,height,target){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<32||height<32||
  width>50000||height>50000||width*height>800_000_000)throw Error('Ugyldige bildedimensjoner.');
 const plan=calculateConceptPrintPlan(target);
 const short=Math.min(width,height),long=Math.max(width,height);
 const requiredShort=Math.min(plan.requiredWidth,plan.requiredHeight);
 const requiredLong=Math.max(plan.requiredWidth,plan.requiredHeight);
 const pixelPass=short>=requiredShort&&long>=requiredLong;
 const ratioMatches=Math.abs(short/long-plan.shortCm/plan.longCm)<=0.015;
 return {pixelPass,ratioMatches,approved:false,requiredShort,requiredLong};
}
let masterCandidate=null,masterCandidateFile=null,masterInspectionId=0,webExportBusy=false;
function refreshWebExportButton(){
 $('stratism-export-web').disabled=webExportBusy||!masterCandidate||!masterCandidateFile||masterCandidate.metadataOnly;
}
function updateMasterCheck(){
 const el=$('stratism-master-check');
 if(!masterCandidate){
  el.textContent='Ingen masterfil kontrollert. Filen blir ikke lastet opp, lagret eller godkjent.';
  return;
 }
 const {width,height,metadataOnly,name}=masterCandidate;
 const result=screenMasterDimensions(width,height,$('stratism-print-target').value);
 el.textContent=name+' · '+width.toLocaleString('no-NO')+' × '+height.toLocaleString('no-NO')+
  ' px. '+(result.pixelPass?'Pikselkravet er oppfylt.':'Pikselkravet er IKKE oppfylt.')+
  (result.ratioMatches?' Sideforholdet stemmer.':' Sideforholdet krever beskjæring eller omkomponering.')+
  (metadataOnly?' TIFF-dimensjonene er kun lest fra metadata for første bilde; bildeinnholdet er ikke dekodet.':'')+
  (masterCandidate.rotationApplied?' TIFF-orientering er tatt med i dimensjonene.':'')+
  ' Filen er bare vurdert lokalt for piksler og format, ikke kunstnerisk kvalitet, fargerom, kilde eller printgodkjenning.';
}
async function inspectPrivateMasterFile(file){
 if(!file||file.size<100||file.size>200*1024*1024)throw Error('Velg en masterfil på 100 byte–200 MB.');
 const isTiff=/\.(tif|tiff)$/i.test(file.name)||file.type==='image/tiff';
 if(isTiff){
  const metadata=await file.slice(0,256*1024).arrayBuffer();
  return {...parseTiffDimensions(metadata),name:file.name.slice(0,120)};
 }
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))
  throw Error('Kun JPG, PNG, WebP og TIFF støttes.');
 const bmp=await createImageBitmap(file);
 try{return {width:bmp.width,height:bmp.height,name:file.name.slice(0,120),metadataOnly:false};}
 finally{bmp.close();}
}
$('stratism-master-file').addEventListener('change',async()=>{
 const input=$('stratism-master-file'),file=input.files?.[0];
 const inspectionId=++masterInspectionId;
 masterCandidate=null;masterCandidateFile=null;
 refreshWebExportButton();
 $('stratism-web-export-status').textContent='Ingen webfil laget. Originalen er uendret.';
 if(!file){updateMasterCheck();return;}
 $('stratism-master-check').textContent='Kontrollerer filen lokalt – ingen opplasting…';
 try{
  const inspected=await inspectPrivateMasterFile(file);
  if(inspectionId!==masterInspectionId)return;
  masterCandidate=inspected;
  masterCandidateFile=inspected.metadataOnly?null:file;
  refreshWebExportButton();
  updateMasterCheck();
 }catch(error){
  if(inspectionId!==masterInspectionId)return;
  $('stratism-master-check').textContent='Kontroll mislyktes: '+error.message+
   ' Ingen fil er godkjent eller lastet opp.';
 }
});
$('stratism-print-target').addEventListener('change',updateMasterCheck);
function webDerivativeSize(width,height,maxEdge=1600){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)
  throw Error('Ugyldige bildedimensjoner.');
 const scale=Math.min(1,maxEdge/Math.max(width,height));
 return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}
async function createLocalWebDerivative(file){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type))
  throw Error('Velg en JPG-, PNG- eller WebP-master.');
 const bitmap=await createImageBitmap(file);
 try{
  const size=webDerivativeSize(bitmap.width,bitmap.height);
  const canvas=document.createElement('canvas');
  canvas.width=size.width;canvas.height=size.height;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx)throw Error('Nettleseren kunne ikke klargjøre bildefilen.');
  // Flatten transparent pixels onto a neutral background; never alter the source file.
  ctx.fillStyle='#f4f0e8';ctx.fillRect(0,0,size.width,size.height);
  ctx.drawImage(bitmap,0,0,size.width,size.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(
   result=>result?resolve(result):reject(Error('Kunne ikke eksportere JPEG-bilde.')),'image/jpeg',0.88));
  if(blob.type!=='image/jpeg'||blob.size<100||blob.size>15*1024*1024)
   throw Error('Webfilen kunne ikke kontrolleres etter eksport.');
  return {blob,width:size.width,height:size.height};
 }finally{bitmap.close();}
}
$('stratism-export-web').addEventListener('click',async()=>{
 if(webExportBusy||!masterCandidateFile||!masterCandidate||masterCandidate.metadataOnly)return;
 const file=masterCandidateFile,inspectionId=masterInspectionId;
 webExportBusy=true;refreshWebExportButton();
 $('stratism-web-export-status').textContent='Lager lokal webprøve – ingen opplasting…';
 try{
  const derivative=await createLocalWebDerivative(file);
  if(inspectionId!==masterInspectionId){
   $('stratism-web-export-status').textContent='Kildefilen ble endret. Webeksport er avbrutt.';
   return;
  }
  const filename=file.name.replace(/\\.[^.]+$/,'').replace(/[^a-z0-9_-]/gi,'-').slice(0,65)||'stratism';
  const url=URL.createObjectURL(derivative.blob);
  try{
   const a=document.createElement('a');
   a.href=url;a.download=filename+'-web-preview-not-sale-approved.jpg';
   document.body.appendChild(a);a.click();a.remove();
  }finally{setTimeout(()=>URL.revokeObjectURL(url),1000)}
  $('stratism-web-export-status').textContent='Webprøve laget: '+derivative.width+' × '+derivative.height+
   ' px · '+(derivative.blob.size/1024).toFixed(0)+' kB. Originalen er uendret. Ikke salgs- eller printgodkjent.';
 }catch(error){
  $('stratism-web-export-status').textContent='Webeksport mislyktes: '+error.message;
 }finally{webExportBusy=false;refreshWebExportButton();}
});

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
 updatePrintPlan(selected);
 updateConceptFileStatus(selected);
 updateRevisionComparison(selected);
 const revisionSelect=$('stratism-revision-select');
 revisionSelect.replaceChildren();
 for(const [value,label] of [['0','Originalforslag'],...(selected?.revision?[['1','Forbedret versjon']]:[])]){
  const option=document.createElement('option');option.value=value;option.textContent=label;revisionSelect.appendChild(option);
 }
 revisionSelect.value=selected?.showRevision?'1':'0';
 revisionSelect.disabled=!selected||!selected.revision||state.busy;
 refreshRefinementHint();
 $('stratism-save-preview').disabled=!selected||state.busy;
 $('stratism-reset-variants').disabled=state.busy;
 $('stratism-export-project').disabled=!state.brief||state.busy;
 $('stratism-cloud-save').disabled=!state.brief||state.busy;
 $('stratism-cloud-refresh').disabled=state.busy;
 $('stratism-cloud-select').disabled=state.busy;
 $('stratism-cloud-open').disabled=state.busy||!$('stratism-cloud-select').value;
 $('stratism-import-project').disabled=state.busy;
 $('stratism-preflight').disabled=!state.brief||state.busy;
 $('stratism-reference-file').disabled=state.busy;
 for(const input of form.querySelectorAll('input,select,textarea,button'))input.disabled=state.busy;
 $('stratism-selected-description').textContent=state.selectedVariant<0?'Velg en prøve for å laste ned.':
  'Forslag '+(state.selectedVariant+1)+' er valgt til lokal nedlasting. Ikke salg- eller printgodkjent.';
 const generate=$('stratism-generate-private');
 generate.textContent=count?'Generer nytt forslag ('+(count+1)+' av '+MAX_VARIANTS+')':'Generer forslag 1 (AI)';
 generate.disabled=!state.brief||count>=MAX_VARIANTS||state.busy||!providerReadiness.canGenerate;
 $('stratism-check-provider').disabled=state.busy||providerReadiness.checking;
 updateQualityUI();
}
// Changing the chosen artistic model must not silently send an outdated brief.
form.addEventListener('change',event=>{
 if(state.busy)return;
 invalidatePreflight();
 // A previously imported client-photo project intentionally loses old rights confirmation.
 // Renewing that confirmation is NOT a new artistic brief: keep already-generated private art.
 if(event.target===$('stratism-reference-rights')){
  if(state.brief?.provenance){
   state.brief.provenance.reference_rights_confirmed=$('stratism-reference-rights').checked===true;
   $('stratism-brief-status').textContent=state.brief.provenance.reference_rights_confirmed?
    'Bruksrett bekreftet på nytt for dette prosjektet. Eksisterende kunstverk og vurderinger er beholdt.':
    'Bruksrett er ikke bekreftet. Bekreft den før videre AI-bruk av kundemotiv.';
  }
  refreshVariantUI();
  return;
 }
 updatePresetDescription();
 if(!state.brief)return;
 clearVariants();state.brief=null;output.textContent='Modellen eller innstillingene er endret. Lag en ny brief før generering.';
 $('stratism-download-brief').disabled=true;
 $('stratism-brief-status').textContent='Innstillinger endret. Lag ny brief før videre generering.';
 refreshVariantUI();
});
$('stratism-preset').addEventListener('change',()=>{
 if(activePreset()==='stratum-no4-v1')$('stratism-chord').value='cobalt turquoise and teal';
 else $('stratism-chord').value='muted olive green and warm ochre';
 updatePresetDescription();
});
updatePresetDescription();
function invalidatePreflight(){
 const node=$('stratism-preflight-status');
 if(node)node.textContent='Ingen gyldig gratis-test for gjeldende innstillinger. Lag en brief og test forespørselen på nytt.';
}
function clearVariants(){
 if(state.busy)return;
 for(const variant of state.variants){URL.revokeObjectURL(variant.url);if(variant.revision)URL.revokeObjectURL(variant.revision.url);}
 state.variants=[];state.selectedVariant=-1;refreshVariantUI();
}
const referenceInput=$('stratism-reference-file');
referenceInput.addEventListener('change',async()=>{
 if(state.busy)return;
 invalidatePreflight();
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
 const compositionMode=$('stratism-composition-rule').value;
 const sourceKind=$('stratism-source-kind').value;
 const place=clean($('stratism-place').value,140);
 const photoCredit=clean($('stratism-photo-credit').value,120);
 const story=clean($('stratism-story').value,1000);
 const referenceRights=$('stratism-reference-rights').checked;
 if(!['five-states','three-anchors'].includes(compositionMode)||!['concept','own-photo','client-photo'].includes(sourceKind))
  throw Error('Ukjent kilde eller komposisjonsregel.');
 if(sourceKind==='client-photo'&&!referenceRights)
  throw Error('Bekreft kundens samtykke til AI-bearbeiding.');

 const title=clean($('stratism-title').value,100)||'Untitled Stratism';
 const preset=activePreset();
 if(!STRATISM_PRESET_IDS.includes(preset))throw Error('Ukjent Stratism-modell.');
 return {
  schema:'stratism-brief-v1',title,description,preset,composition_mode:compositionMode,
  provenance:{source_kind:sourceKind,place,story,photo_credit:photoCredit,reference_rights_confirmed:referenceRights,
   verified:false},reference_note:source||null,reference_metadata:state.reference,
  style:{name:'Stratism',preset,rules_version:preset,sequence:['presence','feeling','memory','erasure','absence'],
   palette:chord,emphasis,colour_strength:strength,signature:'Freddy Bremseth',
   constraints:['one continuous subject','no broad dominant colour stripe','no global embossed texture',
    'no paper-flake simulation','preserve selected meaningful features','visible unpainted linen']},
  render_instruction:preset==='stratum-no4-v1'&&compositionMode==='three-anchors'?
   `Stratism three-anchor interpretation for ${description}. Mandatory: ONE saturated ${chord} band as flat opaque brush shapes with visible edges, THIN grey-mauve washes with long drips reaching the bare beige linen, and a delicate graphite sketch of ${emphasis} on the unprinted-looking digital linen with a small cursive signature. The five states remain the conceptual background, but composition may vary freely. No digital emboss or other strong colours; 4:5 portrait.`:
   preset==='olivos-de-biar-v1'?
   `Original Olivos de Biar model. Paint ${description} as a finely detailed, naturalistic, softly atmospheric olive-style artwork. Keep the subject recognizable and use delicate tempera-like brushwork, muted organic colours, natural fine raw linen gradually emerging below and pencil roots/defining contours. No saturated colour band and no scraped oxblood stripe. Avoid embossed uniform digital texture. 4:5 portrait, full subject visible, discreet Freddy Bremseth signature on the lower-right linen.`:
   preset==='stratum-no4-v1'?
   `Stratum No. 4 master. Paint ${description} with one coherent recognizable subject in FIVE states: finely precise matte tempera top, ONE saturated ${chord} chord as BROAD FLAT OPAQUE wet-into-wet paint with VISIBLE BRUSH EDGES (not a glow), NARROW THIN WATERY grey-mauve wash with LONG DRIPS, long horizontal DRAG MARKS WITH A FLAT BLADE in oxblood and grey-green, then BARE BEIGE LINEN with faint pencil traces. Preserve ${emphasis}. The background is quiet pale muted grey-blue sky and raw linen; no hills, distant secondary motifs or orange soil. No digital embossed scale pattern. Keep the full subject inside the 4:5 portrait. Sign Freddy Bremseth discreetly bottom-right.`:
   `Original working Stratism v0.9. Create one contemplative fine-art painting of ${description} with recognizable subject across presence, restrained feeling, translucent memory, selective abrasion and absence on bare linen. Emphasize ${emphasis}. Palette ${chord}; intensity ${strength}. Avoid repeated digital texture and hard collage bands. Portrait 4:5 and discreet Freddy Bremseth signature.`,
  production:{provider:'NOT_CONNECTED',generation_status:'BRIEF_ONLY',commercial_release:false,
   print_release:false,planned_assets:['web','digital-master','print-300ppi-after-proofing'],
   human_approval_required:true}
 };
}
form.addEventListener('submit',ev=>{
 ev.preventDefault();if(state.busy)return;
 invalidatePreflight();
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
async function prepareReferenceJpeg(){
 let referenceJpeg=null;
  // The original reference stays local; a resized JPEG derivative is sent only on an explicit preflight or generation click.
  // Resize a temporary derivative: never use this JPEG as a sale or print master.
  if(referenceInput.files?.[0]&&!state.reference)throw Error('Referansefotoet er ikke validert. Velg bildet på nytt.');
 if(referenceInput.files?.[0]&&state.reference){
   const img=$('stratism-reference-preview');
   if(!img.complete||!img.naturalWidth)throw Error('Referansefotoet er ikke ferdig innlest.');
   const maxEdge=1400,scale=Math.min(1,maxEdge/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
   canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
   const ctx=canvas.getContext('2d',{alpha:false});
   ctx.fillStyle='#f4f0e8';ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(img,0,0,canvas.width,canvas.height);
   const encoded=canvas.toDataURL('image/jpeg',0.76).split(',')[1];
   if(encoded.length>1_800_000)throw Error('Referansefotoet er for stort for sikker forhåndsvisning. Velg et mindre bilde.');
   referenceJpeg=encoded;
  }

 return referenceJpeg;
}
function requestFromCurrentBrief(variation,referenceJpeg){
 if(!state.brief)throw Error('Lag en kunstnerisk brief først.');
 return {description:state.brief.description,
  chord:state.brief.style.palette,emphasis:state.brief.style.emphasis,
  strength:state.brief.style.colour_strength,reference_jpeg_base64:referenceJpeg,
  variation,preset:state.brief.preset,composition_mode:state.brief.composition_mode||'five-states',
  source_kind:state.brief.provenance?.source_kind||'concept',
  place:state.brief.provenance?.place||'',story:state.brief.provenance?.story||'',
  photo_credit:state.brief.provenance?.photo_credit||'',
  reference_rights:state.brief.provenance?.reference_rights_confirmed===true};
}
async function preflightRequest(payload){
 const getToken=window.ART_ADMIN_GET_ACCESS_TOKEN;
 if(typeof getToken!=='function')throw Error('Logg inn som administrator først.');
 const send=async(forceRefresh)=>fetch('/api/stratism-preflight',{
  method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+await getToken({forceRefresh})},
  body:JSON.stringify(payload),cache:'no-store'
 });
 let response=await send(false);
 if(response.status===401)response=await send(true);
 return response;
}
async function verifyFreePreflight(payload){
 const response=await preflightRequest(payload);
 const data=await response.json();
 if(!response.ok)throw Error(response.status===400?validationMessage(data.code):
  String(data.error||'Kunstforespørselen ble avvist').slice(0,180));
 if(data.valid!==true||data.no_provider_call!==true||data.preview_only!==true||
    data.output_format!=='jpeg'||data.size!=='1280x1600'||
    data.preset!==payload.preset||data.composition_mode!==payload.composition_mode||
    data.source_kind!==payload.source_kind||
    data.reference_used!==!!(payload.reference_jpeg_base64||payload.revision_jpeg_base64)||
    data.variation!==payload.variation||data.revision!==(payload.revision_mode||null)||
    data.sale_approval!==false||data.print_approval!==false)
  throw Error('Gratis-testen svarte ikke på den samme forespørselen. Ingen bildegenerering er startet.');
 return data;
}
$('stratism-preflight').addEventListener('click',async()=>{
 if(state.busy||!state.brief)return;
 state.busy=true;refreshVariantUI();
 $('stratism-preflight-status').textContent='Tester kunstforespørselen uten bilde-API og uten kostnad…';
 try{
  const referenceJpeg=await prepareReferenceJpeg();
  const payload=requestFromCurrentBrief(Math.min(MAX_VARIANTS,state.variants.length+1),referenceJpeg);
  const data=await verifyFreePreflight(payload);
  $('stratism-preflight-status').textContent='Bestått: '+data.preset+' · '+data.size+' · '+
    (data.reference_used?'referansefoto kontrollert':'generering fra beskrivelse')+
    '. Ingen bilder generert eller lagret. Ingen kostnad.';
 }catch(e){
  $('stratism-preflight-status').textContent='Test ikke bestått: '+e.message;
 }finally{state.busy=false;refreshVariantUI();}
});
$('stratism-generate-private').addEventListener('click',async()=>{
 if(!state.brief||state.variants.length>=MAX_VARIANTS||state.busy)return;
 if(!providerReadiness.canGenerate){$('stratism-brief-status').textContent='Kontroller AI-motoren først. Generering starter aldri uten bekreftet tilkobling.';return;}
 if(referenceInput.files?.[0]&&!state.brief.provenance?.reference_rights_confirmed){$('stratism-brief-status').textContent='Bekreft bruksrett til referansebildet og lag ny brief.';return;}
 if(state.brief.provenance?.source_kind!=='concept'&&!referenceInput.files?.[0]){$('stratism-brief-status').textContent='Velg referansefoto for et virkelig motiv.';return;}
 state.busy=true;refreshVariantUI();
 const variation=state.variants.length+1;
 $('stratism-brief-status').textContent='Kontrollerer kunstforespørselen gratis før eventuell betaling…';
 try{
  const referenceJpeg=await prepareReferenceJpeg();
  const payload=requestFromCurrentBrief(variation,referenceJpeg);
  await verifyFreePreflight(payload);
  $('stratism-preflight-status').textContent='Gratis kontroll bestått for forslag '+variation+'. Ingen AI-kreditter brukt på kontrollen.';
  if(!approveImageCharge('Generering')){
   $('stratism-brief-status').textContent='Generering avbrutt. Gratis-testen er bestått; ingen bilde-API-kall startet.';
   return;
  }
  $('stratism-brief-status').textContent='Genererer privat Stratism-konsept (ingen publisering)…';
  const response=await stratismRequest(payload);
  const data=await response.json();
  if(!response.ok)throw Error(providerErrorMessage(response,data));
  if(data.not_print_approved!==true||data.not_sale_approved!==true||data.stored!==false||data.preset!==state.brief.preset||data.composition_mode!==(state.brief.composition_mode||'five-states'))
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
 a.download='stratism-private-concept-not-print-ready-'+variant.variation+(variant.showRevision?'-refined':'')+'.jpg';
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
 if(!providerReadiness.canGenerate){$('stratism-brief-status').textContent='AI-motoren må være aktivert før revisjon.';return;}
 state.busy=true;refreshVariantUI();
 $('stratism-brief-status').textContent='Kontrollerer revidert kunstforespørsel gratis før eventuell betaling…';
 try{

  const source=new Image();source.src=variant.url;await source.decode();
  const scale=Math.min(1,1400/Math.max(source.naturalWidth,source.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(source.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(source.naturalHeight*scale));
  const ctx=canvas.getContext('2d',{alpha:false});
  ctx.fillStyle='#f4f0e8';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(source,0,0,canvas.width,canvas.height);
  const imageData=canvas.toDataURL('image/jpeg',0.77).split(',')[1];
  if(imageData.length>1_800_000)throw Error('Prøvebildet er for stort for revisjon.');
  const mode=$('stratism-refinement-kind').value;
  const qaFailed=mode==='qa-guided'?failedQualityKeys(variant):null;
  if(mode==='qa-guided'&&!qaFailed.length)throw Error('Marker minst ett kvalitetskriterium for forbedring.');
  const payload={description:state.brief.description,chord:state.brief.style.palette,
    emphasis:state.brief.style.emphasis,strength:state.brief.style.colour_strength,
    variation:variant.variation,revision_mode:mode,revision_jpeg_base64:imageData,preset:state.brief.preset,
     composition_mode:state.brief.composition_mode||'five-states',
     source_kind:state.brief.provenance?.source_kind||'concept',
     place:state.brief.provenance?.place||'',story:state.brief.provenance?.story||'',
     photo_credit:state.brief.provenance?.photo_credit||'',
     reference_rights:state.brief.provenance?.reference_rights_confirmed===true,
     ...(mode==='qa-guided'?{qa_failed:qaFailed}:{})};
  await verifyFreePreflight(payload);
  $('stratism-preflight-status').textContent='Gratis kontroll bestått for målrettet revisjon. Ingen AI-kreditter brukt på kontrollen.';
  if(!approveImageCharge('Revisjon')){
   $('stratism-brief-status').textContent='Revisjonen ble avbrutt. Originalen er beholdt, og ingen bilde-API-kall startet.';
   return;
  }
  $('stratism-brief-status').textContent='Forbedrer valgt kunstverk. Originalen beholdes…';
  const response=await stratismRequest(payload);
  const data=await response.json();
  if(!response.ok)throw Error(providerErrorMessage(response,data));
  if(data.not_print_approved!==true||data.not_sale_approved!==true||data.stored!==false||data.refinement_applied!==mode||data.preset!==state.brief.preset||data.composition_mode!==(state.brief.composition_mode||'five-states'))
   throw Error('Uventet svar fra revisjonsmotoren.');
  const encoded=data.image_base64;
  if(typeof encoded!=='string'||encoded.length>9_000_000)throw Error('Ugyldig revisjonsbilde.');
  const binary=atob(encoded),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/jpeg'}));
  variant.revision={url,mode,createdAt:new Date().toISOString(),qa_failed:qaFailed||[]};
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
function inspectArchivedJpeg(bytes){
 if(bytes.length<100||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)
  throw Error('Ugyldig JPEG-bilde i prosjektfilen.');
 // JPEG segment scanner: dimensions are read from SOF, not inferred from a filename.
 for(let p=2;p+9<bytes.length;){
  if(bytes[p]!==255){p++;continue;}
  while(p<bytes.length&&bytes[p]===255)p++;
  const marker=bytes[p++];
  if(marker===217||marker===218)break;
  if(marker===216||marker===1||(marker>=208&&marker<=215))continue;
  if(p+2>bytes.length)break;
  const length=(bytes[p]<<8)|bytes[p+1];
  if(length<2||p+length>bytes.length)break;
  if((marker>=192&&marker<=195)||(marker>=197&&marker<=199)||
     (marker>=201&&marker<=203)||(marker>=205&&marker<=207)){
   if(length<7)break;
   const height=(bytes[p+3]<<8)|bytes[p+4];
   const width=(bytes[p+5]<<8)|bytes[p+6];
   if(width<32||height<32||width>12000||height>12000||width*height>80_000_000)
    throw Error('Bildet i prosjektfilen har ugyldig oppløsning.');
   return {width,height};
  }
  p+=length;
 }
 throw Error('Prosjektbildet mangler lesbar JPEG-oppløsning.');
}
function base64ToJpegUrl(encoded){
 if(typeof encoded!=='string'||encoded.length<100||encoded.length>MAX_ARCHIVE_IMAGE_CHARS||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Ugyldige bildedata i prosjektfilen.');
 const binary=atob(encoded);
 if(binary.charCodeAt(0)!==255||binary.charCodeAt(1)!==216||binary.charCodeAt(2)!==255)
  throw Error('Prosjektfilen inneholder et bilde som ikke er JPEG.');
 const bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 inspectArchivedJpeg(bytes);
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
 (brief.preset===undefined||STRATISM_PRESET_IDS.includes(brief.preset))&&
 (brief.composition_mode===undefined||['five-states','three-anchors'].includes(brief.composition_mode))&&
 (brief.provenance===undefined||(brief.provenance&&
 ['concept','own-photo','client-photo'].includes(brief.provenance.source_kind)&&
 typeof brief.provenance.place==='string'&&brief.provenance.place.length<=140&&
 typeof brief.provenance.story==='string'&&brief.provenance.story.length<=1000&&
 typeof brief.provenance.photo_credit==='string'&&brief.provenance.photo_credit.length<=120&&
 typeof brief.provenance.reference_rights_confirmed==='boolean'))&&
 !!brief.style&&['cobalt turquoise and teal','muted olive green and warm ochre','restrained ultramarine and slate',
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
   const reviews=validateQuality(v.reviews&&Object.keys(v.reviews).length?v.reviews:null);
   if(reviews?.revision&&!v.revision)throw Error('Revisjonsvurdering uten revisjonsbilde.');
   if(v.showRevision&&!v.revision)throw Error('Valgt revisjon mangler revisjonsbilde.');
   variants.push({variation:v.variation,createdAt:v.createdAt,showRevision:!!v.showRevision,
    image_base64:await urlToBase64(v.url),reviews:reviews||null,revision:v.revision?{
      mode:v.revision.mode,createdAt:v.revision.createdAt,qa_failed:v.revision.qa_failed||[],
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
 invalidatePreflight();
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
    if(!['qa-guided','subtler-colour','preserve-details','more-linen','remove-texture'].includes(entry.revision.mode)||
      typeof entry.revision.createdAt!=='string'||entry.revision.createdAt.length>50)
      throw Error('Ugyldig revidert prosjektbilde.');
    const revUrl=base64ToJpegUrl(entry.revision.image_base64);temporaryUrls.push(revUrl);
    const qaFailed=entry.revision.qa_failed??[];
    if(!Array.isArray(qaFailed)||qaFailed.length>6||new Set(qaFailed).size!==qaFailed.length||
       qaFailed.some(key=>!QUALITY_FIELDS.includes(key)))throw Error('Ugyldig revisjonsvurdering.');
    if(entry.revision.mode==='qa-guided'&&qaFailed.length===0)throw Error('Manglende grunnlag for revisjon.');
    revision={url:revUrl,mode:entry.revision.mode,createdAt:entry.revision.createdAt,qa_failed:qaFailed};
   }
   const reviews=validateQuality(entry.reviews);
   if(reviews?.revision&&!revision)throw Error('Vurdering for manglende revisjon.');
   restored.push({url,variation:i+1,createdAt:entry.createdAt,revision,reviews:reviews||{},
    showRevision:!!revision&&entry.showRevision===true});
  }
  // Only commit restored data after every image and field has been validated.
  for(const old of state.variants){URL.revokeObjectURL(old.url);if(old.revision)URL.revokeObjectURL(old.revision.url)}
  state.variants=restored;state.selectedVariant=archive.selected_variant;
  state.brief={...archive.brief,preset:archive.brief.preset||'stratism-working-v09',
   composition_mode:archive.brief.composition_mode||'five-states',
   provenance:archive.brief.provenance||{source_kind:'concept',place:'',story:'',photo_credit:'',reference_rights_confirmed:false,verified:false},
   reference_metadata:null,
   production:{provider:'NOT_CONNECTED',generation_status:'BRIEF_ONLY',
    commercial_release:false,print_release:false,human_approval_required:true}};
  $('stratism-preset').value=state.brief.preset;
  $('stratism-composition-rule').value=state.brief.composition_mode;
  $('stratism-source-kind').value=state.brief.provenance.source_kind;
  $('stratism-place').value=state.brief.provenance.place||'';
  $('stratism-photo-credit').value=state.brief.provenance.photo_credit||'';
  $('stratism-story').value=state.brief.provenance.story||'';
  // Imported assertions never silently count as a fresh rights confirmation.
  $('stratism-reference-rights').checked=false;
  state.brief.provenance.reference_rights_confirmed=false;
  updatePresetDescription();
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

async function stratismArchiveRequest(action,body){
 const getToken=window.ART_ADMIN_GET_ACCESS_TOKEN;
 if(typeof getToken!=='function')throw Error('Administratorinnloggingen er ikke tilgjengelig.');
 const send=async forceRefresh=>fetch('/api/stratism-projects',{
  method:action==='list'?'GET':'POST',
  headers:{'Authorization':'Bearer '+await getToken({forceRefresh}),
   ...(action==='list'?{}:{'Content-Type':'application/json'})},
  ...(action==='list'?{}:{body:JSON.stringify(body)})
 });
 let response=await send(false);
 if(response.status===401)response=await send(true);
 const data=await response.json();
 if(!response.ok)throw Error(String(data.error||'Skyarkivet er utilgjengelig').slice(0,200));
 return data;
}
async function listStratismCloud(){
 const result=await stratismArchiveRequest('list');
 const select=$('stratism-cloud-select');
 select.replaceChildren();
 const rows=Array.isArray(result.projects)?result.projects:[];
 const placeholder=document.createElement('option');placeholder.value='';
 placeholder.textContent=rows.length?'Velg et privat prosjekt':'Ingen lagrede prosjekter';
 select.appendChild(placeholder);
 for(const project of rows){
  const option=document.createElement('option');option.value=project.name;
  option.textContent=project.name.replace(/^\d{13}-/,'').replace(/-[0-9a-f-]{36}\.json$/,'').replace(/-/g,' ')
   +' · '+(project.created_at?new Date(project.created_at).toLocaleString('no-NO'):'');
  select.appendChild(option);
 }
 refreshVariantUI();
 return rows.length;
}
$('stratism-cloud-select').addEventListener('change',refreshVariantUI);
$('stratism-cloud-refresh').addEventListener('click',async()=>{
 if(state.busy)return;
 state.busy=true;refreshVariantUI();
 try{const count=await listStratismCloud();
  $('stratism-brief-status').textContent=count+' private prosjekter tilgjengelig.';
 }catch(e){$('stratism-brief-status').textContent=e.message}
 finally{state.busy=false;refreshVariantUI()}
});
$('stratism-cloud-save').addEventListener('click',async()=>{
 if(state.busy||!state.brief)return;
 state.busy=true;refreshVariantUI();
 $('stratism-brief-status').textContent='Lagrer en ny privat prosjektversjon i skyarkivet…';
 try{
  const json=await serializePrivateProject();
  const blob=new Blob([json],{type:'application/json'});
  if(blob.size>MAX_ARCHIVE_BYTES)throw Error('Prosjektfilen er for stor for skyarkivet.');
  const prepared=await stratismArchiveRequest('prepare',{action:'prepare',title:state.brief.title,bytes:blob.size});
  if(prepared.private!==true||!prepared.upload_url)throw Error('Skyarkivet kunne ikke sikre opplastingen.');
  const upload=await fetch(prepared.upload_url,{
   method:'PUT',headers:{'Content-Type':'application/json'},body:blob
  });
  if(!upload.ok)throw Error('Supabase avviste prosjektopplastingen ('+upload.status+').');
  $('stratism-brief-status').textContent='Privat prosjektversjon er lagret i skyarkivet. Ingen publisering eller salgsaktivering.';
  await listStratismCloud();
 }catch(e){$('stratism-brief-status').textContent='Skylagring mislyktes: '+e.message}
 finally{state.busy=false;refreshVariantUI()}
});
$('stratism-cloud-open').addEventListener('click',async()=>{
 if(state.busy)return;
 const name=$('stratism-cloud-select').value;if(!name)return;
 state.busy=true;refreshVariantUI();
 try{
  const signed=await stratismArchiveRequest('open',{action:'open',name});
  if(signed.private!==true||!signed.download_url)throw Error('Ugyldig tilgang til prosjektfil.');
  const response=await fetch(signed.download_url,{cache:'no-store'});
  if(!response.ok)throw Error('Kunne ikke hente den private prosjektfilen.');
  const contentLength=Number(response.headers.get('content-length')||0);
  if(contentLength>MAX_ARCHIVE_BYTES)throw Error('Prosjektfilen er for stor.');
  const file=await response.blob();
  if(file.size<20||file.size>MAX_ARCHIVE_BYTES)throw Error('Prosjektfilen har ugyldig størrelse.');
  restorePrivateProject(JSON.parse(await file.text()));
  $('stratism-brief-status').textContent='Prosjektet er åpnet fra privat Supabase-lagring. Ingen publisering.';
 }catch(e){$('stratism-brief-status').textContent='Kunne ikke åpne skyprosjekt: '+e.message}
 finally{state.busy=false;refreshVariantUI()}
});

$('stratism-reset-variants').addEventListener('click',()=>{
 if(state.busy)return;
 clearVariants();
 $('stratism-brief-status').textContent='Lokale bildeforslag er tømt. Ingen endringer i galleriet.';
});

})();