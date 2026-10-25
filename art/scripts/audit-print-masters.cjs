#!/usr/bin/env node
'use strict';
// Metadata-only audit: never downloads private masters, never alters sales or storage.
const manifest=require('./private-masters-manifest.json');
const catalogue=require('../assets/catalog.json');
const {CANDIDATE_SKUS,localProductForSku,isCuratedFineArtProduct}=require('../api/_lib/prodigi.cjs');
function audit(masters=manifest,artworks=catalogue){
 const indexed=new Map(masters.map(row=>[row.id,row]));
 const items=artworks.map(art=>{
  const master=indexed.get(art.id);
  const w=Number(master?.width),h=Number(master?.height);
  if(!master)return {id:art.id,title:art.title,state:'no_manifest_master',candidate_sizes:[]};
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)
   return {id:art.id,title:art.title,state:'missing_dimensions',candidate_sizes:[],archive:master.archive};
  const asset={pixel_width:w,pixel_height:h};
  const variants=CANDIDATE_SKUS.map(sku=>localProductForSku(sku,asset))
   .filter(p=>p&&isCuratedFineArtProduct(p,200))
   .sort((a,b)=>a.dimensions.width*a.dimensions.height-b.dimensions.width*b.dimensions.height);
  return {
   id:art.id,title:art.title,state:variants.length?'size_candidates':'no_quality_eligible_sizes',
   pixels:{width:w,height:h},candidate_sizes:variants.slice(0,6).map(p=>({
    sku:p.sku,ppi:p.quality.effective_ppi,quality:p.quality.label
   })),total_quality_eligible_sizes:variants.length
  };
 });
 return {
  scope:'checked-in legacy catalogue and master manifest only',
  verification:'dimensions are manifest claims; actual private files, Prodigi catalogue, shipping and checkout NOT checked',
  total:items.length,
  counts:items.reduce((out,item)=>(out[item.state]=(out[item.state]||0)+1,out),{}),
  works:items
 };
}
if(require.main===module){
 const report=audit();
 if(process.argv.includes('--json'))process.stdout.write(JSON.stringify(report,null,2)+'\n');
 else{
  console.log('Legacy artworks:',report.total,'States:',JSON.stringify(report.counts));
  for(const item of report.works){
   console.log(item.state,JSON.stringify(item.id),'sizes:',item.candidate_sizes.map(v=>v.sku.replace('GLOBAL-FAP-','')).join(', ')||'none');
  }
  console.log(report.verification);
 }
}
module.exports={audit};
