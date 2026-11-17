'use strict';
const {createClient}=require('@supabase/supabase-js');
const ALLOWED_MODELS=new Set(['gpt-image-2','gpt-image-2.5-sunburst','gpt-image-2.5-flare']);
const CHORDS=new Set(['cobalt turquoise and teal','muted olive green and warm ochre','restrained ultramarine and slate','soft amber and oxblood','muted violet and mauve','neutral earth and linen']);
const EMPHASES=new Set(['selected roots and trunk contours','the eyes and a few facial contours','the principal architectural lines',"the main subject's distinctive features"]);
const STRENGTHS=new Set(['subtle','very subtle','moderate but subordinate to subject']);
const PRESET_IDS=new Set(['stratum-no4-v1','olivos-de-biar-v1','stratism-working-v09']);
const DEFAULT_PRESET='stratum-no4-v1';
const PRESET_RULES=Object.freeze({
 'stratum-no4-v1':"Create a gallery-grade, hand-painted oil and tempera-like artwork adhering to the finalized Stratism Stratum No. 4 method. One continuous and recognizable subject evolves vertically through FIVE DISTINCT PAINT HANDLING STATES. STATE 1/PRESENCE: top subject rendered finely, crisply, matte and controlled like precise tempera, not chunky strokes. STATE 2/FEELING: exactly ONE saturated colour chord in broad FLAT OPAQUE wet-into-wet painted shapes with VISIBLE BRUSH EDGES and bristle streaks, never turquoise haze, soft glow, gradient, airbrush or filter; the colour shape integrates the subject. STATE 3/MEMORY: a NARROW transition of THIN WATERY transparent grey-and-mauve washes, the subject half dissolved, with a few LONG THIN DRIPS flowing downward. STATE 4/ERASURE: localized DRAG MARKS WITH A FLAT BLADE, scraped-back paint with LONG asymmetric horizontal smears in restrained oxblood and grey-green, not reptile scales, impasto emboss or computer texture. STATE 5/ABSENCE: generous untouched natural fine-woven beige linen with very sparse fine graphite traces of meaningful subject details. The same motif is structurally identifiable in all five states, no unrelated objects or landscape motifs; background is quiet bare linen and softly painted PALE MUTED GREY-BLUE where needed. NO DISTANT TREES, NO HILLS, NO ORANGE SOIL, NO SECOND SATURATED COLOUR. Distinct asymmetric dry, torn, wash and drip boundary characters, not perfectly straight parallel stripes. Vertical 4:5, all of the subject within the frame, generous breathing room.",
 'olivos-de-biar-v1':"Create a highly refined, quiet olive-tree-style fine-art painting preserving the ORIGINAL OLIVOS DE BIAR aesthetic, rather than the five-band Stratism formula. Closely observe the recognizable main subject and its silhouette. The subject is painted delicately and naturally with realistic fine brush and tempera-like detail, atmospheric softened distances and restrained natural earth colours. The image gradually fades organically downwards into quiet raw warm linen with elegant graphite sketches of the surviving roots or defining contours. Thin transparent softness is desirable here; do NOT add a saturated turquoise horizontal band or palette-knife red scraped stripe. This is the original softer, naturalistic olive painting series, distinct from formal Stratism. No scale-like emboss, digital filter or fake peeling collage. Portrait 4:5, full subject inside frame, softly natural atmosphere.",
 'stratism-working-v09':null
});
const COMPOSITION_MODES=new Set(['five-states','three-anchors']);
const SOURCE_KINDS=new Set(['concept','own-photo','client-photo']);
const THREE_ANCHORS_RULE="Use only THREE mandatory instantly recognizable painterly anchors: (1) exactly ONE saturated colour chord painted as BROAD FLAT OPAQUE shapes with visible wet-into-wet brush edges, no glow; (2) transparent grey-mauve wash with LONG THIN DRIPS visibly flowing into the bare linen below; (3) an unfinished graphite sketch of the same subject on exposed raw-looking beige linen with a small discreet graphite signature. The other material states from Stratism may be present but should NOT be forced into rigid equally spaced bands. Maintain one coherent subject, portrait 4:5, all inside frame, quiet pale muted grey-blue background, no orange soil or secondary saturated colours, no embossed or repetitive digital texture. This is a DIGITAL depiction of paint, linen and graphite; do not imply physical hand-finishing.";
const MAX_REFERENCE_BYTES=1_350_000;
const CONCEPT_WIDTH=1280,CONCEPT_HEIGHT=1600;
const CONCEPT_SIZE=`${CONCEPT_WIDTH}x${CONCEPT_HEIGHT}`;
function jpegDimensions(bytes){
 // Read JPEG SOF dimensions without decoding the file; no metadata is trusted as a print certificate.
 for(let p=2;p+9<bytes.length;){
  if(bytes[p]!==0xff){p++;continue}
  while(p<bytes.length&&bytes[p]===0xff)p++;
  const marker=bytes[p++];if(marker===0xd9||marker===0xda)break;
  if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(p+2>bytes.length)break;
  const length=bytes.readUInt16BE(p);
  if(length<2||p+length>bytes.length)break;
  if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||
     (marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
   if(length<7)break;
   return {width:bytes.readUInt16BE(p+5),height:bytes.readUInt16BE(p+3)};
  }
  p+=length;
 }
 return null;
}
const REFINEMENTS=Object.freeze({
 'subtler-colour':'Revise the attached existing Stratism painting with notably subtler chroma; preserve subject identity, geometry, all surviving details and composition. Do not introduce a strong colour stripe.',
 'preserve-details':'Revise the attached existing Stratism painting to preserve more of the existing meaningful contours and identity, particularly the chosen focal details; maintain all five material states.',
 'more-linen':'Revise the attached existing Stratism painting with slightly more visible raw linen and a few subtle graphite traces in the absence area. Preserve the motif and existing composition.',
 'remove-texture':'Revise the attached existing Stratism painting to remove repeated scales, embossed uniform texture and paper-flake effects. Replace with physically credible smooth pigment, translucent wash, local abrasion and bare linen. Keep composition unchanged.'
});
const QUALITY_FIXES=Object.freeze({
 subject:'Keep recognizable identity, silhouette, dimensions and distinct photographic features of the same subject. Do not substitute another subject.',
 colour:'Use exactly one strong saturated colour chord; mute every other hue and remove competing saturated background or orange soil.',
 brush:'Replace soft airbrush glows, filters or gradients with broad flat opaque paint with visible physical bristle edges.',
 transitions:'Clarify thin transparent grey-mauve watercolor-like wash with selected long vertical drips; preserve natural nonidentical transitions.',
 linen:'Preserve a believable bare linen area, fine graphite remnants of the same subject and a discreet natural cursive signature.',
 texture:'Remove reptile-scale emboss, uniform dot/grain filters and artificial relief. Use only localized credible palette-knife drag marks.'
});
function qualityRevision(body){
 const failures=body?.qa_failed;
 if(!Array.isArray(failures)||failures.length<1||failures.length>6||new Set(failures).size!==failures.length)
  throw new Error('INVALID_QUALITY_REVIEW');
 if(failures.some(key=>typeof key!=='string'||!Object.hasOwn(QUALITY_FIXES,key)))
  throw new Error('INVALID_QUALITY_REVIEW');
 return 'Correct ONLY these creator-identified weaknesses, keeping all other successful elements unchanged: '+
  failures.map(key=>QUALITY_FIXES[key]).join(' ')+' Do not repaint the entire artwork or add new subjects.';
}
const VARIATION_DIRECTIVES=Object.freeze({
 1:'First interpretation: prioritize faithful subject identity, calm brushwork, restrained chroma and a strong center of presence.',
 2:'Second interpretation: maintain the subject and five states, but use more irregular, selective memory transitions and preserve a few additional evocative contours.',
 3:'Third interpretation: maintain the subject and five states, but use more unpainted linen, restrained graphite and carefully localized material abrasion, without losing crucial subject features.'
});
function readReference(base64){
 if(base64==null)return null;
 if(typeof base64!=='string'||base64.length<100||base64.length>1_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
  throw new Error('INVALID_REFERENCE');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.length<80||bytes.length>MAX_REFERENCE_BYTES||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)
  throw new Error('INVALID_REFERENCE');
 return bytes;
}

function text(value,max=1500){return typeof value==='string'?value.trim().slice(0,max):''}
function choice(value,allowed,fallback){return allowed.has(value)?value:fallback}
function sourceContext(body){
 const sourceKind=body?.source_kind??'concept';
 const composition=body?.composition_mode??'five-states';
 if(!SOURCE_KINDS.has(sourceKind)||!COMPOSITION_MODES.has(composition))throw new Error('INVALID_SOURCE_OR_COMPOSITION');
 const place=text(body?.place,140),story=text(body?.story,1000),photoCredit=text(body?.photo_credit,120);
 if(sourceKind==='client-photo'&&body?.reference_rights!==true)throw new Error('CLIENT_CONSENT_REQUIRED');
 return {sourceKind,composition,place,story,photoCredit};
}
function sourceSupplement(context){
 let extra='';
 if(context.place)extra+=' Location supplied by creator: '+context.place+'.';
 if(context.story)extra+=' Creator-supplied personal story to inform subject detail: '+context.story+'.';
 if(context.photoCredit)extra+=' Creator-reported photograph credit: '+context.photoCredit+'.';
 if(context.sourceKind==='own-photo'||context.sourceKind==='client-photo')
  extra+=' Use the attached authorized photograph as the factual source of the distinct subject structure. Do not invent extra people, buildings or trees.';
 return extra;
}
function promptFrom(body){
 const description=text(body?.description,1500);
 const preset=body?.preset??'stratism-working-v09';
 const context=sourceContext(body);
 if(!PRESET_IDS.has(preset))throw new Error('INVALID_PRESET');
 if(description.length<12)throw new Error('DESCRIPTION_REQUIRED');
 const chord=choice(body?.chord,CHORDS,preset==='stratum-no4-v1'?'cobalt turquoise and teal':'muted olive green and warm ochre');
 const emphasis=choice(body?.emphasis,EMPHASES,"the main subject's distinctive features");
 const strength=choice(body?.strength,STRENGTHS,'subtle');
 const legacy=`Create an original fine-art painting in the developing Stratism art system by Freddy Bremseth. The artistic subject is: ${description}. A single coherent subject passes through five fixed states of time in descending order: precise matte presence, restrained emotional colour, translucent memory wash, localized physically believable abrasion, and near-absence on truly bare unprimed linen. The motif remains recognizable and continuous across all five states, but the techniques differ in material character and selected defining details survive low into the otherwise unfinished composition. Choose the following colour chord: ${chord}. Strength: ${strength}; the colour never becomes a broad, dominant horizontal stripe. Preserve ${emphasis}. Transition boundaries should be asymmetric and organic rather than straight bands. The exact material character must vary by state: very smooth matte fine detail, soft colour wash, thin translucent stain, a small area of rubbed-back pigment, then unpainted woven linen and a few delicate graphite traces. Avoid homogeneous embossed scale patterns, global grain filters, paper collage/peeling paper, decorative flourishes, frames and borders. Full-bleed vertical composition, 4:5 framing within portrait output. Add only a discreet cursive signature reading 'Freddy Bremseth' on the raw linen in the lower right. No other lettering. This is a review concept, not an approved printable or salable original.`;
 if(preset==='stratism-working-v09')return legacy+sourceSupplement(context);
 const rules=preset==='stratum-no4-v1'&&context.composition==='three-anchors'?THREE_ANCHORS_RULE:PRESET_RULES[preset];
 const singleChord=preset==='stratum-no4-v1'?chord:'restrained natural olive-green, beige and muted earth tones';
 return `${rules} Main subject: ${description}. Keep ${emphasis}. Colour chord: ${singleChord}. Chroma intensity ${strength}. Make any physically possible cloth/grain natural and localized, never applied uniformly as a digital dot pattern. Add only a discreet small cursive graphite-like Freddy Bremseth signature on the lower-right linen; NO OTHER TEXT. Private review concept, never commercially or print approved.${sourceSupplement(context)}`;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 if(process.env.STRATISM_GENERATION_ENABLED!=='true')return res.status(503).json({error:'Stratism private generation is disabled'});
 if(!process.env.OPENAI_API_KEY||!process.env.STRATISM_SUPABASE_URL||!process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY)
  return res.status(503).json({error:'Stratism generator is not configured'});
 const header=typeof req.headers.authorization==='string'?req.headers.authorization:'';
 const token=header.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Administrator sign-in required'});
 if(Number(req.headers['content-length']||0)>2_600_000)return res.status(413).json({error:'Request too large'});
 let prompt,reference,variation,revisionMode,preset,source;try{
 preset=req.body?.preset??'stratism-working-v09';
 source=sourceContext(req.body);
 if(!PRESET_IDS.has(preset))throw new Error('INVALID_PRESET');
 variation=req.body?.variation===undefined?1:req.body?.variation;
 if(!Number.isInteger(variation)||variation<1||variation>3)throw new Error('INVALID_VARIATION');
 revisionMode=req.body?.revision_mode;
 if(revisionMode!==undefined&&(
 (revisionMode!=='qa-guided'&&!Object.hasOwn(REFINEMENTS,revisionMode))||
 req.body?.reference_jpeg_base64!=null))throw new Error('INVALID_REFINEMENT');
 if(revisionMode!=='qa-guided'&&req.body?.qa_failed!==undefined)
  throw new Error('UNEXPECTED_QUALITY_REVIEW');
 reference=readReference(revisionMode===undefined?req.body?.reference_jpeg_base64:req.body?.revision_jpeg_base64);
 if(revisionMode!==undefined&&!reference)throw new Error('MISSING_REVISION_IMAGE');
 if(revisionMode===undefined&&source.sourceKind!=='concept'&&!reference)throw new Error('PHOTO_REQUIRED');
 if(revisionMode===undefined&&reference&&req.body?.reference_rights!==true)throw new Error('PHOTO_RIGHTS_REQUIRED');
 prompt=promptFrom(req.body)+' '+(preset==='stratum-no4-v1'?
  VARIATION_DIRECTIVES[variation]:
  preset==='olivos-de-biar-v1'?
  'Preserve the original soft naturalistic olive painting language; the three variants change composition nuance, not into a saturated five-band style.':
  VARIATION_DIRECTIVES[variation]);
 if(revisionMode!==undefined)prompt+=' IMPORTANT: This is an EDIT of the supplied Stratism painting, not a new generation. '+
   (revisionMode==='qa-guided'?qualityRevision(req.body):REFINEMENTS[revisionMode]);
 }catch{return res.status(400).json({error:'Invalid Stratism description, variant or reference photo'})}
 const admin=createClient(process.env.STRATISM_SUPABASE_URL,process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:'Bearer '+token}}
 });
 try{
  const {data:user,error:authError}=await admin.auth.getUser(token);
  if(authError||!user?.user?.id)return res.status(401).json({error:'Invalid or expired session'});
  const {data:member,error:memberError}=await admin.from('art_gallery_admin_users').select('user_id').eq('user_id',user.user.id).maybeSingle();
  if(memberError||!member)return res.status(403).json({error:'Administrator approval required'});
  const model=ALLOWED_MODELS.has(process.env.STRATISM_IMAGE_MODEL)?process.env.STRATISM_IMAGE_MODEL:'gpt-image-2';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),100000);
  let response;
  try{
    if(reference){
      const payload=new FormData();
      payload.append('model',model);
      payload.append('image',new Blob([reference],{type:'image/jpeg'}),'reference.jpg');
      payload.append('prompt',prompt+' Faithfully preserve the attached image identity, silhouette and scene structure. If this is a revision, do not replace the artwork or rearrange the subject.');
      payload.append('size',CONCEPT_SIZE);
      payload.append('quality','high');
      payload.append('output_format','jpeg');
      payload.append('n','1');
      response=await fetch('https://api.openai.com/v1/images/edits',{
        method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},
        body:payload,signal:controller.signal
      });
    }else{
      response=await fetch('https://api.openai.com/v1/images/generations',{
        method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({model,prompt,size:CONCEPT_SIZE,quality:'high',output_format:'jpeg',n:1}),
        signal:controller.signal
      });
    }
  }finally{clearTimeout(timer)}
  if(!response.ok){
   const providerCode=response.status===429?'PROVIDER_RATE_LIMIT':
    response.status===401?'PROVIDER_AUTH':
    response.status===403?'PROVIDER_ACCESS':
    response.status===400?'PROVIDER_INVALID_REQUEST':
    response.status===503||response.status===502?'PROVIDER_UNAVAILABLE':'PROVIDER_ERROR';
   console.error('Stratism image provider status',response.status,providerCode);
   return res.status(502).json({error:'Image provider declined the request',code:providerCode});
  }
  const result=await response.json(),b64=result?.data?.[0]?.b64_json;
  if(typeof b64!=='string'||b64.length<100||b64.length>9_000_000)return res.status(502).json({error:'Generated preview missing or too large'});
  const bytes=Buffer.from(b64,'base64');
  if(bytes.length<80||bytes.length>6_750_000||bytes[0]!==0xff||bytes[1]!==0xd8||bytes[2]!==0xff)
   return res.status(502).json({error:'Image provider returned an invalid JPEG'});
  const dimensions=jpegDimensions(bytes);
  if(!dimensions||dimensions.width!==CONCEPT_WIDTH||dimensions.height!==CONCEPT_HEIGHT)
   return res.status(502).json({error:'Image provider returned an unexpected aspect ratio'});
  return res.status(200).json({image_base64:b64,mime_type:'image/jpeg',width:CONCEPT_WIDTH,height:CONCEPT_HEIGHT,aspect_ratio:'4:5',model,not_sale_approved:true,not_print_approved:true,stored:false,published:false,reference_used:!!reference,variation,preset,composition_mode:source.composition,source_kind:source.sourceKind,refinement_applied:revisionMode||null});
 }catch(error){console.error('Stratism generation failed',error?.name||'unknown');return res.status(502).json({error:'Private preview generation unavailable'})}
};
module.exports.promptFrom=promptFrom;
module.exports.PRESET_IDS=PRESET_IDS;
