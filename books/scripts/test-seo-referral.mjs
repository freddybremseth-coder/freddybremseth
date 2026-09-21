import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source=fs.readFileSync(path.join(root,'assets/seo-referral-tracker.js'),'utf8');
const SITE='books.freddybremseth.com';
function execute({referrer='https://www.google.com/search?q=private&visitor_id=123',pathname='/book/the-facade-of-justice',hostname=SITE,status=204,storage=new Map()}={}) {
  const calls=[];
  const window={location:{protocol:'https:',hostname,pathname},sessionStorage:{
    getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),
  }};
  vm.runInNewContext(source,{
    window,document:{referrer},URL,JSON,fetch:(url,options)=>{
      calls.push({url,options});
      return Promise.resolve({status});
    },
  });
  return {calls,storage};
}
async function tick(){await new Promise(resolve=>setImmediate(resolve));}
{
  const {calls,storage}=execute();
  assert.equal(calls.length,1,'first real book referrer reaches collector');
  assert.equal(calls[0].url,'https://realtyflow.chatgenius.pro/api/public/search-discovery');
  assert.deepEqual(JSON.parse(calls[0].options.body),{
    path:'/book/the-facade-of-justice',referrer:'https://www.google.com/',
  });
  assert.equal(calls[0].options.method,'POST');
  assert.equal(calls[0].options.keepalive,true);
  assert.ok(!calls[0].options.body.includes('private'));
  assert.ok(!calls[0].options.body.includes('visitor_id'));
  await tick();
  assert.equal(storage.size,1,'acknowledged database receipt is deduplicated only within this session');
  assert.equal(execute({storage}).calls.length,0,'same source/page is not re-counted in one session');
  assert.equal(execute({storage,pathname:'/en/book/shadows-of-the-past'}).calls.length,1,'different book remains independently countable');
}
{
  const storage=new Map();
  assert.equal(execute({status:503,storage}).calls.length,1);
  await tick();
  assert.equal(storage.size,0,'failed database receipt is never marked as captured');
  assert.equal(execute({status:204,storage}).calls.length,1,'a later observed arrival remains retryable');
}
for(const referrer of [
  '', 'https://google.com.evil.example/search?q=private',
  'https://notgoogle.com/', 'https://evil-chatgpt.com/',
  'https://unknown.invalid/', 'http://www.google.com/search?q=private',
]) assert.equal(execute({referrer}).calls.length,0,referrer);
for(const pathname of ['/api/private','/checkout','/account/customer','/book/person@example.com','/book/secret/notes']) {
  assert.equal(execute({pathname}).calls.length,0,pathname);
}
assert.equal(execute({hostname:'books.freddybremseth.com.evil.example'}).calls.length,0);
assert.deepEqual(JSON.parse(execute({referrer:'https://gemini.google.com/app/private',pathname:'/es/book/the-facade-of-justice'}).calls[0].options.body),{
  path:'/es/book/the-facade-of-justice',referrer:'https://gemini.google.com/',
});
const bookHtml=fs.readFileSync(path.join(root,'book/the-facade-of-justice.html'),'utf8');
const englishHtml=fs.readFileSync(path.join(root,'en/book/the-facade-of-justice.html'),'utf8');
const topicHtml=fs.readFileSync(path.join(root,'es/topics/psychological-thrillers.html'),'utf8');
for(const [label,html] of [['book',bookHtml],['English book',englishHtml],['topic',topicHtml]]) {
  assert.equal(html.split('src="/assets/seo-referral-tracker.js"').length-1,1,label+' must load the tracker exactly once');
}

// The growth-event client records book interactions, never a second search/AI
// arrival. Only seo-referral-tracker.js can post to the portfolio collector;
// otherwise one real visit is counted twice and the legacy client could send
// referrer query strings to another domain.
const growthClient = fs.readFileSync(path.join(root,'assets/books-growth.js'),'utf8');
assert.ok(!growthClient.includes('trackSearchDiscovery('), 'legacy duplicate arrival tracker must be absent');
assert.ok(!growthClient.includes('/api/public/search-discovery'), 'growth client cannot send duplicate discovery events');
assert.ok(growthClient.includes("send('book_view'"), 'book interaction telemetry remains intact');

console.log('PASS books: real item/topic pages load a single privacy-minimal source tracker, private/spoofed hosts excluded, 503 retry safe.');
