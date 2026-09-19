'use strict';
const {createClient}=require('@supabase/supabase-js');
const {ready,masters}=require('./_lib/catalog.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'})}
 if(!ready())return res.status(200).json({sales_enabled:false,digital_price_eur:50,print_sales_enabled:false});
 try{
  const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.storage.from(process.env.ART_STORAGE_BUCKET||'art-originals').list('',{limit:1000,offset:0});
  const found=new Set((data||[]).filter(x=>x.id!==null).map(x=>x.name));
  const available=!error&&masters.every(a=>found.has(a.storage_path));
  return res.status(200).json({sales_enabled:available,digital_price_eur:50,print_sales_enabled:false});
 }catch(error){console.error('Art inventory health check',error?.message||'storage_error');return res.status(200).json({sales_enabled:false,digital_price_eur:50,print_sales_enabled:false})}
};
