'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname,'..');
const app = fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
const css = fs.readFileSync(path.join(root,'assets/css/site.css'),'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root,'assets/catalog.json'),'utf8'));
const collections = JSON.parse(fs.readFileSync(path.join(root,'assets/collections.json'),'utf8'));

test('The Human Condition includes the original horizontal Moon Staircase and portraits',()=>{
 const works=catalog.filter(art=>(collections.byArtworkId[art.id]||collections.byStyle[art.style_id])==='human-condition');
 const panorama=works.find(art=>art.id==='drmmetrappen-til-manen');
 assert.ok(panorama);
 assert.equal(panorama.orientation,'Landscape');
 assert.ok(panorama.width>panorama.height);
 assert.ok(works.some(art=>art.orientation==='Portrait'));
});

test('home collection separates horizontal originals from portrait gallery without cropping',()=>{
 assert.match(app,/entry\.id==='human-condition'/);
 assert.match(app,/const horizontal=isHumanCondition\?works\.filter/);
 assert.match(app,/const portraitWorks=isHumanCondition\?works\.filter/);
 assert.match(app,/showcase\.className='human-condition-feature'/);
 assert.match(app,/segment\.appendChild\(cards\(narrowed\?varied:varied\.slice\(0,4\)\)\)/);
 assert.match(css,/\.style-group-human-condition \.human-condition-feature \.art-photo img\s*\{[^}]*object-fit:\s*contain/s);
 assert.match(css,/\.style-group-human-condition \.style-group-grid\.gallery-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
 assert.match(css,/@media \(max-width: 760px\)[\s\S]*?\.style-group-human-condition \.style-group-grid\.gallery-grid\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
 const syntax=spawnSync(process.execPath,['--check','assets/js/app.js'],{cwd:root,encoding:'utf8'});
 assert.equal(syntax.status,0,syntax.stderr);
});
