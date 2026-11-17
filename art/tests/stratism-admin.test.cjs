'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/js/stratism-studio.js'),'utf8');
test('Stratism composer is nested in protected admin panel',()=>{
 const a=html.indexOf('<section id="admin-panel" hidden>');
 const b=html.indexOf('id="stratism-brief-form"');
 assert.ok(a>=0&&b>a);
 assert.match(html,/stratism-studio\.js/);assert.match(html,/stratism-studio\.css/);
});
test('all composer controls are present',()=>{
 for(const id of ['stratism-title','stratism-source','stratism-description','stratism-chord',
 'stratism-emphasis','stratism-strength','stratism-download-brief','stratism-brief-output',
 'stratism-brief-status','stratism-reference-file','stratism-reference-preview',
 'stratism-reference-status','stratism-print-capacity'])assert.ok(html.includes('id="'+id+'"'),id);
});
test('client script parses and cannot auto publish or call external API',()=>{
 new vm.Script(js);assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\b|\bpublishArtwork\s*\(/);
 assert.match(js,/commercial_release:false/);assert.match(js,/print_release:false/);
});

test('reference inspection stays local with no upload or false print certification',()=>{
 assert.match(js,/reference_metadata:state\.reference/);
 assert.match(js,/image\.naturalWidth/);
 assert.match(js,/pixelPass/);
 assert.match(js,/aspectPass/);
 assert.match(js,/ikke printgodkjenning/);
 assert.doesNotMatch(js,/\bfetch\s*\(|\bXMLHttpRequest\b/);
});
