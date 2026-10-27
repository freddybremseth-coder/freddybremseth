'use strict';
const {createClient}=require('@supabase/supabase-js');
const ALLOWED_MODELS=new Set(['gpt-image-2.5-sunburst','gpt-image-2.5-flare','gpt-image-2']);
const TARGETS=new Set(['16X20','24X36','30X40']);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 if(process.env.ART_AI_PRINT_ENABLED!=='true'||!process.env.OPENAI_API_KEY)
  return res.status(503).json({error:'AI preview is not configured. Enable ART_AI_PRINT_ENABLED and set OPENAI_API_KEY in the Art Vercel project.'});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return res.status(503).json({error:'Private image storage is unavailable'});
 const token=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
 if(!token)return res.status(401).json({error:'Administrator login required'});
 const id=String(req.body?.artwork_id||''),target=String(req.body?.target||'');
 if(!/^[a-z0-9-]{3,110}$/.test(id)||!TARGETS.has(target))return res.status(400).json({error:'Invalid artwork or format'});
 const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:user,error:userError}=await admin.auth.getUser(token);
  if(userError||!user?.user?.id)return res.status(401).json({error:'Session expired'});
  const {data:member,error:memberError}=await admin.from('art_gallery_admin_users').select('user_id').eq('user_id',user.user.id).maybeSingle();
  if(memberError||!member)return res.status(403).json({error:'Gallery administrator approval required'});
  const {data:work,error:workError}=await admin.from('art_gallery_works').select('id,title_en').eq('id',id).maybeSingle();
  if(workError||!work)return res.status(404).json({error:'Artwork not found'});
  const {data:assets,error:assetError}=await admin.from('art_gallery_assets').select('asset_role,bucket_name,object_path,mime_type,pixel_width,pixel_height').eq('artwork_id',id).eq('bucket_name','art-originals').in('asset_role',['print','master','digital']);
  if(assetError||!assets?.length)return res.status(404).json({error:'No private reference image available'});
  // Older gallery imports did not always populate mime_type, although the
  // private Storage object has a valid JPG/PNG filename and content type.
  const resolvedMime=asset=>{
   const mime=String(asset.mime_type||'').toLowerCase();
   if(mime==='image/jpeg'||mime==='image/png')return mime;
   if(mime)return null;
   const path=String(asset.object_path||'').toLowerCase();
   if(/\.jpe?g$/.test(path))return 'image/jpeg';
   if(/\.png$/.test(path))return 'image/png';
   return null;
  };
  const chosen=assets.map(a=>({...a,resolved_mime:resolvedMime(a)}))
   .filter(a=>a.object_path&&a.resolved_mime).sort((a,b)=>{
    const area=x=>Number(x.pixel_width||0)*Number(x.pixel_height||0);
    return area(b)-area(a);
   });
  let original;
  for(const asset of chosen){
   const {data,error}=await admin.storage.from('art-originals').download(asset.object_path);
   if(!error&&data){original={file:data,asset};break}
  }
  if(!original)return res.status(404).json({error:'Private reference image not found'});
  if(original.file.size>10*1024*1024)return res.status(413).json({error:'Reference exceeds 10 MB; use the manual enhancement workflow'});
  const [width,height]=target.split('X').map(Number);
  const model=ALLOWED_MODELS.has(process.env.ART_AI_PRINT_MODEL)?process.env.ART_AI_PRINT_MODEL:'gpt-image-2.5-sunburst';
  const payload=new FormData();
  payload.append('model',model);
  payload.append('image',original.file,id+(original.asset.resolved_mime==='image/png'?'.png':'.jpg'));
  payload.append('prompt','Faithfully restore and refine the attached original fine-art image for the artist Freddy Bremseth as a VISUAL REVIEW CONCEPT ONLY. Keep all compositional elements, brushwork, signature, texture, objects, geometry, hues, lighting and cropping exactly as supplied. Do not invent details, rearrange objects, alter symbolic marks, add a frame, text, watermark or background. Aim for crisp artwork detail without changing creative content. The intended final paper dimensions are approximately '+Math.round(width*2.54)+' by '+Math.round(height*2.54)+' centimetres. This image is NOT automatically approved as print-ready.');
  payload.append('size','auto');payload.append('quality','high');payload.append('output_format','jpeg');payload.append('n','1');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),110000);
  let response;
  try{response=await fetch('https://api.openai.com/v1/images/edits',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY},body:payload,signal:controller.signal})}
  finally{clearTimeout(timer)}
  if(!response.ok){console.error('Art AI preview provider status',response.status);return res.status(502).json({error:'AI preview provider declined this request',code:'PROVIDER_'+response.status})}
  const result=await response.json(),image=result?.data?.[0]?.b64_json;
  if(typeof image!=='string'||!image.length||image.length>5_500_000)return res.status(502).json({error:'AI preview was empty or too large for browser review'});
  return res.status(200).json({image_base64:image,mime_type:'image/jpeg',model,reference_role:original.asset.asset_role,not_print_approved:true});
 }catch(error){console.error('Art AI preview error',error?.name||'unknown');return res.status(502).json({error:'AI preview unavailable. Please use the manual print workflow.'})}
};
