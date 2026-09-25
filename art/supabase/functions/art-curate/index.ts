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
type Option={id:string;name:string;description?:string};
function cleanOptions(value:unknown,max:number):Option[]{
  if(!Array.isArray(value)||!value.length||value.length>max)throw new Error('Invalid classification options');
  return value.map((entry:any)=>{
    const id=String(entry?.id||'').trim();
    const name=String(entry?.name||'').trim();
    const description=String(entry?.description||'').trim().slice(0,700);
    if(!/^[a-z0-9-]{2,80}$/.test(id)||!name||name.length>150)throw new Error('Invalid classification option');
    return {id,name,description};
  });
}
async function callGemini(prompt:string,image:string,mimeType:string){
  const key=optionalEnv('FAMILYHUB_GEMINI_API_KEY');
  if(!key)return {ok:false,status:0,text:'Gemini key unavailable'};
  let lastStatus=0,lastText='';
  for(let attempt=0;attempt<3;attempt++){
    const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='+encodeURIComponent(key),{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        contents:[{role:'user',parts:[{text:prompt},{inline_data:{mime_type:mimeType,data:image}}]}],
        generationConfig:{temperature:0.1,responseMimeType:'application/json'}
      })
    });
    if(response.ok){
      const result=await response.json();
      return {ok:true,status:response.status,text:result?.candidates?.[0]?.content?.parts?.map((part:any)=>part?.text||'').join('')||'',provider:'Gemini'};
    }
    lastStatus=response.status;lastText=(await response.text()).slice(0,500);
    if(response.status!==429&&response.status<500)break;
    if(attempt<2){
      const retryAfter=Math.min(5000,Math.max(900,Number(response.headers.get('retry-after')||0)*1000||[1200,2800][attempt]));
      await sleep(retryAfter);
    }
  }
  return {ok:false,status:lastStatus,text:lastText||'Gemini request failed'};
}
async function callOpenAI(prompt:string,image:string,mimeType:string){
  const key=optionalEnv('FAMILYHUB_OPENAI_API_KEY');
  if(!key)return {ok:false,status:0,text:'OpenAI key unavailable'};
  const response=await fetch('https://api.openai.com/v1/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},
    body:JSON.stringify({
      model:'gpt-4o',
      messages:[{role:'user',content:[
        {type:'text',text:prompt},
        {type:'image_url',image_url:{url:'data:'+mimeType+';base64,'+image}}
      ]}],
      response_format:{type:'json_object'},
      temperature:0.1,
      max_tokens:900
    })
  });
  if(!response.ok)return {ok:false,status:response.status,text:(await response.text()).slice(0,500)};
  const result=await response.json();
  return {ok:true,status:response.status,text:result?.choices?.[0]?.message?.content||'',provider:'OpenAI'};
}
async function callClaude(prompt:string,image:string,mimeType:string){
  const key=optionalEnv('FAMILYHUB_CLAUDE_API_KEY');
  if(!key)return {ok:false,status:0,text:'Claude key unavailable'};
  const response=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({
      model:'claude-sonnet-5',
      max_tokens:900,
      temperature:0.1,
      messages:[{role:'user',content:[
        {type:'text',text:prompt},
        {type:'image',source:{type:'base64',media_type:mimeType,data:image}}
      ]}]
    })
  });
  if(!response.ok)return {ok:false,status:response.status,text:(await response.text()).slice(0,500)};
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
    const title=String(body?.title||'').trim().slice(0,150);
    const image=String(body?.image||'');
    const mimeType=String(body?.mimeType||'image/jpeg');
    const collections=cleanOptions(body?.collections,20);
    const styles=cleanOptions(body?.styles,30);
    if(!title)throw new Error('Artwork title is required');
    if(!/^(image\/jpeg|image\/png|image\/webp)$/.test(mimeType))throw new Error('Unsupported analysis image type');
    if(!/^[A-Za-z0-9+/=]+$/.test(image)||image.length<1000||image.length>6000000)throw new Error('Invalid analysis image');

    const prompt=[
      'You are the visual curator for Freddy Bremseth Art, an English-language fine-art catalogue.',
      'Study the supplied artwork image itself. The title is supporting context only.',
      'Choose exactly ONE collection and exactly ONE artistic style from the supplied options.',
      'Use the option descriptions as the taxonomy. Do not invent new IDs for collection_id or style_id. Suggested future taxonomy entries may use names and descriptions only.',
      'Collection should reflect the work\'s theme, emotional intent and subject matter.',
      'Style should reflect the dominant visual language and technique.',
      'If several styles overlap, select the single closest dominant style.',
      'Return ONLY a JSON object with: collection_id, style_id, confidence, reason, new_collection_suggested, suggested_collection_name, suggested_collection_description, new_style_suggested, suggested_style_name, suggested_style_description.',
      'collection_id and style_id must ALWAYS be valid existing option IDs, even if you recommend a new taxonomy entry as a better future fit.',
      'Set new_collection_suggested=true only when the artwork has a clear visual/theme identity that is genuinely poorly represented by every current collection. Avoid creating near-duplicates or one-off folders.',
      'Set new_style_suggested=true only when the dominant visual language is genuinely missing from every current style.',
      'Suggested names must be concise English gallery names; descriptions must be one concise English sentence. Otherwise use false and empty strings.',
      'confidence must be a number from 0 to 1. reason must be one concise English sentence of at most 180 characters.',
      'Artwork title: '+title,
      'Collections: '+JSON.stringify(collections),
      'Styles: '+JSON.stringify(styles)
    ].join('\n');

    let providerResult=await callGemini(prompt,image,mimeType);
    if(!providerResult.ok)providerResult=await callOpenAI(prompt,image,mimeType);
    if(!providerResult.ok)providerResult=await callClaude(prompt,image,mimeType);
    if(!providerResult.ok){
      const status=providerResult.status===429?429:503;
      return new Response(JSON.stringify({error:'All artwork-analysis providers are temporarily unavailable',provider_status:providerResult.status}),{
        status,
        headers:{...corsHeaders,'Content-Type':'application/json','Retry-After':status===429?'4':'2'}
      });
    }
    const modelText=providerResult.text;
    let parsed:any;
    try{parsed=JSON.parse(cleanModelText(modelText))}catch{throw new Error('Artwork analysis returned invalid JSON')}

    const collectionIds=new Set(collections.map(option=>option.id));
    const styleIds=new Set(styles.map(option=>option.id));
    const collection_id=String(parsed?.collection_id||'');
    const style_id=String(parsed?.style_id||'');
    const confidence=Math.max(0,Math.min(1,Number(parsed?.confidence)||0));
    const reason=String(parsed?.reason||'').trim().slice(0,180);
    const new_collection_suggested=parsed?.new_collection_suggested===true;
    const suggested_collection_name=new_collection_suggested?String(parsed?.suggested_collection_name||'').trim().slice(0,80):'';
    const suggested_collection_description=new_collection_suggested?String(parsed?.suggested_collection_description||'').trim().slice(0,220):'';
    const new_style_suggested=parsed?.new_style_suggested===true;
    const suggested_style_name=new_style_suggested?String(parsed?.suggested_style_name||'').trim().slice(0,80):'';
    const suggested_style_description=new_style_suggested?String(parsed?.suggested_style_description||'').trim().slice(0,220):'';
    if(!collectionIds.has(collection_id)||!styleIds.has(style_id))throw new Error('Artwork analysis returned an unknown category');
    if(!reason)throw new Error('Artwork analysis returned no reason');
    if(new_collection_suggested&&(!suggested_collection_name||!suggested_collection_description))throw new Error('Artwork analysis returned an incomplete collection suggestion');
    if(new_style_suggested&&(!suggested_style_name||!suggested_style_description))throw new Error('Artwork analysis returned an incomplete style suggestion');

    return new Response(JSON.stringify({collection_id,style_id,confidence,reason,new_collection_suggested,suggested_collection_name,suggested_collection_description,new_style_suggested,suggested_style_name,suggested_style_description,analysis_provider:providerResult.provider}),{
      headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }catch(error:any){
    return new Response(JSON.stringify({error:error?.message||'Artwork analysis failed'}),{
      status:500,
      headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }
});
