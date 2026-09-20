const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/js/seo-referral-tracker.js'),'utf8');
function execute({referrer='https://gemini.google.com/app/private?visitor_id=123',pathname='/verk/marmorbyste-med-gullsprekker-og-sommerfugl/',hostname='art.freddybremseth.com',status=204,storage=new Map()}={}) {
 const calls=[];
 const window={location:{protocol:'https:',hostname,pathname},sessionStorage:{
   getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),
 }};
 vm.runInNewContext(source,{window,document:{referrer},URL,JSON,
   fetch:(url,options)=>{calls.push({url,options});return Promise.resolve({status})}});
 return {calls,storage};
}
function tick(){return new Promise(resolve=>setImmediate(resolve));}
test('public artwork and collection sources transmit only verified search/AI source hosts, never visitor URLs', async()=>{
 const {calls,storage}=execute();
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,'https://realtyflow.chatgenius.pro/api/public/search-discovery');
 assert.deepEqual(JSON.parse(calls[0].options.body),{
   path:'/verk/marmorbyste-med-gullsprekker-og-sommerfugl/',
   referrer:'https://gemini.google.com/',
 });
 assert.ok(!calls[0].options.body.includes('private'));
 assert.ok(!calls[0].options.body.includes('visitor_id'));
 await tick();
 assert.equal(storage.size,1);
 assert.equal(execute({storage}).calls.length,0);
 assert.equal(execute({pathname:'/collections/human-condition/',storage}).calls.length,1);
 assert.equal(execute({referrer:'https://www.google.com/search?q=confidential',pathname:'/'}).calls.length,1);
});
test('failed collector acknowledgements remain retryable without inventing measured visits',async()=>{
 const storage=new Map();
 execute({status:503,storage});
 await tick();
 assert.equal(storage.size,0);
 assert.equal(execute({status:204,storage}).calls.length,1);
});
test('arbitrary private paths, insecure referrers, spoofed hosts and other deployments never send events',()=>{
 for(const pathname of ['/api/private','/checkout','/account/private','/verk/customer@example.com','/verk/secret/notes']) {
   assert.equal(execute({pathname}).calls.length,0,pathname);
 }
 for(const referrer of ['', 'http://www.google.com/search?q=private','https://google.com.evil.invalid/',
 'https://notgoogle.com/', 'https://fakechatgpt.com/', 'https://unknown.invalid/']) {
   assert.equal(execute({referrer}).calls.length,0,referrer);
 }
 assert.equal(execute({hostname:'art.freddybremseth.com.evil.invalid'}).calls.length,0);
});
test('all generated public gallery types load exactly one source-only attribution script',()=>{
 for(const file of ['index.html','verk/marmorbyste-med-gullsprekker-og-sommerfugl/index.html','collections/human-condition/index.html']){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  assert.equal(html.split('src="/assets/js/seo-referral-tracker.js"').length-1,1,file);
 }
});
