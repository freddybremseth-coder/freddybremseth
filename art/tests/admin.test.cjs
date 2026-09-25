'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('admin UI and all dependencies are self-contained and expose no service key',()=>{
 const html=read('admin/index.html'),js=read('assets/js/admin.js'),config=read('assets/js/gallery-config.js'),css=read('assets/css/admin.css');
 for(const item of ['source-files','collection-default','style-default','review-list','upload-mode','catalog-list','login-form'])assert.ok(html.includes('id="'+item+'"'));
 assert.match(html,/noindex,nofollow/);
 assert.ok(!/SERVICE_ROLE_KEY|service_role/.test(js+config+html),'Admin must not expose server secrets');
 assert.match(js,/art_gallery_admin_users/);
 assert.match(js,/art-previews/);
 assert.match(js,/art-originals/);
 assert.match(js,/review_status:'pending'/);
 assert.match(js,/digital_available:false/);
 assert.match(js,/DecompressionStream/);
 assert.match(js,/collection_id:item.collection_id/);
 assert.match(js,/art_gallery_assets/);
 assert.match(js,/Smart ZIP ready/);
 assert.match(js,/assetRole/);
 assert.match(js,/Print \/ 300 DPI/);
 assert.match(js,/Digital sale \/ Retina/);
 assert.match(html,/Smart ZIP · automatic file placement/);
 assert.match(html,/PRINT_300DPI/);
 assert.match(html,/RETINA/);
 assert.match(js,/looksNorwegianTitle/);
 assert.match(js,/art-title-english/);
 assert.match(js,/Artwork titles must be English/);
 assert.match(html,/Artwork titles are English only/);
 assert.match(html,/auto-curate-default/);
 assert.match(html,/Analyse each new artwork and choose collection \+ artistic style automatically/);
 assert.match(js,/art-curate/);
 assert.match(js,/classifyArtwork/);
 assert.match(js,/classifyQueuedArtworks/);
 assert.match(js,/manual_override/);
 assert.match(css,/@media/);
 for(const script of ['assets/js/admin.js','assets/js/gallery-config.js','assets/js/collection-sync.js','assets/js/app.js','api/artwork-page.js']){
  const check=spawnSync(process.execPath,['--check',script],{cwd:root,encoding:'utf8'});
  assert.equal(check.status,0,script+': '+check.stderr);
 }
});
test('new artwork pages use dedicated route without rewriting stable existing /verk/ URLs',()=>{
 const vercel=JSON.parse(read('vercel.json'));
 assert.ok(vercel.rewrites.some(rule=>rule.source==='/artwork/:id/'&&rule.destination==='/api/artwork-page?id=:id'));
 assert.ok(!vercel.rewrites.some(rule=>rule.source.startsWith('/verk/')));
 const html=read('index.html'),app=read('assets/js/app.js'),builder=read('scripts/build-public.mjs');
 assert.ok(html.includes('/assets/js/gallery-config.js'));
 assert.match(app,/loadSupabaseCatalogue/);
 assert.match(app,/mergedCatalogue/);
 assert.match(app,/art\.dynamic\?'\/artwork\/'/);
 assert.match(builder,/['"]admin['"]/);
});
test('collection builder includes live manually selected categories',()=>{
 const builder=read('scripts/build-pages.mjs');
 assert.ok(builder.includes('/assets/js/collection-sync.js'));
 const sync=read('assets/js/collection-sync.js');
 assert.match(sync,/collection_id!==collection/);
 assert.match(sync,/admin-upload/);
 assert.match(sync,/admin-edit/);
 assert.match(sync,/admin-smart-zip/);
});

test('email sign-in preserves actionable Supabase Auth response without revealing credentials',()=>{
 const admin=read('assets/js/admin.js');
 assert.match(admin,/Supabase email sign-in failed \(HTTP /);
 assert.match(admin,/error\.message/);
 assert.match(admin,/not\.authori/);
 assert.match(admin,/rate\.limit/);
 assert.match(admin,/Redirect URLs/);
 assert.match(admin,/Content-Type/);
 assert.ok(!admin.includes('SUPABASE_SERVICE_ROLE_KEY'));
});

test('magic-link callback is handled explicitly and no email OTP is required',()=>{
 const admin=read('assets/js/admin.js'),html=read('admin/index.html');
 assert.match(admin,/param\('access_token'\)/);
 assert.match(admin,/param\('refresh_token'\)/);
 assert.match(admin,/param\('token_hash'\)/);
 assert.match(admin,/param\('code'\)/);
 assert.match(admin,/localStorage\.setItem\('art-admin-magic-link-requested-at'/);
 assert.match(admin,/The email opened the gallery without a usable Supabase login session/);
 assert.match(admin,/remember\(\{access_token:token,refresh_token:refreshToken/);
 assert.match(html,/A magic link does not contain a separate verification code/);
 assert.match(html,/\{\{ \.ConfirmationURL \}\}/);
 assert.match(html,/art\.freddybremseth\.com\/admin\//);
 assert.ok(!html.includes('<form id="code-form" hidden>'));
});

test('smart ZIP schema records private and public roles without auto-enabling sales',()=>{
 const sql=read('scripts/ART_SMART_ZIP_ASSETS.sql');
 assert.match(sql,/art_gallery_assets/);
 assert.match(sql,/asset_role in \('master','digital','print','portfolio'\)/);
 assert.match(sql,/asset_role = 'portfolio' and bucket_name = 'art-previews'/);
 assert.match(sql,/asset_role <> 'portfolio' and bucket_name = 'art-originals'/);
 assert.match(sql,/verified_at is null/);
 const admin=read('assets/js/admin.js');
 assert.match(admin,/digital_available:false/);
 assert.ok(!/DIGITAL_SALES_ENABLED\s*=\s*true/.test(admin));
});

test('English title normalizer is admin-only and never asks for Norwegian output',()=>{
 const fn=read('supabase/functions/art-title-english/index.ts');
 assert.match(fn,/art_gallery_admin_users/);
 assert.match(fn,/client\.auth\.getUser/);
 assert.match(fn,/If an input title is already English, return it unchanged/);
 assert.match(fn,/If an input title is Norwegian, translate it into concise, natural English/);
 assert.match(fn,/Never translate an English title into Norwegian/);
 assert.match(fn,/responseMimeType:'application\/json'/);
});

test('AI artwork curator is authenticated and constrained to the gallery taxonomy',()=>{
 const fn=read('supabase/functions/art-curate/index.ts');
 assert.match(fn,/client\.auth\.getUser/);
 assert.match(fn,/art_gallery_admin_users/);
 assert.match(fn,/Choose exactly ONE collection and exactly ONE artistic style/);
 assert.match(fn,/Do not invent new IDs for collection_id or style_id/);
 assert.match(fn,/collectionIds\.has\(collection_id\)/);
 assert.match(fn,/styleIds\.has\(style_id\)/);
 assert.match(fn,/new_collection_suggested/);
 assert.match(fn,/new_style_suggested/);
 assert.match(fn,/Avoid creating near-duplicates or one-off folders/);
 assert.match(fn,/inline_data/);
 assert.match(fn,/responseMimeType:'application\/json'/);
 const admin=read('assets/js/admin.js');
 assert.match(admin,/Taxonomy suggestion/);
 assert.match(admin,/suggested_collection_name/);
 assert.match(admin,/suggested_style_name/);
});
