import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLiveBookPage, LIVE_BOOK_PATHS } from './audit-live-seo.mjs';

const route=LIVE_BOOK_PATHS[0];
const canonical='https://books.freddybremseth.com'+route;
const html=href=>'<!doctype html><html><head><title>Real book title</title><link rel="canonical" href="'+href+'"></head><body><h1>Real book title</h1></body></html>';
const mock=(body,status=200,type='text/html')=>async()=>new Response(body,{status,headers:{'content-type':type}});
test('correct live individual book canonical and visible initial HTML are verified',async()=>{
 assert.deepEqual(await auditLiveBookPage(route,mock(html(canonical))),{route,status:'verified'});
});
test('public legacy SPA fallback is NOT a successful generated-book deployment',async()=>{
 assert.deepEqual(await auditLiveBookPage(route,mock(html('https://books.freddybremseth.com/'))),{
  route,status:'homepage_canonical_fallback',
 });
 assert.deepEqual(await auditLiveBookPage(route,mock(html('https://books.freddybremseth.com/en/'))),{
  route,status:'wrong_canonical',
 });
});
test('unreadable, incorrect status or HTML without canonical is not considered healthy',async()=>{
 assert.equal((await auditLiveBookPage(route,mock('Forbidden',403))).status,'http_403');
 assert.equal((await auditLiveBookPage(route,mock('{"not":"html"}',200,'application/json'))).status,'not_html');
 assert.equal((await auditLiveBookPage(route,mock('<h1>Not a book</h1>'))).status,'missing_canonical');
 assert.equal((await auditLiveBookPage(route,async()=>{throw Error('network blocked')})).status,'unreachable');
});
test('allow only fixed public URL samples, never arbitrary URLs or user inputs',async()=>{
 await assert.rejects(()=>auditLiveBookPage('/api/download?session_id=private'),/Unapproved/);
 await assert.rejects(()=>auditLiveBookPage('https://evil.invalid/'),/Unapproved/);
 assert.equal(new Set(LIVE_BOOK_PATHS).size,LIVE_BOOK_PATHS.length);
 assert.ok(LIVE_BOOK_PATHS.every(p=>/^\/(?:en|es)\/book\/[a-z0-9-]+$/.test(p)));
});
