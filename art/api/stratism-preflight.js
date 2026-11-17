'use strict';
const {createClient}=require('@supabase/supabase-js');
const generator=require('./stratism-generate');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed'})}
 if(Number(req.headers['content-length']||0)>2_600_000)return res.status(413).json({error:'Request too large'});
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(String(req.headers.authorization||''))?.[1];
 if(!token)return res.status(401).json({error:'Administrator sign-in required'});
 if(!process.env.STRATISM_SUPABASE_URL||!process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY)
  return res.status(503).json({error:'Administrator login is not configured'});
 try{
  const client=createClient(process.env.STRATISM_SUPABASE_URL,process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}
  });
  const {data:{user}={},error}=await client.auth.getUser(token);
  if(error||!user?.id)return res.status(401).json({error:'Invalid or expired session'});
  const {data:member,error:memberError}=await client.from('art_gallery_admin_users')
   .select('user_id').eq('user_id',user.id).maybeSingle();
  if(memberError||!member)return res.status(403).json({error:'Administrator approval required'});
  let parsed;
  try{parsed=generator.validateGenerationRequest(req.body)}
  catch{return res.status(400).json({error:'Invalid art model, image, rights, description or revision request'})}
  return res.status(200).json({
   valid:true,preview_only:true,no_provider_call:true,cost_estimate:'No image charges for preflight',
   preset:parsed.preset,composition_mode:parsed.source.composition,
   source_kind:parsed.source.sourceKind,reference_used:!!parsed.reference,
   variation:parsed.variation,revision:parsed.revisionMode||null,
   output_format:'jpeg',size:generator.CONCEPT_SIZE,
   sale_approval:false,print_approval:false
  });
 }catch(e){
  console.error('Stratism preflight',e?.name||'Error');
  return res.status(502).json({error:'Could not verify preflight access'});
 }
};
