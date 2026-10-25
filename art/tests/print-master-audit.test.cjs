'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../scripts/audit-print-masters.cjs');

test('metadata-only print audit reports missing dimensions without inventing sizes',()=>{
 const report=audit([{id:'a',width:null,height:null,archive:'archive.zip'}],[{id:'a',title:'A'}]);
 assert.equal(report.counts.missing_dimensions,1);
 assert.deepEqual(report.works[0].candidate_sizes,[]);
});

test('print audit gives quality-filtered candidates but no delivery or file verification',()=>{
 const report=audit([{id:'a',width:6000,height:7500}],[{id:'a',title:'A'}]);
 assert.equal(report.works[0].state,'size_candidates');
 assert.ok(report.works[0].candidate_sizes.length>0);
 assert.ok(report.works[0].candidate_sizes.every(x=>x.ppi>=200));
 assert.match(report.verification,/NOT checked/);
});
