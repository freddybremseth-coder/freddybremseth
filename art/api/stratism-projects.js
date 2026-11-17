'use strict';
const {createClient}=require('@supabase/supabase-js');
const {randomUUID}=require('node:crypto');
const BUCKET='stratism-private',MAX_BYTES=48*1024*1024;
function reply(res,code,data){return res.status(code).json(data)}
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return reply(res,405,{error:'Method not allowed'})}
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return reply(res,503,{error:'Private archive unavailable'});
 const auth=String(req.headers.authorization||'');
 const token=/^Bearer ([A-Za-z0-9._-]+)$/.exec(auth)?.[1];
 if(!token)return reply(res,401,{error:'Administrator sign-in required'});
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false}
 });
 try{
  const {data:{user}={},error}=await client.auth.getUser(token);
  if(error||!user?.id)return reply(res,401,{error:'Expired or invalid session'});
  const {data:admin,error:adminError}=await client.from('art_gallery_admin_users')
    .select('user_id').eq('user_id',user.id).maybeSingle();
  if(adminError||!admin)return reply(res,403,{error:'Administrator approval required'});
  const prefix='projects/'+user.id+'/';
  const storage=client.storage.from(BUCKET);
  if(req.method==='GET'){
   const {data,error:listError}=await storage.list(prefix,{limit:100,offset:0,sortBy:{column:'created_at',order:'desc'}});
   if(listError)return reply(res,502,{error:'Could not list private projects'});
   const projects=(data||[]).filter(file=>/^\d{13}-[a-z0-9-]{1,55}-[0-9a-f-]{36}\.json$/.test(file.name))
    .map(file=>({name:file.name,created_at:file.created_at||null,bytes:file.metadata?.size||null}));
   return reply(res,200,{projects,private:true});
  }
  if(Number(req.headers['content-length']||0)>4096)return reply(res,413,{error:'Request too large'});
  const body=req.body||{};
  if(body.action==='prepare'){
   const title=typeof body.title==='string'?body.title:'';
   const slug=title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'untitled';
   const bytes=body.bytes;
   if(title.length>100||!Number.isInteger(bytes)||bytes<100||bytes>MAX_BYTES)return reply(res,400,{error:'Invalid project size or title'});
   const projectId=randomUUID();
   const path=prefix+Date.now()+'-'+slug+'-'+projectId+'.json';
   const {data,error:signError}=await storage.createSignedUploadUrl(path,{upsert:false});
   if(signError||!data?.signedUrl)return reply(res,502,{error:'Could not prepare private upload'});
   return reply(res,200,{upload_url:data.signedUrl,private:true,max_bytes:MAX_BYTES});
  }
  if(body.action==='open'){
   const name=body.name;
   if(typeof name!=='string'||!/^\d{13}-[a-z0-9-]{1,55}-[0-9a-f-]{36}\.json$/.test(name))
    return reply(res,400,{error:'Invalid project name'});
   const {data,error:signError}=await storage.createSignedUrl(prefix+name,60);
   if(signError||!data?.signedUrl)return reply(res,404,{error:'Private project not available'});
   return reply(res,200,{download_url:data.signedUrl,private:true,expires_in:60});
  }
  return reply(res,400,{error:'Unknown archive action'});
 }catch(error){console.error('Stratism archive',error?.name||'Error');return reply(res,502,{error:'Private archive request failed'})}
}
module.exports=handler;
