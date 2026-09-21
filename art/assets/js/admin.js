(()=>{'use strict';
const $=id=>document.getElementById(id);
const cfg=window.ART_GALLERY_CONFIG;
const state={session:null,user:null,authorized:false,styles:[],collections:[],works:[],variants:[],queue:[],busy:false};
const SITE='https://art.freddybremseth.com';
const MAX_FILE=50*1024*1024,MAX_ZIP=250*1024*1024,MAX_ITEMS=30;
const slug=s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,75);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const status=(message,bad=false)=>{$('status').textContent=message;$('status').style.background=bad?'#87382e':'#213738'};
const validImage=f=>{const s=f.name.toLowerCase();return /\.(jpg|jpeg|png|webp)$/.test(s)&&f.size>1000&&f.size<=MAX_FILE;};
const masterType=file=>file.name.toLowerCase().endsWith('.png')?'image/png':file.name.toLowerCase().endsWith('.webp')?'image/webp':'image/jpeg';
const extensions={ 'image/png':'png','image/webp':'webp','image/jpeg':'jpg' };
const dateId=()=>new Date().toISOString().slice(0,10).replace(/-/g,'');
function headers(extra={}){return {'apikey':cfg.anonKey,'Authorization':'Bearer '+state.session.access_token,...extra}}
async function api(path,options={}){
 if(!cfg?.url||!cfg?.anonKey)throw Error('Supabase gallery configuration is missing.');
 if(state.session&&Date.now()>state.session.expires_at*1000-60000)await refresh();
 const res=await fetch(cfg.url+path,{...options,headers:{...headers(options.headers||{})}});
 if(!res.ok){let msg='';try{const err=await res.json();msg=err.message||err.msg||err.error_description||err.error||''}catch{}throw Error(msg||'Supabase request failed ('+res.status+').')}
 if(res.status===204||options.headers?.Prefer==='return=minimal')return null;
 const t=await res.text();return t?JSON.parse(t):null;
}
async function publicApi(path){const res=await fetch(cfg.url+path,{headers:{'apikey':cfg.anonKey}});if(!res.ok)throw Error('Cannot read gallery catalogue ('+res.status+').');return res.json()}
function remember(session){
 if(!session?.access_token||!session?.refresh_token)throw Error('Login did not provide a valid session');
 session.expires_at=session.expires_at||Math.floor(Date.now()/1000)+(session.expires_in||3600);
 state.session=session;sessionStorage.setItem('art-admin-session',JSON.stringify(session));
 history.replaceState({},'',location.pathname);
}
async function refresh(){
 const session=state.session;if(!session?.refresh_token)throw Error('Please sign in again');
 const r=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});
 if(!r.ok){sessionStorage.removeItem('art-admin-session');state.session=null;throw Error('Your login expired. Please sign in again.')}
 remember(await r.json());
}
async function signIn(email,password){
 const res=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 if(!res.ok)throw Error('Email or password was not accepted.');
 remember(await res.json());await verifyAdmin();
}
async function sendLink(){
 const email=$('email').value.trim();if(!email)throw Error('Enter your email address first');
 const redirect=location.origin+'/admin/';
 let res;
 try{
  res=await fetch(cfg.url+'/auth/v1/otp?redirect_to='+encodeURIComponent(redirect),{
   method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},
   body:JSON.stringify({email,create_user:true})
  });
 }catch(error){throw Error('Unable to reach Supabase Auth. Check your connection and try again.')}
 if(!res.ok){
  let error={};try{error=await res.json()}catch{}
  const code=String(error.code||error.error_code||'').slice(0,70);
  const message=String(error.msg||error.message||error.error_description||'').slice(0,280);
  let guidance='';
  if(/not.authori[sz]ed|email.*not.*allowed|recipient.*not.*allowed/i.test(message+' '+code))
   guidance=' The built-in Supabase email sender only delivers to project team members. Sign in using your team email, or configure custom SMTP in Supabase Authentication.';
  else if(res.status===429||/rate.limit|too.many/i.test(message+' '+code))
   guidance=' Email sending is rate-limited. Wait before retrying; configure custom SMTP for regular use.';
  else if(/redirect|url.*not.*allowed/i.test(message+' '+code))
   guidance=' Add '+redirect+' to Supabase Authentication → URL Configuration → Redirect URLs.';
  else if(/signup.*disabled|signups.*not.*allowed/i.test(message+' '+code))
   guidance=' Ask the Supabase project owner to invite your email in Authentication → Users, then request a sign-in link.';
  const reason=message||code||'Supabase did not provide a detailed error';
  throw Error('Supabase email sign-in failed (HTTP '+res.status+'): '+reason+'.'+guidance);
 }
 try{localStorage.setItem('art-admin-magic-link-requested-at',String(Date.now()))}catch{}
 status('A magic link was sent. Open the link once, ideally in the same browser. No separate verification code is needed for a magic link.');
}
async function verifyCode(){
 const email=$('email').value.trim(),token=$('otp-code').value.trim();
 if(!email||!/^[0-9]{6,8}$/.test(token))throw Error('Enter your email and a valid one-time code.');
 const res=await fetch(cfg.url+'/auth/v1/verify',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,token,type:'email'})});
 if(!res.ok)throw Error('Code expired or invalid. Request a new sign-in email.');
 remember(await res.json());await verifyAdmin();
}
async function acceptCallback(){
 // Magic-link emails normally contain a link, not a separate verification code.
 // Supabase redirects with session tokens in the URL fragment in implicit flow.
 // Never log or display a token or full callback URL.
 const hash=new URLSearchParams(location.hash.replace(/^#/,'')),query=new URLSearchParams(location.search);
 const param=name=>hash.get(name)||query.get(name);
 const authError=param('error_description')||param('error');
 if(authError){
  history.replaceState({},'',location.pathname);
  throw Error('Email sign-in was rejected: '+authError.slice(0,230)+'. Request a new sign-in link and open it only once.');
 }
 const token=param('access_token'),refreshToken=param('refresh_token');
 if(token&&refreshToken){
  remember({access_token:token,refresh_token:refreshToken,expires_at:Math.floor(Date.now()/1000)+Number(param('expires_in')||3600)});
  try{localStorage.removeItem('art-admin-magic-link-requested-at')}catch{}
  status('Magic link verified. Checking your gallery administrator access…');
  return true;
 }
 const tokenHash=param('token_hash'),type=param('type');
 if(tokenHash&&type){
  if(!['email','magiclink','signup','invite','recovery'].includes(type)){
   history.replaceState({},'',location.pathname);
   throw Error('Unsupported email verification method. Request a new art gallery sign-in link.');
  }
  const res=await fetch(cfg.url+'/auth/v1/verify',{method:'POST',headers:{'apikey':cfg.anonKey,'Content-Type':'application/json'},
    body:JSON.stringify({token_hash:tokenHash,type})});
  if(!res.ok){
   history.replaceState({},'',location.pathname);
   throw Error('This sign-in link could not be verified. It may have expired or already been used. Request a new magic link.');
  }
  remember(await res.json());
  try{localStorage.removeItem('art-admin-magic-link-requested-at')}catch{}
  status('Email verified. Checking your gallery administrator access…');
  return true;
 }
 if(param('code')){
  history.replaceState({},'',location.pathname);
  throw Error('The email returned a PKCE authorization code, but this gallery login does not have a matching code verifier. Check that the Supabase Magic Link template uses {{ .ConfirmationURL }} and request a fresh link. Do not paste an authorization code here.');
 }
 // A custom Magic Link template using {{ .SiteURL }} or a hard-coded Family
 // URL only navigates to the page and never establishes an Auth session.
 if(location.hash||location.search){
  history.replaceState({},'',location.pathname);
  throw Error('The email opened the gallery without a usable Supabase login session. Check that the Magic Link email button uses {{ .ConfirmationURL }}, not {{ .SiteURL }} or a hard-coded Family URL. Then request a fresh link.');
 }
 let recentlyRequested=false;
 try{const time=Number(localStorage.getItem('art-admin-magic-link-requested-at')||0);recentlyRequested=time>0&&Date.now()-time<20*60*1000}catch{}
 if(recentlyRequested){
  try{localStorage.removeItem('art-admin-magic-link-requested-at')}catch{}
  throw Error('You returned to /admin/ after requesting a magic link, but Supabase provided no login session. No verification code is required: the email must link to {{ .ConfirmationURL }} and the gallery URL must be an allowed redirect. See the instructions below before requesting a new link.');
 }
 return false;
}
async function verifyAdmin(){
 if(!state.session)return;
 const user=await api('/auth/v1/user');
 if(!user?.id)throw Error('Supabase could not verify your identity');
 state.user=user;
 const rows=await api('/rest/v1/art_gallery_admin_users?select=user_id&user_id=eq.'+encodeURIComponent(user.id)+'&limit=1');
 state.authorized=Array.isArray(rows)&&rows.length===1;
 $('login-panel').hidden=true;$('awaiting-access').hidden=state.authorized;$('admin-panel').hidden=!state.authorized;
 $('sign-out').hidden=false;
 if(!state.authorized){$('my-user-id').textContent=user.id;status('Signed in. Account still requires gallery administrator approval.');return}
 await loadCatalogue();status('Administrator access verified. Ready for files.');
}
async function loadCatalogue(){
 const [styles,curation,works,variants]=await Promise.all([
 fetch('/assets/styles.json').then(r=>r.json()),fetch('/assets/collections.json').then(r=>r.json()),
 api('/rest/v1/art_gallery_works?select=id,title_en,description_en,style_id,collection_id,public_preview_path,public_thumb_path,legacy_thumb_url,digital_available,published,review_status&order=title_en.asc&limit=1000'),
 api('/rest/v1/art_gallery_variants?select=variant_id,primary_id,sort_order&order=primary_id.asc,sort_order.asc&limit=1000')
 ]);
 state.styles=styles;state.collections=curation.collections;state.works=works;state.variants=variants;
 for(const [element,entries] of [['collection-default',state.collections],['style-default',state.styles]]){
 const select=$(element),current=select.value;
 select.replaceChildren(new Option(element==='collection-default'?'Choose a collection…':'Choose an artistic style…',''));
 for(const entry of entries){const o=new Option(entry.name,entry.id);select.add(o)}
 if(current)select.value=current;
 }
 $('catalog-count').textContent=state.works.length;renderCatalogue();
}
function renderCatalogue(){
 const term=$('catalog-search').value.trim().toLowerCase();const matches=state.works.filter(w=>(w.title_en+' '+w.id).toLowerCase().includes(term)).slice(0,100);
 $('catalog-list').replaceChildren();
 for(const work of matches){
  const el=document.createElement('div');el.className='catalog-item';
  const src=work.public_thumb_path?publicImage(work.public_thumb_path):work.legacy_thumb_url||'';
  const link=state.variants.find(v=>v.variant_id===work.id),children=state.variants.filter(v=>v.primary_id===work.id);
  const relation=link?' · Variant of '+(state.works.find(w=>w.id===link.primary_id)?.title_en||link.primary_id):children.length?' · Main artwork · '+children.length+' variant(s)':'';
  el.innerHTML='<img alt="" loading="lazy" src="'+esc(src)+'"><span><strong>'+esc(work.title_en)+'</strong><small>'+esc(work.collection_id)+' · '+esc(work.style_id)+' · '+(work.published?'Published':'Draft')+esc(relation)+'</small></span>';
  const button=document.createElement('button');button.type='button';button.textContent='Edit category';button.addEventListener('click',()=>editWork(work));el.append(button);const variantsButton=document.createElement('button');variantsButton.type='button';variantsButton.textContent=link?'Change variant':children.length?'Manage '+children.length+' variants':'Group as variant';variantsButton.addEventListener('click',()=>manageVariant(work));el.append(variantsButton);$('catalog-list').append(el);
 }
 if(matches.length===0)$('catalog-list').textContent='No matching artworks.';
}
function isVariant(id){return state.variants.some(row=>row.variant_id===id)}
function isPrimary(id){return state.variants.some(row=>row.primary_id===id)}
function sameCollectionPrimaries(work){
 return state.works.filter(main=>main.id!==work.id&&main.collection_id===work.collection_id
  &&main.published&&!isVariant(main.id)&&!main.digital_available);
}
function manageVariant(work){
 if(!state.authorized)return;
 const current=state.variants.find(row=>row.variant_id===work.id);
 const owned=state.variants.filter(row=>row.primary_id===work.id);
 const panel=document.createElement('div');panel.className='panel variant-editor';
 const heading=document.createElement('h2');heading.textContent='Variations · '+work.title_en;
 const expl=document.createElement('p');expl.textContent='You decide which artworks belong together. The main artwork stays in the public gallery; each variation is preserved in Supabase and can be viewed when the artwork is opened.';
 panel.append(heading,expl);
 const preview=document.createElement('div');preview.className='variant-compare';
 const candidate=document.createElement('img');candidate.alt='Selected artwork: '+work.title_en;
 candidate.src=work.public_thumb_path?publicImage(work.public_thumb_path):work.legacy_thumb_url||'';
 const selectedPreview=document.createElement('img');selectedPreview.alt='Chosen main artwork';
 preview.append(candidate,selectedPreview);panel.append(preview);
 if(owned.length){
  const info=document.createElement('p');info.textContent='This is a main artwork with '+owned.length+' existing variation(s). To make it a variant, unlink those versions first.';
  panel.append(info);
  for(const child of owned){
   const childWork=state.works.find(w=>w.id===child.variant_id);
   const item=document.createElement('div');item.className='variant-owned';
   const thumb=document.createElement('img');thumb.alt='';thumb.src=childWork?.public_thumb_path?publicImage(childWork.public_thumb_path):childWork?.legacy_thumb_url||'';
   const title=document.createElement('span');title.textContent=childWork?.title_en||child.variant_id;
   const unlink=document.createElement('button');unlink.type='button';unlink.textContent='Show separately';
   unlink.addEventListener('click',async()=>{try{
    if(!confirm('Show this artwork separately in the public gallery again? Its files will be preserved.'))return;
    await api('/rest/v1/art_gallery_variants?variant_id=eq.'+encodeURIComponent(child.variant_id),{method:'DELETE',headers:{'Prefer':'return=minimal'}});
    await loadCatalogue();panel.remove();status('Artwork restored to its own gallery card.');
   }catch(e){status(e.message,true)}});
   item.append(thumb,title,unlink);panel.append(item);
  }
 }
 if(!owned.length){
  const options=sameCollectionPrimaries(work);
  const label=document.createElement('label');label.textContent='Main artwork (same collection)';
  const select=document.createElement('select');select.add(new Option('Show this artwork separately',''));
  for(const main of options)select.add(new Option(main.title_en,main.id));
  select.value=current?.primary_id||'';
  const currentLabel=document.createElement('p');currentLabel.className='subtle';
  currentLabel.textContent=current?'Currently grouped as a variation. Choose another main artwork or show separately.':'Not grouped. Choose the main artwork that should appear in the public grid.';
  const showPreview=()=>{const main=state.works.find(w=>w.id===select.value);
   selectedPreview.hidden=!main;selectedPreview.src=main?(main.public_thumb_path?publicImage(main.public_thumb_path):main.legacy_thumb_url||''):'';
  };
  select.addEventListener('change',showPreview);showPreview();label.append(select);panel.append(label,currentLabel);
  const save=document.createElement('button');save.className='primary';save.type='button';save.textContent='Save my variant choice';
  save.addEventListener('click',async()=>{
   try{
    if(select.value===current?.primary_id){panel.remove();status('Variant group unchanged.');return}
    if(!select.value&&!current){panel.remove();status('Artwork remains a separate gallery entry.');return}
    if(!confirm(select.value?'Group this artwork under the chosen main artwork? Nothing will be deleted.':'Show this artwork separately on the gallery again?'))return;
    if(select.value){
     const parent=state.works.find(w=>w.id===select.value);
     if(!parent||parent.collection_id!==work.collection_id||parent.digital_available||isVariant(parent.id))throw Error('Choose a valid stand-alone main artwork in the same collection.');
     const record={variant_id:work.id,primary_id:parent.id,sort_order:state.variants.filter(row=>row.primary_id===parent.id).length+1};
     if(current)await api('/rest/v1/art_gallery_variants?variant_id=eq.'+encodeURIComponent(work.id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({primary_id:record.primary_id,sort_order:record.sort_order})});
     else await api('/rest/v1/art_gallery_variants',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(record)});
    }else await api('/rest/v1/art_gallery_variants?variant_id=eq.'+encodeURIComponent(work.id),{method:'DELETE',headers:{'Prefer':'return=minimal'}});
    await loadCatalogue();panel.remove();status('Variant grouping saved. The gallery will display your manually selected main artwork.');
   }catch(e){status(e.message,true)}
  });panel.append(save);
 }
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Close';cancel.addEventListener('click',()=>panel.remove());panel.append(cancel);
 $('catalog-list').prepend(panel);panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function publicImage(objectPath){return cfg.url+'/storage/v1/object/public/art-previews/'+objectPath.split('/').map(encodeURIComponent).join('/')}
function editWork(work){
 const collection=$('collection-default'),style=$('style-default');collection.value=work.collection_id;style.value=work.style_id;
 if(!state.authorized)return;
 const prompt=document.createElement('div');prompt.className='panel';
 prompt.innerHTML='<h2>Edit '+esc(work.title_en)+'</h2><p>Choose the collection and artistic style above, then save below. You control both classifications.</p>';
 const title=document.createElement('input');title.value=work.title_en;title.maxLength=150;title.setAttribute('aria-label','Artwork title');prompt.append(title);
 const save=document.createElement('button');save.className='primary';save.textContent='Save title and chosen categories';save.addEventListener('click',async()=>{
  try{if(!collection.value||!style.value||!title.value.trim())throw Error('Title, collection and style are required');
   if(work.digital_available)throw Error('Existing active sale editions require a separate approved update.');
   if(work.collection_id!==collection.value&&(isVariant(work.id)||isPrimary(work.id)))throw Error('Separate this artwork from its variant group before changing its collection.');
   await api('/rest/v1/art_gallery_works?id=eq.'+encodeURIComponent(work.id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({title_en:title.value.trim(),collection_id:collection.value,style_id:style.value,source:'admin-edit'})});
   work.title_en=title.value.trim();work.collection_id=collection.value;work.style_id=style.value;prompt.remove();renderCatalogue();status('Updated '+work.title_en+'; the live gallery will use your new categories.');
  }catch(e){status(e.message,true)}
 });prompt.append(save);$('catalog-list').prepend(prompt);prompt.scrollIntoView({behavior:'smooth',block:'start'});
}
function titleFromName(name){return name.replace(/\.(png|jpe?g|webp)$/i,'').replace(/^\d{1,4}[_ -]+/,'').replace(/(?:[_ -](?:2x|retina|print|original|master|view|thumb|preview|web))+(?:[_ -]\d+x\d+)?$/ig,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().replace(/\b[a-z]/g,ch=>ch.toUpperCase()).slice(0,150)||'Untitled artwork'}
function stem(name){return slug(titleFromName(name))}
function filePriority(file,path){return (/print|retina|2x|original|master/i.test(path)?100:0)+(/\.png$/i.test(file.name)?10:0)+Math.min(file.size/10000000,10)-(/thumb|preview|web_1x/i.test(path)?80:0)}
function zipMembers(file){
 return file.arrayBuffer().then(async buf=>{
  const dv=new DataView(buf),u16=o=>dv.getUint16(o,true),u32=o=>dv.getUint32(o,true);
  let end=-1;for(let p=buf.byteLength-22;p>=Math.max(0,buf.byteLength-65557);p--)if(u32(p)===0x06054b50){end=p;break}
  if(end<0)throw Error('Not a valid ZIP archive');
  const count=u16(end+10);if(count>900)throw Error('ZIP contains too many entries; split into smaller archives.');
  if(count===65535)throw Error('ZIP64 archives are not supported; unzip locally and upload image files.');
  let pos=u32(end+16),total=0;const members=[];
  for(let i=0;i<count;i++){
   if(pos+46>dv.byteLength||u32(pos)!==0x02014b50)throw Error('ZIP directory is invalid');
   const flags=u16(pos+8),method=u16(pos+10),compressed=u32(pos+20),size=u32(pos+24),
    nameLen=u16(pos+28),extraLen=u16(pos+30),commentLen=u16(pos+32),local=u32(pos+42);
   if(pos+46+nameLen>dv.byteLength)throw Error('ZIP entry name is truncated');
   const name=new TextDecoder('utf-8').decode(new Uint8Array(buf,pos+46,nameLen));
   pos+=46+nameLen+extraLen+commentLen;
   if(name.endsWith('/')||name.includes('__MACOSX')||/\.(?:ds_store|txt|json)$/i.test(name))continue;
   if(!/\.(?:png|jpe?g|webp)$/i.test(name))continue;
   if(flags&1)throw Error('Password-protected ZIP entries are not supported');
   if(size>MAX_FILE||compressed>MAX_FILE)throw Error('Image in ZIP exceeds the 50 MB limit: '+name);
   total+=size;if(total>MAX_ITEMS*MAX_FILE)throw Error('ZIP expands to too many image bytes; split it.');
   if(local+30>dv.byteLength||u32(local)!==0x04034b50)throw Error('ZIP local entry is invalid');
   const payloadStart=local+30+u16(local+26)+u16(local+28);
   if(payloadStart+compressed>dv.byteLength)throw Error('ZIP image is incomplete');
   const source=new Blob([new Uint8Array(buf,payloadStart,compressed)]);
   let data;
   if(method===0)data=await source.arrayBuffer();
   else if(method===8){
    if(typeof DecompressionStream==='undefined')throw Error('Your browser cannot unzip this archive. Unzip it locally and upload images.');
    try{data=await new Response(source.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()}catch{throw Error('Cannot decompress this ZIP. Unzip it locally and upload images.')}
   }else throw Error('Unsupported ZIP compression method: '+method);
   if(data.byteLength!==size)throw Error('ZIP image size does not match: '+name);
   const base=name.split('/').pop();
   const extracted=new File([data],base,{type:base.toLowerCase().endsWith('.png')?'image/png':base.toLowerCase().endsWith('.webp')?'image/webp':'image/jpeg'});
   if(!validImage(extracted))throw Error('Invalid image file in ZIP: '+name);
   members.push({file:extracted,path:name});
   if(members.length>MAX_ITEMS*4)throw Error('Too many image variants. Use a smaller batch.');
  }
  return members;
 });
}
async function gather(files){
 const selected=[];for(const f of files){
  if(/\.zip$/i.test(f.name)){if(f.size>MAX_ZIP)throw Error('ZIP exceeds 250 MB: '+f.name);selected.push(...await zipMembers(f))}
  else if(validImage(f))selected.push({file:f,path:f.name});
  else throw Error('Unsupported file or image larger than 50 MB: '+f.name);
 }
 const grouped=new Map();
 for(const item of selected){const key=stem(item.file.name);if(!key)continue;const prev=grouped.get(key);if(!prev||filePriority(item.file,item.path)>filePriority(prev.file,prev.path))grouped.set(key,item)}
 if(grouped.size>MAX_ITEMS||state.queue.length+grouped.size>MAX_ITEMS)throw Error('Maximum 30 artworks per batch. Clear the queue or split your archives.');
 const collection=$('collection-default').value,style=$('style-default').value;
 for(const item of grouped.values()){
  const blobUrl=URL.createObjectURL(item.file),queueItem={...item,blobUrl,title:titleFromName(item.file.name),description:'',collection_id:collection,style_id:style,published:$('publish-default').checked,existing_id:'',price:'50',skip:false,progress:'Ready'};
  state.queue.push(queueItem);
 }
 renderQueue();status('Added '+grouped.size+' separate artwork(s) to review. Choose categories before uploading.');
}
function rowSelect(entries,value,placeholder){return '<option value="">'+esc(placeholder)+'</option>'+entries.map(e=>'<option value="'+esc(e.id)+'"'+(value===e.id?' selected':'')+'>'+esc(e.name||e.title_en)+'</option>').join('')}
function renderQueue(){
 $('review-panel').hidden=state.queue.length===0;$('queue-count').textContent=state.queue.length+' in queue';
 $('review-list').replaceChildren();const existing=$('upload-mode').value==='existing';
 for(const [i,item] of state.queue.entries()){
  const row=document.createElement('div');row.className='art-row';
  row.innerHTML='<img alt="Artwork preview" src="'+esc(item.blobUrl)+'"><div class="fields">'+
  (existing?'<label class="wide">Existing artwork (required)<select data-field="existing_id">'+rowSelect(state.works,item.existing_id,'Choose the exact artwork…')+'</select></label>':'')+
  '<label class="wide">English title<input data-field="title" maxlength="150" value="'+esc(item.title)+'" required></label>'+
  '<label>Collection<select data-field="collection_id" required>'+rowSelect(state.collections,item.collection_id,'Choose collection…')+'</select></label>'+
  '<label>Artistic style<select data-field="style_id" required>'+rowSelect(state.styles,item.style_id,'Choose style…')+'</select></label>'+
  '<label class="wide">Description (optional)<textarea data-field="description" maxlength="1200">'+esc(item.description)+'</textarea></label>'+
  '<label>Planned digital price (€)<input data-field="price" type="number" min="1" max="100000" step="1" value="'+esc(item.price)+'"></label>'+
  '<label class="check wide"><input type="checkbox" data-field="published" '+(item.published?'checked':'')+'><span>Publish gallery preview after uploading</span></label>'+
  '<div class="row-tools"><label class="check"><input type="checkbox" data-field="skip" '+(item.skip?'checked':'')+'><span>Skip this artwork</span></label><span class="row-status">'+esc(item.progress)+'</span></div></div>';
  row.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('change',()=>{const f=input.dataset.field;item[f]=input.type==='checkbox'?input.checked:input.value;if(f==='existing_id'&&item.existing_id){const match=state.works.find(a=>a.id===item.existing_id);if(match){item.title=match.title_en;item.collection_id=match.collection_id;item.style_id=match.style_id;renderQueue()}}}));
  $('review-list').append(row);item.row=row;
 }
}
async function imagePreviews(file){
 let image;try{image=await createImageBitmap(file)}catch{throw Error('Cannot decode image '+file.name)}
 const w=image.width,h=image.height;if(w<280||h<280)throw Error('Image is too small: '+file.name);
 if(w*h>125000000){image.close();throw Error('Image has too many pixels. Resize before upload: '+file.name)}
 const render=(max,quality)=>new Promise((resolve,reject)=>{
  const scale=Math.min(1,max/Math.max(w,h)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
  const ctx=canvas.getContext('2d');if(!ctx){reject(Error('Canvas unavailable'));return}
  ctx.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>blob?resolve(blob):reject(Error('WebP conversion failed')),'image/webp',quality);
 });
 try{return {w,h,view:await render(1600,.82),thumb:await render(600,.76)}}finally{image.close()}
}
async function uploadBlob(bucket,path,blob,mime){
 const response=await fetch(cfg.url+'/storage/v1/object/'+bucket+'/'+path.split('/').map(encodeURIComponent).join('/'),{
  method:'POST',headers:headers({'Content-Type':mime,'Cache-Control':bucket==='art-originals'?'private, max-age=0':'public, max-age=31536000','x-upsert':'false'}),body:blob
 });
 if(!response.ok){let body='';try{body=await response.text()}catch{}throw Error('Upload to '+bucket+' failed ('+response.status+'): '+body.slice(0,120))}
}
async function uploadOne(item){
 if(!state.authorized)throw Error('Administrator approval required');
 if(!item.collection_id||!item.style_id)throw Error('Choose the collection and style for '+item.title);
 if(!item.title.trim())throw Error('Enter an English title');
 if(!state.collections.some(c=>c.id===item.collection_id)||!state.styles.some(s=>s.id===item.style_id))throw Error('Invalid category selection');
 const mode=$('upload-mode').value,existing=mode==='existing'?state.works.find(w=>w.id===item.existing_id):null;
 if(mode==='existing'&&!existing)throw Error('Choose the exact existing artwork for '+item.title);
 if(existing?.digital_available)throw Error('This work has a sale-enabled master. Replace it through a separate approved versioning workflow.');
 if(item.file.size>MAX_FILE)throw Error('Image exceeds the 50 MB storage limit');
 const id=existing?.id||'art-'+dateId()+'-'+slug(item.title).slice(0,48)+'-'+crypto.randomUUID().slice(0,8);
 const nonce=crypto.randomUUID(),folder=id+'/'+nonce;const suffix=extensions[masterType(item.file)];
 const publicData=await imagePreviews(item.file);
 item.progress='Uploading public preview…';item.row.querySelector('.row-status').textContent=item.progress;
 await uploadBlob('art-previews',folder+'/view.webp',publicData.view,'image/webp');
 await uploadBlob('art-previews',folder+'/thumb.webp',publicData.thumb,'image/webp');
 item.progress='Uploading private master…';item.row.querySelector('.row-status').textContent=item.progress;
 await uploadBlob('art-originals',folder+'/master.'+suffix,item.file,masterType(item.file));
 const saved={title_en:item.title.trim(),description_en:item.description.trim(),style_id:item.style_id,collection_id:item.collection_id,
  orientation:publicData.w>publicData.h?'Landscape':publicData.w<publicData.h?'Portrait':'Square',
  public_preview_path:folder+'/view.webp',public_thumb_path:folder+'/thumb.webp',pixel_width:publicData.w,pixel_height:publicData.h,published:item.published};
 item.progress='Registering in catalogue…';item.row.querySelector('.row-status').textContent=item.progress;
 if(existing){
  await api('/rest/v1/art_gallery_works?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({...saved,source:'admin-upload'})});
 }else{
  const price=Number(item.price);
  if(!Number.isFinite(price)||price<1||price>100000)throw Error('Digital price must be between €1 and €100,000.');
  await api('/rest/v1/art_gallery_works',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify({
   id,...saved,price_cents:Math.round(price*100),currency:'eur',digital_available:false,review_status:'pending',source:'admin-upload'
  })});
 }
 const record={artwork_id:id,bucket_name:'art-originals',object_path:folder+'/master.'+suffix,
  file_bytes:item.file.size,pixel_width:publicData.w,pixel_height:publicData.h,source_archive:item.path};
 const current=existing?await api('/rest/v1/art_gallery_masters?select=artwork_id,verified_at&artwork_id=eq.'+encodeURIComponent(id)+'&limit=1'):null;
 if(current?.[0]?.verified_at)throw Error('Verified sale master exists; replacement requires separate QA.');
 if(current?.length)await api('/rest/v1/art_gallery_masters?artwork_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(record)});
 else await api('/rest/v1/art_gallery_masters',{method:'POST',headers:{'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(record)});
 item.progress='Complete · '+id;item.row.querySelector('.row-status').textContent=item.progress;
 return id;
}
async function uploadAll(){
 if(state.busy)return;if(!state.authorized)throw Error('Not an approved administrator');
 if(!state.queue.length)throw Error('Select images or ZIP files first.');
 if(!confirm('Upload '+state.queue.filter(item=>!item.skip).length+' artwork(s) to Supabase? Public previews will be published where selected; private masters will NOT be enabled for sale.'))return;
 state.busy=true;$('upload-all').disabled=true;$('clear-queue').disabled=true;
 let success=0,failed=0;
 try{
  for(const item of state.queue){
   if(item.skip||item.progress.startsWith('Complete'))continue;
   try{const id=await uploadOne(item);success++;status('Uploaded '+success+' artwork(s); most recent: '+id)}
   catch(error){failed++;item.progress='Error: '+error.message;item.row.querySelector('.row-status').textContent=item.progress;item.row.querySelector('.row-status').classList.add('error');status(item.progress,true)}
  }
  if(success)await loadCatalogue();
  status('Batch finished: '+success+' uploaded, '+failed+' requiring correction. Uploaded masters remain private and digital sales stay disabled.',failed>0);
 }finally{state.busy=false;$('upload-all').disabled=false;$('clear-queue').disabled=false}
}
function dropEvents(){
 const drop=$('dropzone');for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag')});
 for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag')});
 drop.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length)gather([...e.dataTransfer.files]).catch(err=>status(err.message,true))});
 $('source-files').addEventListener('change',e=>{if(e.target.files.length)gather([...e.target.files]).catch(err=>status(err.message,true));e.target.value=''});
}
function withErrors(task){return async e=>{e?.preventDefault?.();try{await task(e)}catch(err){status(err.message||String(err),true)}}}
$('login-form').addEventListener('submit',withErrors(async()=>{const email=$('email').value.trim(),password=$('password').value;if(!email||!password)throw Error('Enter your email and password, or request an email sign-in link.');await signIn(email,password)}));
$('send-link').addEventListener('click',withErrors(sendLink));
$('code-form').addEventListener('submit',withErrors(verifyCode));
$('sign-out').addEventListener('click',withErrors(async()=>{if(state.session)await fetch(cfg.url+'/auth/v1/logout',{method:'POST',headers:headers()}).catch(()=>{});sessionStorage.removeItem('art-admin-session');location.replace('/admin/')}));
$('upload-mode').addEventListener('change',()=>renderQueue());
$('collection-default').addEventListener('change',()=>{for(const item of state.queue)if(!item.existing_id)item.collection_id=$('collection-default').value;renderQueue()});
$('style-default').addEventListener('change',()=>{for(const item of state.queue)if(!item.existing_id)item.style_id=$('style-default').value;renderQueue()});
$('publish-default').addEventListener('change',()=>{for(const item of state.queue)item.published=$('publish-default').checked;renderQueue()});
$('upload-all').addEventListener('click',withErrors(uploadAll));
$('clear-queue').addEventListener('click',()=>{if(state.busy)return;for(const item of state.queue)URL.revokeObjectURL(item.blobUrl);state.queue=[];renderQueue();status('Queue cleared.')});
$('catalog-search').addEventListener('input',renderCatalogue);
dropEvents();
(async()=>{if(!cfg?.url||!cfg?.anonKey)throw Error('Missing gallery configuration');const fromLink=await acceptCallback();if(!state.session){try{state.session=JSON.parse(sessionStorage.getItem('art-admin-session')||'null')}catch{}}if(state.session)await verifyAdmin();else if(!fromLink)status('Private gallery: sign in to continue. If an email link brought you back to this login screen, see the Magic Link template help below.');})().catch(e=>status(e.message,true));
})();
