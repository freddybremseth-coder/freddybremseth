import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(resolve(root, "assets/search-discovery.js"), "utf8");
function visit({ referrer="https://www.google.com/search?q=private&session_id=123", pathname="/", hostname="www.freddybremseth.com", protocol="https:", status=204, stored=new Map() }={}) {
  const calls=[];
  const window={location:{hostname,protocol,pathname},sessionStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)}};
  vm.runInNewContext(script,{window,document:{referrer},URL,JSON,fetch:(url,options)=>{
    calls.push({url,options});
    return Promise.resolve({status});
  }});
  return {calls,stored};
}
const nextMicrotasks = () => new Promise(resolve => setImmediate(resolve));

test("root site records only trusted search/AI origins and public page paths, never full referrer", async () => {
  const {calls,stored}=visit();
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"https://realtyflow.chatgenius.pro/api/public/search-discovery");
  assert.equal(calls[0].options.method,"POST");
  assert.deepEqual(JSON.parse(calls[0].options.body),{path:"/",referrer:"https://www.google.com/"});
  assert.ok(!calls[0].options.body.includes("private"));
  assert.ok(!calls[0].options.body.includes("session_id"));
  assert.equal(stored.size,0,"not yet confirmed by collector");
  await nextMicrotasks();
  assert.equal(stored.size,1,"durable receipt received");
  assert.equal(visit({stored}).calls.length,0,"do not double-count same source/page within session");
  assert.equal(visit({stored,pathname:"/es/"}).calls.length,1,"other locale is an independent landing page");
});
test("failed central database acknowledgement does not suppress the next real visit",async()=>{
  const stored=new Map();
  visit({stored,status:503,pathname:"/en/"});
  await nextMicrotasks();
  assert.equal(stored.size,0);
  assert.equal(visit({stored,pathname:"/en/"}).calls.length,1);
});
test("Gemini is not Google web search; spoofed or insecure source hosts never report arrivals",()=>{
  const gemini=visit({referrer:"https://gemini.google.com/app/persons-private-conversation"});
  assert.equal(gemini.calls.length,1);
  assert.deepEqual(JSON.parse(gemini.calls[0].options.body),{path:"/",referrer:"https://gemini.google.com/"});
  for(const referrer of ["","https://google.com.evil.invalid/","https://notgoogle.com/","https://gemini.google.com.evil.invalid/","https://fakechatgpt.com/","http://www.google.com/search?q=private","https://user:pass@google.com/","https://www.google.com:8443/","javascript:alert(1)"]){
    assert.equal(visit({referrer}).calls.length,0,referrer);
  }
});
test("private pages and unrelated hostnames are never sent to the portfolio collector",()=>{
  for(const pathname of ["/api/customer","/admin","/account","/avtale","/nedlasting.html","/en/nedlasting.html","/min-side","/crm/contact","/book/person@example.com","//other.invalid","/guide?session_id=123"]){
    assert.equal(visit({pathname}).calls.length,0,pathname);
  }
  assert.equal(visit({hostname:"freddybremseth.com.evil.invalid"}).calls.length,0);
  assert.equal(visit({protocol:"http:"}).calls.length,0);
});
test("all five public translated homepages and high-level root pages load the same tracker once",()=>{
  for(const file of ["home.html","index.html","en/index.html","es/index.html","fr/index.html","de/index.html","ru/index.html","eiendomsradgiver-spania.html","ai-og-salgsstrategi.html","foredrag-og-radgivning.html","olivenolje-og-dona-anna.html"]){
    const html=readFileSync(resolve(root,file),"utf8");
    assert.equal(html.split("search-discovery.js").length-1,1,file);
  }
});
