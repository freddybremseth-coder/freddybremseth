'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../api/stratism-generate.js'),'utf8');
const validBody={description:'An ancient olive tree on unprimed linen, preserving its roots',variation:1};
function fakeJpeg(width=1280,height=1600){
 const sof=Buffer.from([0xff,0xc0,0x00,0x11,0x08,
  (height>>8)&255,height&255,(width>>8)&255,width&255,
  0x03,0x01,0x11,0x00,0x02,0x11,0x00,0x03,0x11,0x00]);
 return Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0,0x00,0x02]),sof,Buffer.alloc(100,1),Buffer.from([0xff,0xd9])]).toString('base64');
}

function harness({enabled=false,userId=null,member=null,providerStatus=200,reference=null}={}){
 let calls=0,dbCalls=0,lastEndpoint=null,lastOptions=null;
 const env={STRATISM_GENERATION_ENABLED:enabled?'true':'false',
   OPENAI_API_KEY:'dummy-only',STRATISM_SUPABASE_URL:'https://example.invalid',STRATISM_SUPABASE_PUBLISHABLE_KEY:'public-test-only'};
 const client={
  auth:{getUser:async()=>({data:{user:userId?{id:userId}:null},error:null})},
  from:(table)=>{dbCalls++;assert.equal(table,'art_gallery_admin_users');return{
   select:()=>({eq:()=>({maybeSingle:async()=>({data:member?{user_id:userId}:null,error:null})})})
  }}
 };
 const module={exports:{}};
 const sandbox={module,exports:module.exports,process:{env,},console:{error:()=>{}},
  Buffer,Blob,FormData,AbortController,setTimeout,clearTimeout,
  require:(id)=>{assert.equal(id,'@supabase/supabase-js');return{createClient:(url,key,options)=>{assert.equal(key,'public-test-only');assert.match(options.global.headers.Authorization,/^Bearer /);return client}}},
  fetch:async(url,opts)=>{calls++;lastEndpoint=url;lastOptions=opts;assert.match(url,/api\.openai\.com/);
   return {ok:providerStatus===200,status:providerStatus,json:async()=>({data:[{b64_json:fakeJpeg()}]})};
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

const jpeg=fakeJpeg(1024,1280);
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

test('QA-guided edit repairs only approved failed criteria while retaining the original work',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,preset:'stratum-no4-v1',
  revision_mode:'qa-guided',revision_jpeg_base64:jpeg,qa_failed:['colour','transitions','texture']}});
 assert.equal(r.code,200);assert.equal(r.payload.refinement_applied,'qa-guided');
 assert.equal(r.payload.not_print_approved,true);assert.equal(r.payload.not_sale_approved,true);
 assert.match(h.stats().lastEndpoint,/\/images\/edits$/);
 const prompt=h.stats().lastOptions.body.get('prompt');
 assert.match(prompt,/Correct ONLY these creator-identified weaknesses/);
 assert.match(prompt,/exactly one strong saturated colour chord/);
 assert.match(prompt,/long vertical drips/);
 assert.match(prompt,/reptile-scale emboss/);
 assert.doesNotMatch(prompt,/remove the original subject completely/i);
});
test('QA-guided revisions require a known nonempty unique set of failed criteria',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 for(const qa_failed of [[],['unknown'],['texture','texture'],['colour','repaint-people'],Array(7).fill('subject')]){
  const r=await h.request({token:'valid',body:{...validBody,revision_mode:'qa-guided',
   revision_jpeg_base64:jpeg,qa_failed}});
  assert.equal(r.code,400);
 }
 assert.equal(h.stats().calls,0);
});
test('legacy refinement modes reject QA directives and remain available',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const denied=await h.request({token:'valid',body:{...validBody,
  revision_mode:'subtler-colour',revision_jpeg_base64:jpeg,qa_failed:['texture']}});
 assert.equal(denied.code,400);assert.equal(h.stats().calls,0);
 const allowed=await h.request({token:'valid',body:{...validBody,
  revision_mode:'subtler-colour',revision_jpeg_base64:jpeg}});
 assert.equal(allowed.code,200);assert.equal(allowed.payload.refinement_applied,'subtler-colour');
});

test('Stratism requests exact 4:5 image size and returns measured dimensions',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid'});
 assert.equal(r.code,200);assert.equal(r.payload.width,1280);assert.equal(r.payload.height,1600);
 assert.equal(r.payload.aspect_ratio,'4:5');
 assert.equal(JSON.parse(h.stats().lastOptions.body).size,'1280x1600');
 const edit=await h.request({token:'valid',body:{...validBody,reference_jpeg_base64:jpeg,reference_rights:true}});
 assert.equal(edit.code,200);
 assert.equal(h.stats().lastOptions.body.get('size'),'1280x1600');
});
test('invalid JPEG, wrong dimensions or absent SOF must not be accepted as a Stratism concept',async()=>{
 assert.match(code,/jpegDimensions\(bytes\)/);
 assert.match(code,/dimensions\.width!==CONCEPT_WIDTH\|\|dimensions\.height!==CONCEPT_HEIGHT/);
 assert.equal(fakeJpeg(1280,1600).length>100,true);
});

test('generation never requires or uses service-role credentials',()=>{
 assert.doesNotMatch(code,/process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
 assert.doesNotMatch(code,/process\.env\.SUPABASE_URL/);
 assert.match(code,/process\.env\.STRATISM_SUPABASE_PUBLISHABLE_KEY/);
 assert.match(code,/global:\{headers:\{Authorization:'Bearer '\+token\}\}/);
});

test('provider rate limit and access failures have safe categorical error codes',async()=>{
 for(const [providerStatus,code] of [[429,'PROVIDER_RATE_LIMIT'],[401,'PROVIDER_AUTH'],[403,'PROVIDER_ACCESS'],[400,'PROVIDER_INVALID_REQUEST'],[503,'PROVIDER_UNAVAILABLE']]){
  const h=harness({enabled:true,userId:'user-1',member:true,providerStatus});
  const r=await h.request({token:'valid'});
  assert.equal(r.code,502);
  assert.equal(r.payload.code,code);
  assert.equal(r.payload.image_base64,undefined);
  assert.equal(h.stats().calls,1);
 }
});

test('malformed JPEG reference cannot consume image credits even with admin access',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const fakeHeader=Buffer.concat([Buffer.from([0xff,0xd8,0xff]),Buffer.alloc(128,1)]).toString('base64');
 const tooSmall=fakeJpeg(10,20);
 const tooLarge=fakeJpeg(12001,12001);
 for(const reference_jpeg_base64 of [fakeHeader,tooSmall,tooLarge]){
  const r=await h.request({token:'valid',body:{...validBody,reference_jpeg_base64,reference_rights:true}});
  assert.equal(r.code,400);
 }
 assert.equal(h.stats().calls,0);
});

test('Olivos de Biar targeted revisions preserve naturalistic character rather than adding fixed five layers',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const body={...validBody,preset:'olivos-de-biar-v1',revision_jpeg_base64:jpeg};
 const r=await h.request({token:'valid',body:{...body,revision_mode:'qa-guided',qa_failed:['colour','brush','transitions','texture']}});
 assert.equal(r.code,200);
 const prompt=h.stats().lastOptions.body.get('prompt');
 assert.match(prompt,/natural olive-green/);
 assert.match(prompt,/softly and organically into linen/);
 assert.match(prompt,/no palette-knife gouges or oxblood scraping/i);
 assert.doesNotMatch(prompt,/five fixed layers of paint/i);
 const detail=await h.request({token:'valid',body:{...body,revision_mode:'preserve-details'}});
 assert.equal(detail.code,200);
 assert.match(h.stats().lastOptions.body.get('prompt'),/Never impose five fixed material states/);
});
test('three-anchor mode does not force five rigid bands during generation or revisions',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const shared={...validBody,preset:'stratum-no4-v1',composition_mode:'three-anchors'};
 const gen=await h.request({token:'valid',body:shared});
 assert.equal(gen.code,200);
 assert.match(JSON.parse(h.stats().lastOptions.body).prompt,/never impose five equally spaced bands/i);
 const edit=await h.request({token:'valid',body:{...shared,revision_mode:'qa-guided',
  revision_jpeg_base64:jpeg,qa_failed:['transitions','texture']}});
 assert.equal(edit.code,200);
 const prompt=h.stats().lastOptions.body.get('prompt');
 assert.match(prompt,/without imposing five equally sized horizontal stripes/i);
 assert.match(prompt,/without forcing a scraped fourth band/i);
});
test('original No.4 retains its distinct saturated opaque paint language',async()=>{
 const h=harness({enabled:true,userId:'user-1',member:true});
 const r=await h.request({token:'valid',body:{...validBody,preset:'stratum-no4-v1',revision_mode:'qa-guided',
  revision_jpeg_base64:jpeg,qa_failed:['colour','brush','texture']}});
 assert.equal(r.code,200);
 const prompt=h.stats().lastOptions.body.get('prompt');
 assert.match(prompt,/exactly one strong saturated colour chord/);
 assert.match(prompt,/flat opaque paint/);
 assert.match(prompt,/palette-knife drag marks/);
});
