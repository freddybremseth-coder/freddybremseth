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
 'stratism-generate-private','stratism-variant-gallery','stratism-variant-count','stratism-result','stratism-save-preview','stratism-reset-variants','stratism-refine-selected','stratism-revision-select','stratism-refinement-kind'])assert.ok(html.includes('id="'+id+'"'),id);
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
 assert.match(js,/ART_ADMIN_GET_ACCESS_TOKEN/);
 assert.match(js,/response\.status===401/);
 assert.doesNotMatch(js,/api\.openai\.com|supabase\.co|art_gallery_works/);
 assert.doesNotMatch(api,/\.storage\.from\(|\.insert\(|\.upsert\(/);
});

test('photo edit path validates JPEG and does not persist reference image',()=>{
 const apiText=fs.readFileSync(path.join(root,'api/stratism-generate.js'),'utf8');
 assert.match(apiText,/MAX_REFERENCE_BYTES=1_350_000/);
 assert.match(apiText,/reference_jpeg_base64/);
 assert.match(apiText,/\/v1\/images\/edits/);
 assert.match(apiText,/\/v1\/images\/generations/);
 assert.match(apiText,/reference_used:!!reference/);
 assert.match(js,/canvas\.toDataURL\('image\/jpeg'/);
 assert.match(js,/reference_jpeg_base64:referenceJpeg/);
 assert.match(html,/id="stratism-generate-private"/);
 assert.doesNotMatch(apiText,/\.storage\.from\(|\.insert\(|\.upsert\(/);
});

test('variant compare preserves three private candidate previews and never auto batches',()=>{
 const api=fs.readFileSync(path.join(root,'api/stratism-generate.js'),'utf8');
 new vm.Script(js);
 assert.match(js,/MAX_VARIANTS=3/);
 assert.match(js,/state\.variants\.push/);
 assert.match(js,/state\.selectedVariant/);
 assert.match(js,/clearVariants\(\)/);
 assert.match(js,/reference_jpeg_base64:referenceJpeg,variation/);
 assert.match(api,/VARIATION_DIRECTIVES/);
 assert.match(api,/Number\.isInteger\(variation\)/);
 assert.match(api,/variation<1\|\|variation>3/);
 assert.match(api,/reference_used:!!reference,variation/);
 assert.match(api,/not_print_approved:true/);
 assert.doesNotMatch(api,/\.storage\.from\(|\.insert\(|\.upsert\(/);
});

test('manual revision preserves original and stays private',()=>{
 const api=fs.readFileSync(path.join(root,'api/stratism-generate.js'),'utf8');
 new vm.Script(js);new vm.Script(api);
 assert.match(api,/const REFINEMENTS=Object\.freeze/);
 assert.match(api,/revision_mode/);
 assert.match(api,/revision_jpeg_base64/);
 assert.match(api,/if\(revisionMode!==undefined&&!reference\)/);
 assert.match(api,/refinement_applied:revisionMode\|\|null/);
 assert.match(js,/variant\.revision=\{url,mode,createdAt:/);
 assert.match(js,/variant\.showRevision=true/);
 assert.match(js,/variant\.showRevision&&variant\.revision/);
 assert.match(js,/!variant\|\|variant\.revision\|\|!state\.brief\|\|state\.busy/);
 assert.match(api,/admin\.auth\.getUser\(token\)/);
 assert.match(api,/art_gallery_admin_users/);
 assert.match(api,/not_sale_approved:true/);
 assert.match(api,/not_print_approved:true/);
 assert.doesNotMatch(api,/\.storage\.from\(|\.insert\(|\.upsert\(/);
});

test('Stratism shares refreshed gallery authorization and avoids stale sessionStorage',()=>{
 const gallery=fs.readFileSync(path.join(root,'assets/js/admin.js'),'utf8');
 assert.match(gallery,/window\.ART_ADMIN_GET_ACCESS_TOKEN/);
 assert.match(gallery,/state\.authorized/);
 assert.match(gallery,/await refresh\(\)/);
 assert.match(js,/getToken\(\{forceRefresh\}\)/);
 assert.match(js,/if\(response\.status===401\)response=await send\(true\)/);
 assert.doesNotMatch(js,/sessionStorage\.getItem\('art-admin-session'\)/);
});

test('private project backup and restore include each preview and revision with approval gates closed',()=>{
 new vm.Script(js);
 assert.match(html,/id="stratism-export-project"/);
 assert.match(html,/id="stratism-import-project"/);
 assert.match(js,/ARCHIVE_SCHEMA='stratism-project-v1'/);
 assert.match(js,/MAX_ARCHIVE_BYTES=48\*1024\*1024/);
 assert.match(js,/async function urlToBase64/);
 assert.match(js,/function base64ToJpegUrl/);
 assert.match(js,/image_base64:await urlToBase64\(v\.url\)/);
 assert.match(js,/image_base64:await urlToBase64\(v\.revision\.url\)/);
 assert.match(js,/archive\.approvals\?\.commercial_release!==false/);
 assert.match(js,/archive\.approvals\?\.print_release!==false/);
 assert.match(js,/commercial_release:false,print_release:false,human_approval_required:true/);
 assert.match(js,/temporaryUrls=\[\]/);
 assert.match(js,/for\(const url of temporaryUrls\)URL\.revokeObjectURL\(url\)/);
 assert.match(js,/referenceInput\.value=''/);
 assert.doesNotMatch(js,/\.storage\.from\(|\/api\/publish|stripe\/checkout/);
});
