import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};

function requiredEnv(name:string){
  const value=Deno.env.get(name);
  if(!value)throw new Error(name+' is required');
  return value;
}

function cleanModelText(text:string){
  return String(text||'').trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'').trim();
}

serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
  if(req.method!=='POST')return new Response(JSON.stringify({error:'POST only'}),{status:405,headers:{...corsHeaders,'Content-Type':'application/json'}});
  try{
    const supabaseUrl=requiredEnv('SUPABASE_URL');
    const anonKey=requiredEnv('SUPABASE_ANON_KEY');
    const authHeader=req.headers.get('Authorization')||'';
    const client=createClient(supabaseUrl,anonKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await client.auth.getUser();
    if(userError||!userData.user)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{...corsHeaders,'Content-Type':'application/json'}});
    const {data:membership,error:membershipError}=await client.from('art_gallery_admin_users').select('user_id').eq('user_id',userData.user.id).maybeSingle();
    if(membershipError||!membership)return new Response(JSON.stringify({error:'Gallery administrator access required'}),{status:403,headers:{...corsHeaders,'Content-Type':'application/json'}});

    const body=await req.json().catch(()=>({}));
    const titles=Array.isArray(body?.titles)?body.titles.map((v:unknown)=>String(v??'').trim()):[];
    if(!titles.length||titles.length>30||titles.some((title:string)=>!title||title.length>150)){
      return new Response(JSON.stringify({error:'Provide 1-30 non-empty titles of at most 150 characters'}),{status:400,headers:{...corsHeaders,'Content-Type':'application/json'}});
    }

    const key=requiredEnv('FAMILYHUB_GEMINI_API_KEY');
    const prompt=[
      'You are the title-normalization service for an English-language fine-art catalogue.',
      'Return ONLY a JSON array of strings, in exactly the same order and with exactly the same number of items as the input.',
      'Rules:',
      '1. If an input title is already English, return it unchanged except trimming surrounding whitespace.',
      '2. If an input title is Norwegian, translate it into concise, natural English suitable as an artwork title.',
      '3. Never translate an English title into Norwegian.',
      '4. Do not add commentary, explanations, numbering, quotation marks beyond valid JSON, artist names, or marketing language.',
      '5. Preserve proper names and the artistic meaning.',
      'Input titles:',
      JSON.stringify(titles)
    ].join('\n');

    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(key),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig:{temperature:0,responseMimeType:'application/json'}
      })
    });
    if(!response.ok)throw new Error('Title translation service failed ('+response.status+')');
    const result=await response.json();
    const text=result?.candidates?.[0]?.content?.parts?.[0]?.text||'';
    let normalized;
    try{normalized=JSON.parse(cleanModelText(text))}catch{throw new Error('Title translation service returned invalid JSON')}
    if(!Array.isArray(normalized)||normalized.length!==titles.length||normalized.some((title:unknown)=>typeof title!=='string'||!String(title).trim()||String(title).length>150)){
      throw new Error('Title translation service returned invalid titles');
    }
    return new Response(JSON.stringify({titles:normalized.map((title:string)=>title.trim())}),{headers:{...corsHeaders,'Content-Type':'application/json'}});
  }catch(error){
    return new Response(JSON.stringify({error:error?.message||'English title normalization failed'}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
});
