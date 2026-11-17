'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'api/stratism-projects.js'),'utf8');
const clientCode=fs.readFileSync(path.join(root,'assets/js/stratism-studio.js'),'utf8');
const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
function setup({userId='11111111-1111-4111-8111-111111111111',admin=true}={}){
 let signed=0,lists=0,lookups=0,requestedPaths=[];
 const storage={list:async(prefix)=>{lists++;requestedPaths.push(prefix);return{data:[{name:'1700000000000-tree-12345678-1234-4234-8234-123456789012.json',created_at:'2026-11-17T00:00:00Z'}]}},
  createSignedUploadUrl:async(p)=>{signed++;requestedPaths.push(p);return{data:{signedUrl:'https://example.invalid/signed-upload'}}},
  createSignedUrl:async(p)=>{signed++;requestedPaths.push(p);return{data:{signedUrl:'https://example.invalid/signed-download'}}}};
 const supabase={auth:{getUser:async()=>({data:{user:{id:userId}}})},
  from:table=>{lookups++;assert.equal(table,'art_gallery_admin_users');return{select:()=>({eq:()=>({maybeSingle:async()=>({data:admin?{user_id:userId}:null})})})}},
  storage:{from:bucket=>{assert.equal(bucket,'stratism-private');return storage}}};
 const ctx={module:{exports:{}},console:{error:()=>{}},Buffer,process:{env:{STRATISM_SUPABASE_URL:'https://example.invalid',STRATISM_SUPABASE_PUBLISHABLE_KEY:'test-publishable-only'}},
  require:name=>name==='@supabase/supabase-js'?{createClient:(url,key,options)=>{
    assert.equal(key,'test-publishable-only');assert.ok(url.endsWith('example.invalid'));
    assert.match(options.global.headers.Authorization,/^Bearer /);
    return supabase;
   }}:{randomUUID:()=> '12345678-1234-4234-8234-123456789012'}};
 vm.runInNewContext(code,ctx);
 async function call({method='GET',body,token='good'}={}){
  const res={statusCode:200,body:null,setHeader:()=>{},status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};
  await ctx.module.exports({method,headers:token?{authorization:'Bearer '+token}:{},body},res);
  return res;
 }
 return {call,stats:()=>({signed,lists,lookups,requestedPaths})};
}
test('private archive requires administrator for all actions',async()=>{
 const x=setup({admin:false});
 assert.equal((await x.call()).statusCode,403);
 assert.equal((await x.call({method:'POST',body:{action:'prepare',title:'Tree',bytes:200}})).statusCode,403);
 assert.equal(x.stats().signed,0);
});
test('archive cannot be read without a token',async()=>{
 const x=setup();
 assert.equal((await x.call({token:null})).statusCode,401);
 assert.equal(x.stats().signed,0);
});
test('list is restricted to the current admin user',async()=>{
 const x=setup();const r=await x.call();
 assert.equal(r.statusCode,200);
 assert.equal(r.body.private,true);
 assert.equal(r.body.projects.length,1);
 assert.deepEqual(x.stats().requestedPaths,['projects/11111111-1111-4111-8111-111111111111/']);
});
test('uploads produce new signed private per-user objects with bounded JSON size',async()=>{
 const x=setup();
 const r=await x.call({method:'POST',body:{action:'prepare',title:'Old Olive Tree',bytes:4000}});
 assert.equal(r.statusCode,200);assert.equal(r.body.private,true);
 assert.match(x.stats().requestedPaths[0],/^projects\/11111111-1111-4111-8111-111111111111\/\d{13}-old-olive-tree-/);
 assert.equal(x.stats().signed,1);
 const bad=await x.call({method:'POST',body:{action:'prepare',title:'x',bytes:90*1024*1024}});
 assert.equal(bad.statusCode,400);assert.equal(x.stats().signed,1);
});
test('opening permits only UUID-form project basenames, not arbitrary paths',async()=>{
 const x=setup();
 const fail=await x.call({method:'POST',body:{action:'open',name:'../another-user/secret.json'}});
 assert.equal(fail.statusCode,400);assert.equal(x.stats().signed,0);
 const valid=await x.call({method:'POST',body:{action:'open',name:'1700000000000-tree-12345678-1234-4234-8234-123456789012.json'}});
 assert.equal(valid.statusCode,200);assert.equal(x.stats().signed,1);
 assert.match(x.stats().requestedPaths[0],/^projects\/11111111-1111-4111-8111-111111111111\//);
});
test('browser cloud operations use shared admin session and validated archive',()=>{
 new vm.Script(clientCode);new vm.Script(code);
 for(const id of ['stratism-cloud-save','stratism-cloud-refresh','stratism-cloud-select','stratism-cloud-open'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(clientCode,/ART_ADMIN_GET_ACCESS_TOKEN/);
 assert.match(clientCode,/serializePrivateProject\(\)/);
 assert.match(clientCode,/restorePrivateProject\(JSON\.parse\(await file\.text\(\)\)\)/);
 assert.match(clientCode,/commercial_release:false,print_release:false/);
 assert.doesNotMatch(clientCode,/publishArtwork\(|create-checkout/);
});

test('archive uses user RLS instead of service-role credentials',()=>{
 assert.match(code,/STRATISM_SUPABASE_PUBLISHABLE_KEY/);
 assert.match(code,/global:\{headers:\{Authorization:'Bearer '\+token\}\}/);
 assert.doesNotMatch(code,/SUPABASE_SERVICE_ROLE_KEY/);
});
