const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('private art archive uploader syntax and CLI load without credentials',()=>{
 const run=spawnSync('python3',['scripts/upload-gallery-masters.py','--help'],{cwd:root,encoding:'utf8',timeout:30000});
 assert.equal(run.status,0,run.stderr||run.stdout);
 assert.match(run.stdout,/--kintsugi-zip/);
 assert.match(run.stdout,/--dry-run/);
});
