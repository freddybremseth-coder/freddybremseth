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
function optionalEnv(name:string){return Deno.env.get(name)||''}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function cleanModelText(text:string){
  return String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
}
function parseTitles(text:string,expected:number){
  let parsed:any;
  try{parsed=JSON.parse(cleanModelText(text))}catch{throw new Error('Title translation service returned invalid JSON')}
  const titles=Array.isArray(parsed)?parsed:parsed?.titles;
  if(!Array.isArray(titles)||titles.length!==expected||titles.some((title:unknown)=>typeof title!=='string'||!String(title).trim()||String(title).length>150)){
    throw new Error('Title translation service returned invalid titles');
  }
  return titles.map((title:string)=>title.trim());
}
async function callGemini(prompt:string){
  const key=optionalEnv('FAMILYHUB_GEMINI_API_KEY');
  if(!key)return {ok:false,status:0,text:'',provider:'Gemini'};
  let lastStatus=0,lastText='';
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(key),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:prompt}]}],
        generationConfig:{temperature:0,responseMimeType:'application/json'}
      })
    });
    if(response.ok){
      const result=await response.json();
      return {ok:true,status:response.status,text:result?.candidates?.[0]?.content?.parts?.[0]?.text||'',provider:'Gemini'};
    }
    lastStatus=response.status;lastText=(await response.text()).slice(0,500);
    if(response.status!==429&&response.status<500)break;
    if(attempt<2){
      const retryAfter=Math.min(5000,Math.max(900,Number(response.headers.get('retry-after')||0)*1000||[1200,2800][attempt]));
      await sleep(retryAfter);
    }
  }
  return {ok:false,status:lastStatus,text:lastText,provider:'Gemini'};
}
async function callOpenAI(prompt:string){
  const key=optionalEnv('FAMILYHUB_OPENAI_API_KEY');
  if(!key)return {ok:false,status:0,text:'',provider:'OpenAI'};
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model:'gpt-4o',
      messages:[{role:'user',content:prompt}],
      response_format:{type:'json_object'},
      temperature:0,
      max_tokens:1200
    })
  });
  if(!response.ok)return {ok:false,status:response.status,text:(await response.text()).slice(0,500),provider:'OpenAI'};
  const result=await response.json();
  return {ok:true,status:response.status,text:result?.choices?.[0]?.message?.content||'',provider:'OpenAI'};
}
async function callClaude(prompt:string){
  const key=optionalEnv('FAMILYHUB_CLAUDE_API_KEY');
  if(!key)return {ok:false,status:0,text:'',provider:'Claude'};
  const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({
      model:'claude-sonnet-5',
      max_tokens:1200,
      temperature:0,
      messages:[{role:'user',content:prompt}]
    })
  });
  if(!response.ok)return {ok:false,status:response.status,text:(await response.text()).slice(0,500),provider:'Claude'};
  const result=await response.json();
  return {ok:true,status:response.status,text:result?.content?.map((part:any)=>part?.text||'').join('')||'',provider:'Claude'};
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

    const prompt=[
      'You are the title-normalization service for an English-language fine-art catalogue.',
      'Return ONLY valid JSON in this exact shape: {"titles":["..."]}. The titles array must have exactly the same order and number of items as the input.',
      'Rules:',
      '1. If an input title is already English, return it unchanged except trimming surrounding whitespace.',
      '2. If an input title is Norwegian, translate it into concise, natural English suitable as an artwork title.',
      '3. Never translate an English title into Norwegian.',
      '4. Do not add commentary, explanations, numbering, artist names, or marketing language.',
      '5. Preserve proper names and the artistic meaning.',
      'Input titles:',
      JSON.stringify(titles)
    ].join('\n');

    let providerResult=await callGemini(prompt);
    if(!providerResult.ok)providerResult=await callOpenAI(prompt);
    if(!providerResult.ok)providerResult=await callClaude(prompt);
    if(!providerResult.ok){
      const status=providerResult.status===429?429:503;
      return new Response(JSON.stringify({error:'All title-translation providers are temporarily unavailable'}),{
        status,
        headers:{...corsHeaders,'Content-Type':'application/json','Retry-After':status===429?'4':'2'}
      });
    }
    const normalized=parseTitles(providerResult.text,titles.length);
    return new Response(JSON.stringify({titles:normalized,translation_provider:providerResult.provider}),{
      headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }catch(error:any){
    return new Response(JSON.stringify({error:error?.message||'English title normalization failed'}),{
      status:500,
      headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }
});
