'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../api/stratism-preflight.js'),'utf8');
const generatorCode=fs.readFileSync(path.join(__dirname,'../api/stratism-generate.js'),'utf8');
const validBody={description:'An old olive tree from Biar painted in five temporal states',preset:'stratum-no4-v1',variation:1};
function harness({member=true,validUser=true}={}){
 let providerCalls=0;
 const client={auth:{getUser:async()=>({data:{user:validUser?{id:'user-1'}:null}})},
  from:(table)=>{assert.equal(table,'art_gallery_admin_users');
   return {select:()=>({eq:()=>({maybeSingle:async()=>({data:member?{user_id:'user-1'}:null})})})};
  }};
 const env={STRATISM_SUPABASE_URL:'https://test.invalid',STRATISM_SUPABASE_PUBLISHABLE_KEY:'publishable-test'};
 const module={exports:{}};
 const ctx={module,exports:module.exports,Buffer,Blob,FormData,AbortController,setTimeout,clearTimeout,
  process:{env},console:{error:()=>{}},
  fetch:async()=>{providerCalls++;throw Error('Unexpected provider call')},
  require:id=>{
   if(id==='@supabase/supabase-js')return{createClient:(url,key,opts)=>{
    assert.equal(key,'publishable-test');assert.match(opts.global.headers.Authorization,/^Bearer /);return client;
   }};
   if(id==='./stratism-generate'){
    const genModule={exports:{}};
    vm.runInNewContext(generatorCode,{module:genModule,exports:genModule.exports,Buffer,Blob,FormData,
     AbortController,setTimeout,clearTimeout,process:{env},console:{error:()=>{}},
     fetch:async()=>{providerCalls++;throw Error('Provider used')},
     require:()=>({createClient:()=>client})});
    return genModule.exports;
   }
   throw Error('Unexpected dependency');
  }};
 vm.runInNewContext(code,ctx);
 async function request({method='POST',body=validBody,token='valid'}={}){
  const response={code:200,payload:null,setHeader(){},status(n){this.code=n;return this},json(p){this.payload=p;return this}};
  await module.exports({method,body,headers:token?{authorization:'Bearer '+token}:{}},response);
  return response;
 }
 return {request,providerCalls:()=>providerCalls};
}
test('cost-free preflight validates current master without provider credentials or charges',async()=>{
 const h=harness();const r=await h.request();
 assert.equal(r.code,200);assert.equal(r.payload.valid,true);
 assert.equal(r.payload.no_provider_call,true);assert.equal(r.payload.size,'1280x1600');
 assert.equal(r.payload.reference_used,false);assert.equal(r.payload.sale_approval,false);
 assert.equal(h.providerCalls(),0);
 assert.doesNotMatch(code,/OPENAI_API_KEY|STRATISM_GENERATION_ENABLED|api\.openai\.com/);
});
test('invalid metadata is rejected by same generator validator, without provider calls',async()=>{
 const h=harness();
 for(const body of [{...validBody,preset:'unknown'},{...validBody,variation:0},
  {...validBody,source_kind:'own-photo'},{...validBody,source_kind:'client-photo'},
  {...validBody,composition_mode:'wrong'}]){
  const r=await h.request({body});assert.equal(r.code,400);
 }
 assert.equal(h.providerCalls(),0);
});
test('anonymous and unauthorized callers cannot preflight private content',async()=>{
 assert.equal((await harness().request({token:null})).code,401);
 assert.equal((await harness({validUser:false}).request()).code,401);
 assert.equal((await harness({member:false}).request()).code,403);
 assert.equal((await harness().request({method:'GET'})).code,405);
});

test('free preflight returns safe actionable validation codes and makes no paid calls',async()=>{
 const h=harness();
 const cases=[
  [{...validBody,description:'Short'},'DESCRIPTION_REQUIRED'],
  [{...validBody,preset:'invalid'},'INVALID_PRESET'],
  [{...validBody,variation:5},'INVALID_VARIATION'],
  [{...validBody,source_kind:'own-photo'},'PHOTO_REQUIRED'],
  [{...validBody,source_kind:'client-photo'},'CLIENT_CONSENT_REQUIRED'],
  [{...validBody,composition_mode:'bad'},'INVALID_SOURCE_OR_COMPOSITION']
 ];
 for(const [body,code] of cases){
  const r=await h.request({body});
  assert.equal(r.code,400);
  assert.equal(r.payload.code,code);
  assert.equal(r.payload.image_base64,undefined);
 }
 assert.equal(h.providerCalls(),0);
});
test('preflight and billable endpoint use the same allowlisted validation codes',()=>{
 assert.match(code,/generator\.validationErrorCode\(error\)/);
 assert.match(generatorCode,/module\.exports\.validationErrorCode=validationErrorCode/);
 assert.match(generatorCode,/code:validationErrorCode\(error\)/);
 assert.doesNotMatch(code,/OPENAI_API_KEY|STRATISM_GENERATION_ENABLED|api\.openai\.com/);
});
