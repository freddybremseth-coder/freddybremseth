'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const generator=require('../api/stratism-generate');

const description='An old olive tree at dawn, standing alone in a quiet field';
test('text-only workflow has no reference requirement',()=>{
 const data=generator.validateGenerationRequest({description,workflow_mode:'create',preset:'stratum-no4-v1'});
 assert.equal(data.reference,null);
 assert.match(data.prompt,/solely from the text description/i);
});
test('edit mode requires a supplied photograph',()=>{
 assert.throws(()=>generator.validateGenerationRequest({description,workflow_mode:'edit',preset:'stratum-no4-v1'}),{message:'PHOTO_REQUIRED'});
});
test('inspiration mode requires a supplied photograph',()=>{
 assert.throws(()=>generator.validateGenerationRequest({description,workflow_mode:'inspire',preset:'stratum-no4-v1'}),{message:'PHOTO_REQUIRED'});
});
test('inspiration prompt directs the engine away from copying unique image features',()=>{
 const p=generator.promptFrom({description,workflow_mode:'inspire',preset:'stratum-no4-v1'});
 assert.match(p,/different subject/i);
 assert.match(p,/do not reproduce identifiable faces/i);
});
test('editing prompt preserves subject identity',()=>{
 const p=generator.promptFrom({description,workflow_mode:'edit',preset:'stratum-no4-v1'});
 assert.match(p,/preserve the recognizable identity/i);
});
test('new directions remain explicitly experimental',()=>{
 const p=generator.promptFrom({description,workflow_mode:'create',preset:'stratum-no4-v1',experimental_direction:'A softer, airier impression with much more negative space'});
 assert.match(p,/not an approved or verified preset/i);
});
test('invalid workflow is rejected',()=>{
 assert.throws(()=>generator.validateGenerationRequest({description,workflow_mode:'copy-everything'}),{message:'INVALID_WORKFLOW'});
});
test('legacy requests remain compatible',()=>{
 assert.equal(generator.validateGenerationRequest({description,preset:'stratum-no4-v1'}).preset,'stratum-no4-v1');
});
