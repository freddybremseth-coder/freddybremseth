'use strict';
const {createClient}=require('@supabase/supabase-js');
const ALLOWED_MODELS=new Set(['gpt-image-2','gpt-image-2.5-sunburst','gpt-image-2.5-flare']);
const CHORDS=new Set(['muted olive green and warm ochre','restrained ultramarine and slate','soft amber and oxblood','muted violet and mauve','neutral earth and linen']);
const EMPHASES=new Set(['selected roots and trunk contours','the eyes and a few facial contours','the principal architectural lines',"the main subject's distinctive features"]);
const STRENGTHS=new Set(['subtle','very subtle','moderate but subordinate to subject']);
const MAX_REFERENCE_BYTES=1_350_000;
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
function promptFrom(body){
 const description=text(body?.description,1500);
 if(description.length<12)throw new Error('DESCRIPTION_REQUIRED');
 const chord=choice(body?.chord,CHORDS,'muted olive green and warm ochre');
 const emphasis=choice(body?.emphasis,EMPHASES,"the main subject's distinctive features");
 const strength=choice(body?.strength,STRENGTHS,'subtle');
 return `Create an original fine-art painting in the developing Stratism art system by Freddy Bremseth. The artistic subject is: ${description}. A single coherent subject passes through five fixed states of time in descending order: precise matte presence, restrained emotional colour, translucent memory wash, localized physically believable abrasion, and near-absence on truly bare unprimed linen. The motif remains recognizable and continuous across all five states, but the techniques differ in material character and selected defining details survive low into the otherwise unfinished composition. Choose the following colour chord: ${chord}. Strength: ${strength}; the colour never becomes a broad, dominant horizontal stripe. Preserve ${emphasis}. Transition boundaries should be asymmetric and organic rather than straight bands. The exact material character must vary by state: very smooth matte fine detail, soft colour wash, thin translucent stain, a small area of rubbed-back pigment, then unpainted woven linen and a few delicate graphite traces. Avoid homogeneous embossed scale patterns, global grain filters, paper collage/peeling paper, decorative flourishes, frames and borders. Full-bleed vertical composition, 4:5 framing within portrait output. Add only a discreet cursive signature reading 'Freddy Bremseth' on the raw linen in the lower right. No other lettering. This is a review concept, not an approved printable or salable original.`;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 if(process.env.STRATISM_GENERATION_ENABLED!=='true')return res.status(503).json({error:'Stratism private generation is disabled'});
 if(!process.env.OPENAI_API_KEY||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  return res.status(503).json({error:'Stratism generator is not configured'});
 const header=typeof req.headers.authorization==='string'?req.headers.authorization:'';
 const token=header.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Administrator sign-in required'});
 if(Number(req.headers['content-length']||0)>2_600_000)return res.status(413).json({error:'Request too large'});
 let prompt,reference,variation;try{
 variation=req.body?.variation===undefined?1:req.body?.variation;
 if(!Number.isInteger(variation)||variation<1||variation>3)throw new Error('INVALID_VARIATION');
 prompt=promptFrom(req.body)+' '+VARIATION_DIRECTIVES[variation];reference=readReference(req.body?.reference_jpeg_base64)}
 catch{return res.status(400).json({error:'Invalid Stratism description, variant or reference photo'})}
 const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
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
      payload.append('prompt',prompt+' Faithfully use the attached reference photograph as the source of subject identity, silhouette and scene structure. Do not replace the subject with a generic alternative.');
      payload.append('size','1024x1536');
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
        body:JSON.stringify({model,prompt,size:'1024x1536',quality:'high',output_format:'jpeg',n:1}),
        signal:controller.signal
      });
    }
  }finally{clearTimeout(timer)}
  if(!response.ok){console.error('Stratism image provider status',response.status);return res.status(502).json({error:'Image provider declined the request',code:'PROVIDER_'+response.status})}
  const result=await response.json(),b64=result?.data?.[0]?.b64_json;
  if(typeof b64!=='string'||b64.length<100||b64.length>9_000_000)return res.status(502).json({error:'Generated preview missing or too large'});
  return res.status(200).json({image_base64:b64,mime_type:'image/jpeg',model,not_sale_approved:true,not_print_approved:true,stored:false,published:false,reference_used:!!reference,variation});
 }catch(error){console.error('Stratism generation failed',error?.name||'unknown');return res.status(502).json({error:'Private preview generation unavailable'})}
};
module.exports.promptFrom=promptFrom;
