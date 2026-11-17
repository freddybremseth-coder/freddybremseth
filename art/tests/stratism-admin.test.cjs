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
 assert.match(js,/reference_jpeg_base64:referenceJpeg/);
 assert.match(js,/requestFromCurrentBrief\(variation,referenceJpeg\)/);
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

test('three art presets are selectable and saved with individual briefs',()=>{
 for(const value of ['stratum-no4-v1','olivos-de-biar-v1','stratism-working-v09'])
  assert.match(html,new RegExp('<option value="'+value+'">'));
 assert.match(html,/id="stratism-preset"/);
 assert.match(js,/preset,composition_mode:compositionMode/);
 assert.match(js,/style:\{name:'Stratism',preset/);
 assert.match(js,/preset:state\.brief\.preset/);
 assert.match(js,/state\.brief=\{\.\.\.archive\.brief,preset:archive\.brief\.preset\|\|'stratism-working-v09'/);
 assert.match(js,/STRATISM_PRESET_IDS\.includes\(brief\.preset\)/);
 assert.match(js,/function updatePresetDescription\(\)/);
 assert.match(js,/form\.addEventListener\('change'/);
 assert.match(js,/BROAD FLAT OPAQUE/);
 assert.match(js,/Original Olivos de Biar model/);
 assert.match(js,/Original working Stratism v0\.9/);
});

test('personal-story form and two composition modes preserve art models and private archive',()=>{
 for(const id of ['stratism-composition-rule','stratism-source-kind','stratism-place',
 'stratism-story','stratism-photo-credit','stratism-reference-rights'])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/value="five-states"/);assert.match(html,/value="three-anchors"/);
 assert.match(js,/reference_rights_confirmed:referenceRights/);
 assert.match(js,/composition_mode:compositionMode/);
 assert.match(js,/source_kind:sourceKind/);
 assert.match(js,/STRATISM_PRESET_IDS/);
 assert.match(js,/state\.brief\.provenance\?\.reference_rights_confirmed/);
 assert.match(js,/state\.brief=\{\.\.\.archive\.brief/);
 assert.match(js,/state\.brief\.provenance\.reference_rights_confirmed=false/);
 assert.match(js,/commercial_release:false/);
 assert.match(js,/print_release:false/);
});

test('Stratism human quality reviews are per original or revision and stored privately',()=>{
 new vm.Script(js);
 for(const id of ['stratism-quality-panel','stratism-quality-context','stratism-quality-notes','stratism-quality-status'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const criterion of ['subject','colour','brush','transitions','linen','texture'])
  assert.match(html,new RegExp('data-stratism-quality="'+criterion+'"'));
 assert.match(js,/function qualityFor\(variant\)/);
 assert.match(js,/variant\.showRevision&&variant\.revision\?'revision':'original'/);
 assert.match(js,/reviews:reviews\|\|null/);
 assert.match(js,/const reviews=validateQuality\(entry\.reviews\)/);
 assert.match(js,/if\(value==null\)return null/);
 assert.match(js,/!QUALITY_VALUES\.includes\(status\)/);
 assert.match(js,/review\.updated_at=new Date\(\)\.toISOString\(\)/);
 assert.match(html,/Dette er din manuelle vurdering/);
 assert.match(js,/IKKE salg- eller printgodkjenning/);
 assert.match(js,/commercial_release:false,print_release:false/);
});

test('quality-guided revision stays optional, saveable and original-preserving',()=>{
 assert.match(html,/value="qa-guided"/);
 assert.match(html,/id="stratism-refine-hint"/);
 assert.match(js,/function failedQualityKeys\(variant\)/);
 assert.match(js,/function refreshRefinementHint\(\)/);
 assert.match(js,/qa_failed:qaFailed/);
 assert.match(js,/qa_failed:v\.revision\.qa_failed\|\|\[\]/);
 assert.match(js,/entry\.revision\.mode==='qa-guided'&&qaFailed\.length===0/);
 assert.match(js,/!variant\|\|variant\.revision\|\|!state\.brief\|\|state\.busy/);
 assert.match(js,/variant\.revision=\{url,mode,createdAt:new Date\(\)\.toISOString\(\),qa_failed:qaFailed\|\|\[\]\}/);
 assert.match(js,/commercial_release:false,print_release:false/);
});

test('ordinary generation never references QA-revision-only variables',()=>{
 const begin=js.indexOf("$('stratism-generate-private').addEventListener");
 const end=js.indexOf("$('stratism-save-preview').addEventListener",begin);
 assert.ok(begin>0&&end>begin);
 const generation=js.slice(begin,end);
 assert.doesNotMatch(generation,/mode==='qa-guided'|qaFailed/);
 assert.match(generation,/stratismRequest\(payload\)/);
 const revision=js.slice(js.indexOf("$('stratism-refine-selected').addEventListener"),js.indexOf('const ARCHIVE_SCHEMA'));
 assert.match(revision,/qa_failed:qaFailed/);
 assert.match(revision,/revision_mode:mode/);
});

test('paid generation and revision require explicit user approval and show helpful provider errors',()=>{
 new vm.Script(js);
 assert.match(js,/function approveImageCharge\(action\)/);
 assert.match(js,/window\.confirm\(/);
 const generate=js.slice(js.indexOf("$('stratism-generate-private').addEventListener"),js.indexOf("$('stratism-save-preview').addEventListener"));
 const revise=js.slice(js.indexOf("$('stratism-refine-selected').addEventListener"),js.indexOf('// A portable, private archive'));
 assert.match(generate,/if\(!approveImageCharge\('Generering'\)\)\{/);
 assert.match(revise,/if\(!approveImageCharge\('Revisjon'\)\)\{/);
 assert.match(generate,/providerErrorMessage\(response,data\)/);
 assert.match(revise,/providerErrorMessage\(response,data\)/);
 assert.match(js,/PROVIDER_RATE_LIMIT/);
 assert.match(js,/PROVIDER_ACCESS/);
 assert.match(js,/PROVIDER_AUTH/);
 assert.match(js,/Ingen automatisk ny forespørsel sendes/);
});

test('preflight and real generation share the exact same prepared private request',()=>{
 new vm.Script(js);
 assert.match(html,/id="stratism-preflight"/);
 assert.match(html,/id="stratism-preflight-status"/);
 assert.match(js,/function requestFromCurrentBrief\(variation,referenceJpeg\)/);
 assert.match(js,/async function prepareReferenceJpeg\(\)/);
 assert.match(js,/const payload=requestFromCurrentBrief\(/);
 assert.match(js,/const payload=requestFromCurrentBrief\(variation,referenceJpeg\)/);
 assert.match(js,/stratismRequest\(payload\)/);
 assert.match(js,/\/api\/stratism-preflight/);
 assert.match(js,/data\.no_provider_call!==true/);
 assert.match(js,/async function verifyFreePreflight\(payload\)/);
 assert.match(js,/\$\('stratism-preflight'\)\.disabled=!state\.brief\|\|state\.busy/);
});

test('reference photos must be valid and transparent areas are flattened before AI or preflight',()=>{
 new vm.Script(js);
 const start=js.indexOf('async function prepareReferenceJpeg()');
 const end=js.indexOf('function requestFromCurrentBrief(',start);
 const prep=js.slice(start,end);
 assert.match(prep,/referenceInput\.files\?\.\[0\]&&!state\.reference/);
 assert.match(prep,/Referansefotoet er ikke validert/);
 assert.match(prep,/ctx\.fillStyle='#f4f0e8'/);
 assert.match(prep,/ctx\.fillRect\(0,0,canvas\.width,canvas\.height\)/);
 assert.match(prep,/ctx\.drawImage\(img,0,0,canvas\.width,canvas\.height\)/);
});
test('preflight verdict is cleared whenever source, brief or project changes',()=>{
 assert.match(js,/function invalidatePreflight\(\)/);
 assert.match(js,/form\.addEventListener\('change',event=>\{\n if\(state\.busy\)return;\n invalidatePreflight\(\)/);
 assert.match(js,/referenceInput\.addEventListener\('change',async\(\)=>\{\n if\(state\.busy\)return;\n invalidatePreflight\(\)/);
 assert.match(js,/function restorePrivateProject\(archive\)\{\n invalidatePreflight\(\)/);
});

test('QA revisions send selected failed criteria to the API and never unlock on disabled readiness',()=>{
 const begin=js.indexOf("$('stratism-refine-selected').addEventListener");
 const end=js.indexOf('// A portable, private archive',begin);
 assert.ok(begin>0&&end>begin);
 const section=js.slice(begin,end);
 assert.match(section,/const qaFailed=mode==='qa-guided'\?failedQualityKeys\(variant\):null/);
 assert.match(section,/\.\.\.\(mode==='qa-guided'\?\{qa_failed:qaFailed\}:\{\}\)/);
 assert.match(section,/stratismRequest\(payload\)/);
 assert.match(js,/\$\('stratism-refine-selected'\)\.disabled=!variant\|\|!!variant\.revision\|\|state\.busy\|\|!providerReadiness\.canGenerate/);
 const refresh=js.slice(js.indexOf('function refreshVariantUI()'),js.indexOf('// Changing the chosen artistic model'));
 assert.doesNotMatch(refresh,/disabled=\$\('stratism-refine-selected'\)\.disabled\|\|/);
 assert.match(refresh,/updateQualityUI\(\)/);
});

test('human quality criteria are tailored to each model without changing the persisted six review fields',()=>{
 new vm.Script(js);
 for(const p of ['stratum-no4-v1','three-anchors','olivos-de-biar-v1','stratism-working-v09'])
  assert.match(js,new RegExp("'"+p+"':Object\\.freeze\\(\\{"));
 assert.match(js,/Dempede olivengrønne og naturlige jordfarger/);
 assert.match(js,/Organisk, myk overgang til bar lin – ikke tvungne dryp/);
 assert.match(js,/Gjennomsiktig vask og lange dryp – uten fem faste bånd/);
 assert.match(js,/Fem ulike overganger, mauve vask og utvalgte lange dryp/);
 assert.match(js,/function activeQualityLabels\(\)/);
 assert.match(js,/control\.closest\('label'\)/);
 assert.match(js,/label\.firstChild\.nodeValue=labels\[control\.dataset\.stratismQuality\]/);
 assert.match(js,/const QUALITY_FIELDS=\['subject','colour','brush','transitions','linen','texture'\]/);
 assert.match(js,/reviews:reviews\|\|null/);
 assert.match(js,/const reviews=validateQuality\(entry\.reviews\)/);
});

test('original and revised versions appear side by side only when revision exists',()=>{
 new vm.Script(js);
 for(const id of ['stratism-before-after','stratism-compare-original','stratism-compare-revision',
  'stratism-original-score','stratism-revision-score']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(js,/function updateRevisionComparison\(selected\)/);
 assert.match(js,/const visible=!!\(selected\?\.revision&&selected\?\.url&&selected\.revision\.url\)/);
 assert.match(js,/panel\.hidden=!visible/);
 assert.match(js,/\$\('stratism-compare-original'\)\.src=selected\.url/);
 assert.match(js,/\$\('stratism-compare-revision'\)\.src=selected\.revision\.url/);
 assert.match(js,/updateRevisionComparison\(selected\)/);
 const update=js.slice(js.indexOf('function updateRevisionComparison'),js.indexOf('function refreshVariantUI()'));
 assert.doesNotMatch(update,/fetch\(|stratismRequest\(|preflightRequest\(/);
});
test('original and revision retain independent quality summaries without approving sales',()=>{
 assert.match(js,/function reviewScore\(variant,kind\)/);
 assert.match(js,/variant\?\.reviews\?\.\[kind\]/);
 assert.match(js,/reviewScore\(selected,'original'\)/);
 assert.match(js,/reviewScore\(selected,'revision'\)/);
 assert.match(html,/Ingen nye AI-kall startes her/);
 assert.match(html,/Hvert bilde har sin egen kvalitetsvurdering/);
});

test('comparison buttons select original or revision and synchronize reviews and downloads',()=>{
 for(const id of ['stratism-choose-original','stratism-choose-revision'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/function chooseComparedVersion\(showRevision\)/);
 assert.match(js,/if\(!selected\?\.revision\|\|state\.busy\)return/);
 assert.match(js,/selected\.showRevision=showRevision/);
 assert.match(js,/refreshVariantUI\(\)/);
 assert.match(js,/stratism-choose-original'\)\.addEventListener\('click',\(\)=>chooseComparedVersion\(false\)\)/);
 assert.match(js,/stratism-choose-revision'\)\.addEventListener\('click',\(\)=>chooseComparedVersion\(true\)\)/);
 assert.match(js,/\$\('stratism-choose-original'\)\.setAttribute\('aria-pressed'/);
 assert.match(js,/\$\('stratism-choose-revision'\)\.setAttribute\('aria-pressed'/);
 assert.match(js,/const key=variant\.showRevision&&variant\.revision\?'revision':'original'/);
 assert.match(js,/variant\.showRevision=\$\('stratism-revision-select'\)\.value==='1'/);
});

test('archive import rejects corrupt JPEG and invalid dimensions before project replacement',()=>{
 const begin=js.indexOf('function inspectArchivedJpeg(bytes)');
 const end=js.indexOf('function base64ToJpegUrl(encoded)',begin);
 assert.ok(begin>0&&end>begin);
 const inspect=vm.runInNewContext(js.slice(begin,end)+'; inspectArchivedJpeg');
 const makeJpeg=(width,height)=>{
  const sof=Buffer.from([255,192,0,17,8,(height>>8)&255,height&255,(width>>8)&255,width&255,
   3,1,17,0,2,17,0,3,17,0]);
  return new Uint8Array(Buffer.concat([Buffer.from([255,216,255,224,0,2]),sof,Buffer.alloc(120,1),Buffer.from([255,217])]));
 };
 const good=inspect(makeJpeg(1024,1536));
 assert.equal(good.width,1024);assert.equal(good.height,1536); // older private previews stay compatible
 assert.deepEqual(Object.values(inspect(makeJpeg(1280,1600))),[1280,1600]);
 assert.throws(()=>inspect(new Uint8Array([255,216,255,...Array(150).fill(1)])),/mangler lesbar JPEG/);
 assert.throws(()=>inspect(makeJpeg(10,20)),/ugyldig oppløsning/);
 assert.throws(()=>inspect(makeJpeg(12001,12001)),/ugyldig oppløsning/);
 const convert=js.slice(end,js.indexOf('async function urlToBase64',end));
 assert.match(convert,/inspectArchivedJpeg\(bytes\)/);
 const restore=js.slice(js.indexOf('function restorePrivateProject'),js.indexOf("$('stratism-import-project').addEventListener"));
 assert.match(restore,/const url=base64ToJpegUrl\(entry\.image_base64\)/);
 assert.match(restore,/const revUrl=base64ToJpegUrl\(entry\.revision\.image_base64\)/);
 assert.match(restore,/Only commit restored data after every image and field has been validated/);
});

test('quality reviews round-trip in both versions and malformed data is rejected before export',()=>{
 const start=js.indexOf('function validateQuality(value)');
 const end=js.indexOf('function updateQualityUI()',start);
 assert.ok(start>0&&end>start);
 const validate=vm.runInNewContext(
  "const QUALITY_FIELDS=['subject','colour','brush','transitions','linen','texture'];"+
  "const QUALITY_VALUES=['pending','pass','revise'];"+
  js.slice(start,end)+'; validateQuality'
 );
 const original={ratings:{subject:'pass',colour:'revise'},notes:'Bevar kronen',updated_at:null};
 const revision={ratings:{subject:'pass',colour:'pass'},notes:'Bedre balanse',updated_at:null};
 const both={original,revision};
 const result=validate(both);
 assert.equal(result.original.ratings.colour,'revise');
 assert.equal(result.revision.ratings.colour,'pass');
 assert.equal(validate(null),null); // legacy archives
 assert.throws(()=>validate({original:{...original,ratings:[]}}),/Ugyldig vurderingsnotat/);
 assert.throws(()=>validate({original:{...original,secret:'extra'}}),/Ugyldig vurderingsnotat/);
 assert.throws(()=>validate({original,unknown:{}}),/Ukjent vurderingsfelt/);
 assert.throws(()=>validate({revision:{...revision,ratings:{subject:'approved-for-sale'}}}),/Ugyldig vurderingsstatus/);
 const serialize=js.slice(js.indexOf('async function serializePrivateProject()'),
  js.indexOf("$('stratism-export-project').addEventListener"));
 assert.match(serialize,/validateQuality\(v\.reviews&&Object\.keys\(v\.reviews\)\.length\?v\.reviews:null\)/);
 assert.match(serialize,/if\(reviews\?\.revision&&!v\.revision\)/);
 assert.match(serialize,/if\(v\.showRevision&&!v\.revision\)/);
 assert.match(serialize,/reviews:reviews\|\|null/);
});

test('renewing photo rights on imported work preserves artwork and review state without bypassing consent',()=>{
 const start=js.indexOf("form.addEventListener('change',event=>");
 const end=js.indexOf("$('stratism-preset').addEventListener",start);
 const handler=js.slice(start,end);
 assert.ok(start>0&&end>start);
 assert.match(handler,/if\(event\.target===\$\('stratism-reference-rights'\)\)/);
 assert.match(handler,/state\.brief\.provenance\.reference_rights_confirmed=\$\('stratism-reference-rights'\)\.checked===true/);
 assert.match(handler,/refreshVariantUI\(\);\n  return;/);
 const rightsBranch=handler.slice(handler.indexOf("if(event.target==="),handler.indexOf(" updatePresetDescription();"));
 assert.doesNotMatch(rightsBranch,/clearVariants\(\)|state\.brief=null/);
 assert.match(handler,/clearVariants\(\);state\.brief=null/);
 assert.match(js,/\$\('stratism-reference-rights'\)\.checked=false/);
 assert.match(js,/state\.brief\.provenance\.reference_rights_confirmed=false/);
});

test('preflight gives actionable Norwegian errors and validates the exact photo and variant',()=>{
 assert.match(js,/function validationMessage\(code\)/);
 assert.match(js,/PHOTO_RIGHTS_REQUIRED:'Bekreft bruksretten til referansefotografiet/);
 assert.match(js,/INVALID_REFERENCE_DIMENSIONS:'Referansebildet har ugyldige dimensjoner/);
 assert.match(js,/if\(response\.status===400\)return validationMessage\(data\?\.code\)/);
 assert.match(js,/response\.status===400\?validationMessage\(data\.code\)/);
 const start=js.indexOf("$('stratism-preflight').addEventListener");
 const end=js.indexOf("$('stratism-generate-private').addEventListener",start);
 const part=js.slice(start,end);
 assert.match(js,/data\.source_kind!==payload\.source_kind/);
 assert.match(js,/data\.reference_used!==!!\(payload\.reference_jpeg_base64\|\|payload\.revision_jpeg_base64\)/);
 assert.match(js,/data\.variation!==payload\.variation/);
});

test('paid generation requires free preflight of identical payload before charge approval and provider call',()=>{
 const start=js.indexOf("$('stratism-generate-private').addEventListener");
 const end=js.indexOf("$('stratism-save-preview').addEventListener",start);
 assert.ok(start>0&&end>start);
 const body=js.slice(start,end);
 const prepare=body.indexOf('const payload=requestFromCurrentBrief(variation,referenceJpeg)');
 const preflight=body.indexOf('await verifyFreePreflight(payload)');
 const charge=body.indexOf("approveImageCharge('Generering')");
 const provider=body.indexOf('await stratismRequest(payload)');
 assert.ok(prepare>=0&&preflight>prepare&&charge>preflight&&provider>charge);
 assert.match(body,/if\(!approveImageCharge\('Generering'\)\)\{/);
 assert.match(body,/finally\{state\.busy=false;refreshVariantUI\(\)\}/);
 const check=js.slice(js.indexOf('async function verifyFreePreflight(payload)'),start);
 assert.match(check,/data\.no_provider_call!==true/);
 assert.match(check,/data\.preset!==payload\.preset/);
 assert.match(check,/data\.source_kind!==payload\.source_kind/);
 assert.match(check,/data\.reference_used!==!!\(payload\.reference_jpeg_base64\|\|payload\.revision_jpeg_base64\)/);
 assert.match(check,/data\.revision!==\(payload\.revision_mode\|\|null\)/);
 assert.match(check,/data\.sale_approval!==false\|\|data\.print_approval!==false/);
});

test('paid revision checks exact image and QA checklist via free preflight before charge approval',()=>{
 const start=js.indexOf("$('stratism-refine-selected').addEventListener");
 const end=js.indexOf('// A portable, private archive',start);
 assert.ok(start>0&&end>start);
 const body=js.slice(start,end);
 const prepare=body.indexOf('const payload={description:state.brief.description');
 const preflight=body.indexOf('await verifyFreePreflight(payload)');
 const charge=body.indexOf("approveImageCharge('Revisjon')");
 const provider=body.indexOf('await stratismRequest(payload)');
 assert.ok(prepare>=0&&preflight>prepare&&charge>preflight&&provider>charge);
 assert.match(body,/revision_jpeg_base64:imageData/);
 assert.match(body,/\.\.\.\(mode==='qa-guided'\?\{qa_failed:qaFailed\}:\{\}\)/);
 assert.match(body,/Revisjonen ble avbrutt/);
 const helper=js.slice(js.indexOf('async function verifyFreePreflight(payload)'),start);
 assert.match(helper,/payload\.reference_jpeg_base64\|\|payload\.revision_jpeg_base64/);
 assert.match(helper,/data\.revision!==\(payload\.revision_mode\|\|null\)/);
});

test('Stratism concepts disclose real 300 PPI dimensions and cannot masquerade as sale or print masters',()=>{
 new vm.Script(js);
 for(const id of ['stratism-concept-file-status','stratism-concept-resolution','stratism-concept-limit'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/300 DPI i metadata gir ikke flere piksler/);
 assert.match(html,/En JPEG-prøve er ikke en digital salgs-master eller print-master/);
 const start=js.indexOf('function updateConceptFileStatus(selected)');
 const end=js.indexOf('function refreshVariantUI()',start);
 assert.ok(start>=0&&end>start);
 const section=js.slice(start,end);
 assert.match(section,/1280\/300\*CM_PER_INCH/);
 assert.match(section,/1600\/300\*CM_PER_INCH/);
 assert.match(section,/Arkiverte bilder kan ha andre dimensjoner/);
 assert.match(section,/Ingen fil er godkjent for print eller digitalt salg/);
 const calc=vm.runInNewContext('const CM_PER_INCH=2.54;'+
  "[(1280/300*CM_PER_INCH).toFixed(1),(1600/300*CM_PER_INCH).toFixed(1)]");
 assert.deepEqual(Array.from(calc),['10.8','13.5']);
 assert.match(js,/updateConceptFileStatus\(selected\)/);
 assert.match(js,/stratism-private-concept-not-print-ready-/);
 assert.doesNotMatch(section,/fetch\(|stratismRequest\(/);
});

test('300 PPI print planner calculates target pixel requirements without creating print approvals',()=>{
 new vm.Script(js);
 assert.match(html,/id="stratism-print-target"/);
 assert.match(html,/id="stratism-print-plan-result"/);
 const begin=js.indexOf('const STRATISM_PRINT_TARGETS=');
 const end=js.indexOf('function updateConceptFileStatus(selected)',begin);
 assert.ok(begin>0&&end>begin);
 const code=js.slice(begin,end).replace(/\$\('stratism-print-target'\)\.addEventListener\('change',[^\n]*\n/,'');
 const planner=vm.runInNewContext('const CM_PER_INCH=2.54;'+code+
  ';calculateConceptPrintPlan');
 const large=planner('80x100');
 assert.deepEqual([large.requiredWidth,large.requiredHeight],[9449,11812]);
 assert.equal(large.ratioMatches,true);
 assert.ok(large.scale>7.3&&large.scale<7.4);
 assert.equal(large.approved,false);
 const medium=planner('40x50');
 assert.deepEqual([medium.requiredWidth,medium.requiredHeight],[4725,5906]);
 assert.equal(medium.ratioMatches,true);
 assert.equal(planner('30x40').ratioMatches,false);
 assert.throws(()=>planner('unknown'),/Ukjent printstørrelse/);
 assert.match(js,/updatePrintPlan\(selected\)/);
 assert.match(js,/ikke en faktisk oppskalering eller printgodkjenning/);
 assert.doesNotMatch(code,/fetch\(|stratismRequest\(/);
});
