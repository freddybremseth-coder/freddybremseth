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
 'stratism-reference-status','stratism-print-capacity',
 'stratism-generate-private','stratism-generated-preview','stratism-result','stratism-save-preview'])assert.ok(html.includes('id="'+id+'"'),id);
});
test('client script parses and cannot auto publish or call external API',()=>{
 assert.ok(!js.includes('XMLHttpRequest')&&!js.includes('publishArtwork('));
 assert.match(js,/commercial_release:false/);assert.match(js,/print_release:false/);
});

test('reference inspection stays local with no upload or false print certification',()=>{
 assert.match(js,/reference_metadata:state\.reference/);
 assert.match(js,/image\.naturalWidth/);
 assert.match(js,/pixelPass/);
 assert.match(js,/aspectPass/);
 assert.match(js,/ikke printgodkjenning/);
 assert.ok(!js.includes('XMLHttpRequest')&&!js.includes('publishArtwork('));
});

test('AI generation is server authorized and cannot publish or sell',()=>{
 const api=fs.readFileSync(path.join(root,'api/stratism-generate.js'),'utf8');
 new vm.Script(api);
 assert.match(api,/STRATISM_GENERATION_ENABLED/);
 assert.match(api,/admin\.auth\.getUser\(token\)/);
 assert.match(api,/art_gallery_admin_users/);
 assert.match(api,/not_sale_approved:true/);
 assert.match(api,/not_print_approved:true/);
 assert.match(api,/stored:false,published:false/);
 assert.match(js,/\/api\/stratism-generate/);
 assert.match(js,/Authorization':'Bearer/);
 assert.doesNotMatch(js,/api\.openai\.com|supabase\.co|art_gallery_works/);
 assert.doesNotMatch(api,/\.storage\.from\(|\.insert\(|\.upsert\(/);
});

test('photo edit path validates JPEG and does not persist reference image',()=>{
 const apiText=fs.readFileSync(path.join(root,'api/stratism-generate.js'),'utf8');
 const endpoint=require('../api/stratism-generate.js');
 assert.match(apiText,/MAX_REFERENCE_BYTES=1_350_000/);
 assert.match(apiText,/reference_jpeg_base64/);
 assert.match(apiText,/\/v1\/images\/edits/);
 assert.match(apiText,/\/v1\/images\/generations/);
 assert.match(apiText,/reference_used:!!reference/);
 assert.match(js,/canvas\.toDataURL\('image\/jpeg'/);
 assert.match(js,/reference_jpeg_base64:referenceJpeg/);
 assert.match(html,/Generer privat forslag/);
 assert.doesNotMatch(apiText,/\.storage\.from\(|\.insert\(|\.upsert\(/);
});
