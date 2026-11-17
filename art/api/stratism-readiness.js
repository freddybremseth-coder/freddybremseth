'use strict';
const {createClient}=require('@supabase/supabase-js');
const ALLOWED_MODELS=new Set(['gpt-image-2','gpt-image-2.5-sunburst','gpt-image-2.5-flare']);
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(String(req.headers.authorization||''))?.[1];
 if(!token)return res.status(401).json({error:'Administrator sign-in required'});
 if(!process.env.STRATISM_SUPABASE_URL||!process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY)
  return res.status(503).json({error:'Administrator identity provider unavailable'});
 try{
  const client=createClient(process.env.STRATISM_SUPABASE_URL,process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}
  });
  const {data:{user}={},error}=await client.auth.getUser(token);
  if(error||!user?.id)return res.status(401).json({error:'Invalid or expired session'});
  const {data:admin,error:adminError}=await client.from('art_gallery_admin_users')
   .select('user_id').eq('user_id',user.id).maybeSingle();
  if(adminError||!admin)return res.status(403).json({error:'Administrator approval required'});
  const enabled=process.env.STRATISM_GENERATION_ENABLED==='true';
  const configured=!!(process.env.OPENAI_API_KEY&&process.env.STRATISM_SUPABASE_URL&&process.env.STRATISM_SUPABASE_PUBLISHABLE_KEY);
  const model=ALLOWED_MODELS.has(process.env.STRATISM_IMAGE_MODEL)?process.env.STRATISM_IMAGE_MODEL:'gpt-image-2';
  return res.status(200).json({
   enabled,configured,can_generate:enabled&&configured,model,
   billing_note:'Every explicit image generation or revision makes one provider request. No provider request was made by this check.',
   preview_only:true,sale_approval:false,print_approval:false
  });
 }catch(e){
  console.error('Stratism readiness',e?.name||'Error');
  return res.status(502).json({error:'Could not verify administrator access'});
 }
};
