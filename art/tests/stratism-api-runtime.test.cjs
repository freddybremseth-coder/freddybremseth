'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../api/stratism-generate.js'),'utf8');
const validBody={description:'An ancient olive tree on unprimed linen, preserving its roots',variation:1};
function harness({enabled=false,userId=null,member=null,providerStatus=200,reference=null}={}){
 let calls=0,dbCalls=0;
 const env={STRATISM_GENERATION_ENABLED:enabled?'true':'false',
   OPENAI_API_KEY:'dummy-only',SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'fake'};
 const client={
  auth:{getUser:async()=>({data:{user:userId?{id:userId}:null},error:null})},
  from:(table)=>{dbCalls++;assert.equal(table,'art_gallery_admin_users');return{
   select:()=>({eq:()=>({maybeSingle:async()=>({data:member?{user_id:userId}:null,error:null})})})
  }}
 };
 const module={exports:{}};
 const sandbox={module,exports:module.exports,process:{env,},console:{error:()=>{}},
  Buffer,Blob,FormData,AbortController,setTimeout,clearTimeout,
  require:(id)=>{assert.equal(id,'@supabase/supabase-js');return{createClient:()=>client}},
  fetch:async(url,opts)=>{calls++;assert.match(url,/api\.openai\.com/);
   return {ok:providerStatus===200,status:providerStatus,json:async()=>({data:[{b64_json:'X'.repeat(130)}]})};
  }
 };
 vm.runInNewContext(code,sandbox,{filename:'stratism-generate.js'});
 const handler=module.exports;
 function request({body=validBody,token=null,method='POST'}={}){
  const req={method,headers:{...(token?{authorization:'Bearer '+token}:{})},body};
  const res={code:200,payload:null,setHeader:()=>{},status(n){this.code=n;return this},
   json(payload){this.payload=payload;return this},};
  return Promise.resolve(handler(req,res)).then(()=>res);
 }
 return {request,stats:()=>({calls,dbCalls})};
}
test('feature flag rejects generation before authentication and provider calls',async()=>{
 const h=harness();const r=await h.request({token:'valid'});
 assert.equal(r.code,503);assert.equal(h.stats().calls,0);assert.equal(h.stats().dbCalls,0);
});
test('no bearer token cannot trigger billable image generation',async()=>{
 const h=harness({enabled:true});const r=await h.request();
 assert.equal(r.code,401);assert.equal(h.stats().calls,0);
});
test('unapproved account cannot trigger billable image generation',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:false});
 const r=await h.request({token:'valid'});assert.equal(r.code,403);assert.equal(h.stats().calls,0);
});
test('invalid variant does not trigger billable image generation',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,variation:10}});
 assert.equal(r.code,400);assert.equal(h.stats().calls,0);
});
test('approved admin generates only private review result, never sale or print approval',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid'});
 assert.equal(r.code,200);assert.equal(r.payload.not_sale_approved,true);
 assert.equal(r.payload.not_print_approved,true);assert.equal(r.payload.stored,false);
 assert.equal(r.payload.published,false);assert.equal(h.stats().calls,1);
});
