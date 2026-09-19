'use strict';
const artworks=require('../../assets/catalog.json');
const masters=require('../../scripts/private-masters-manifest.json');
const byId=new Map(artworks.map(a=>[a.id,a]));
const masterById=new Map(masters.map(m=>[m.id,m]));
const PRICE_CENTS=5000;
function findArtwork(id){return typeof id==='string'?byId.get(id):undefined}
function findMaster(id){return typeof id==='string'?masterById.get(id):undefined}
function baseUrl(){const s=process.env.SITE_URL||'';let u;try{u=new URL(s)}catch{return null}if(u.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&u.hostname==='localhost'))return null;return u.origin}
function ready(){return process.env.DIGITAL_SALES_ENABLED==='true'&&!!(process.env.STRIPE_SECRET_KEY&&process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY&&baseUrl())}
module.exports={artworks,masters,PRICE_CENTS,findArtwork,findMaster,baseUrl,ready};
