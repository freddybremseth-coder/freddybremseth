const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

test('mobile and coarse-pointer artwork taps use dedicated artwork URLs',()=>{
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 assert.match(app,/useDedicatedArtworkPage=.*max-width: 760px.*pointer: coarse/);
 assert.match(app,/open\.href=detailHref\(art\)/);
 assert.match(app,/open\.className='art-card-open'/);
 assert.match(app,/if\(useDedicatedArtworkPage\(\).*return;/);
 assert.match(app,/event\.preventDefault\(\);openArt\(art,true\)/);
});

test('desktop keeps modal quick-view while modifier clicks remain native links',()=>{
 const app=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
 assert.match(app,/event\.metaKey\|\|event\.ctrlKey\|\|event\.shiftKey\|\|event\.altKey/);
 assert.match(app,/event\.button!==0/);
});

test('artwork card links retain gallery styling',()=>{
 const css=fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8');
 assert.match(css,/\.art-card button,\.art-card-open/);
 assert.match(css,/\.art-card-open:hover img/);
 assert.match(css,/\.art-card-open:focus-visible \.art-overlay/);
});
