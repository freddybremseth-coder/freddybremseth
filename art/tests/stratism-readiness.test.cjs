'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=fs.readFileSync(path.join(__dirname,'../api/stratism-readiness.js'),'utf8');
const client=fs.readFileSync(path.join(__dirname,'../assets/js/stratism-studio.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../admin/index.html'),'utf8');
function harness({member=true,enabled=false,configured=false,validUser=true}={}){
 let accesses=0;
 const db={auth:{getUser:async()=>({data:{user:validUser?{id:'abc-user'}:null}})},
  from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:member?{user_id:'abc-user'}:null})})})})};
 const env={STRATISM_SUPABASE_URL:'https://example.invalid',STRATISM_SUPABASE_PUBLISHABLE_KEY:'publishable-test',
  ...(enabled?{STRATISM_GENERATION_ENABLED:'true'}:{}),
  ...(configured?{OPENAI_API_KEY:'test',SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock-secret'}:{})};
 const ctx={module:{exports:{}},process:{env},console:{error:()=>{}},require:(name)=>{
  assert.equal(name,'@supabase/supabase-js');return{createClient:(url,key,opts)=>{
   accesses++;assert.equal(key,'publishable-test');
   assert.match(opts.global.headers.Authorization,/^Bearer /);
   return db;
  }};
 }};
 vm.runInNewContext(api,ctx);
 async function request({token='valid',method='GET'}={}){
  const res={code:200,body:null,setHeader(){},status(x){this.code=x;return this},json(v){this.body=v;return this}};
  await ctx.module.exports({method,headers:token?{authorization:'Bearer '+token}:{}},res);
  return res;
 }
 return {request,getAccesses:()=>accesses};
}
test('readiness is free and never calls image provider',async()=>{
 const h=harness({member:true,enabled:true,configured:true}),r=await h.request();
 assert.equal(r.code,200);assert.equal(r.body.can_generate,true);
 assert.equal(r.body.sale_approval,false);assert.equal(r.body.print_approval,false);
 assert.equal(r.body.preview_only,true);
 assert.match(r.body.billing_note,/No provider request was made/);
 assert.doesNotMatch(api,/api\.openai\.com|fetch\(/);
});
test('readiness fails closed when provider disabled or unconfigured',async()=>{
 for(const flags of [{enabled:false,configured:true},{enabled:true,configured:false},{enabled:false,configured:false}]){
  const r=await harness({...flags,member:true}).request();
  assert.equal(r.code,200);assert.equal(r.body.can_generate,false);
 }
});
test('unauthenticated and non-admin users cannot inspect readiness',async()=>{
 assert.equal((await harness().request({token:null})).code,401);
 assert.equal((await harness({validUser:false}).request()).code,401);
 assert.equal((await harness({member:false}).request()).code,403);
});
test('browser blocks billable buttons before readiness and displays status in admin only',()=>{
 new vm.Script(client);
 assert.match(html,/id="stratism-check-provider"/);
 assert.match(html,/id="stratism-provider-readiness"/);
 assert.match(client,/providerReadiness\.canGenerate/);
 assert.match(client,/!providerReadiness\.canGenerate/);
 assert.match(client,/api\/stratism-readiness/);
 assert.match(client,/stratism-check-provider'\)\.addEventListener\('click',checkProviderReadiness\)/);
});
