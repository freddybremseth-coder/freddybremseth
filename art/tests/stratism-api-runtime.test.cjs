'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../api/stratism-generate.js'),'utf8');
const validBody={description:'An ancient olive tree on unprimed linen, preserving its roots',variation:1};
function harness({enabled=false,userId=null,member=null,providerStatus=200,reference=null}={}){
 let calls=0,dbCalls=0,lastEndpoint=null,lastOptions=null;
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
  fetch:async(url,opts)=>{calls++;lastEndpoint=url;lastOptions=opts;assert.match(url,/api\.openai\.com/);
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
 return {request,stats:()=>({calls,dbCalls,lastEndpoint,lastOptions})};
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

const jpeg=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(120,1)]).toString('base64');
test('reference photograph uses image edits, not text-only generation',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,reference_jpeg_base64:jpeg,reference_rights:true}});
 assert.equal(r.code,200);assert.equal(r.payload.reference_used,true);
 assert.match(h.stats().lastEndpoint,/\/images\/edits$/);
 assert.equal(h.stats().lastOptions.body.get('model'),'gpt-image-2');
 assert.equal(h.stats().calls,1);
});
test('revision sends selected artwork to edits and reports the revision action',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,revision_mode:'remove-texture',revision_jpeg_base64:jpeg}});
 assert.equal(r.code,200);assert.equal(r.payload.refinement_applied,'remove-texture');
 assert.match(h.stats().lastEndpoint,/\/images\/edits$/);
 assert.match(h.stats().lastOptions.body.get('prompt'),/This is an EDIT/);
 assert.equal(r.payload.not_sale_approved,true);assert.equal(r.payload.not_print_approved,true);
});
test('unsupported revision never reaches billable provider',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,revision_mode:'change-entire-artwork',revision_jpeg_base64:jpeg}});
 assert.equal(r.code,400);assert.equal(h.stats().calls,0);
});
test('missing revision input or combined reference inputs are rejected',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const missing=await h.request({token:'valid',body:{...validBody,revision_mode:'more-linen'}});
 const mixed=await h.request({token:'valid',body:{...validBody,revision_mode:'more-linen',reference_jpeg_base64:jpeg,reference_rights:true,revision_jpeg_base64:jpeg}});
 assert.equal(missing.code,400);assert.equal(mixed.code,400);assert.equal(h.stats().calls,0);
});
test('malformed reference and provider errors do not approve artworks',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const invalid=await h.request({token:'valid',body:{...validBody,reference_jpeg_base64:'fake jpeg'}});
 assert.equal(invalid.code,400);
 const unavailable=harness({enabled:true,userId:'user-1',member:true,providerStatus:429});
 const r=await unavailable.request({token:'valid'});
 assert.equal(r.code,502);assert.equal(r.payload.image_base64,undefined);
 assert.equal(unavailable.stats().calls,1);
});

test('three art models generate distinct server prompts without changing provider generation contract',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const cases=[
  ['stratum-no4-v1',/broad FLAT OPAQUE wet-into-wet/],
  ['olivos-de-biar-v1',/ORIGINAL OLIVOS DE BIAR aesthetic/],
  ['stratism-working-v09',/developing Stratism art system/]
 ];
 for(const [preset,expected] of cases){
  const response=await h.request({token:'valid',body:{...validBody,preset}});
  assert.equal(response.code,200);
  assert.equal(response.payload.preset,preset);
  assert.match(JSON.parse(h.stats().lastOptions.body).prompt,expected);
  assert.equal(response.payload.not_sale_approved,true);
  assert.equal(response.payload.not_print_approved,true);
 }
 assert.equal(h.stats().calls,3);
});
test('unknown preset cannot reach paid generation',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,preset:'unapproved-foreign-model'}});
 assert.equal(r.code,400);
 assert.equal(h.stats().calls,0);
});
test('Stratum No. 4 reference-photo edit carries flat opaque paint rule',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,preset:'stratum-no4-v1',reference_jpeg_base64:jpeg,reference_rights:true}});
 assert.equal(r.code,200);
 assert.equal(r.payload.reference_used,true);
 assert.match(h.stats().lastOptions.body.get('prompt'),/DRAG MARKS WITH A FLAT BLADE/);
 assert.match(h.stats().lastOptions.body.get('prompt'),/NO DISTANT TREES, NO HILLS, NO ORANGE SOIL/);
});

test('three-anchor composition is optional and keeps the five-state master untouched',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,preset:'stratum-no4-v1',composition_mode:'three-anchors'}});
 assert.equal(r.code,200);assert.equal(r.payload.composition_mode,'three-anchors');
 const prompt=JSON.parse(h.stats().lastOptions.body).prompt;
 assert.match(prompt,/THREE mandatory instantly recognizable painterly anchors/);
 assert.match(prompt,/LONG THIN DRIPS/);
 assert.match(prompt,/graphite sketch/);
 const original=await h.request({token:'valid',body:{...validBody,preset:'stratum-no4-v1'}});
 assert.equal(original.code,200);assert.equal(original.payload.composition_mode,'five-states');
 assert.match(JSON.parse(h.stats().lastOptions.body).prompt,/FIVE DISTINCT PAINT HANDLING STATES/);
});
test('unauthorized source images and unsupported provenance modes are rejected before provider calls',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 for(const body of [
  {...validBody,reference_jpeg_base64:jpeg},
  {...validBody,preset:'stratum-no4-v1',source_kind:'client-photo',reference_jpeg_base64:jpeg},
  {...validBody,preset:'stratum-no4-v1',source_kind:'own-photo'},
  {...validBody,preset:'stratum-no4-v1',source_kind:'fictional-place'},
  {...validBody,preset:'stratum-no4-v1',composition_mode:'rainbow'}
 ]){
  const r=await h.request({token:'valid',body});assert.equal(r.code,400);
 }
 assert.equal(h.stats().calls,0);
});
test('authorized personal client photo uses user-supplied place and story, not as verified facts',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,preset:'stratum-no4-v1',
  source_kind:'client-photo',reference_rights:true,reference_jpeg_base64:jpeg,
  place:'Benidorm',story:'A meaningful home to the customer'}});
 assert.equal(r.code,200);assert.equal(r.payload.source_kind,'client-photo');
 assert.equal(r.payload.reference_used,true);
 const prompt=h.stats().lastOptions.body.get('prompt');
 assert.match(prompt,/Location supplied by creator: Benidorm/);
 assert.match(prompt,/Creator-supplied personal story/);
});
