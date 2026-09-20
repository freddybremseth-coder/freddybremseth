#!/usr/bin/env python3
"""Upload the 63 established + ten Kintsugi private art masters to Supabase.

Run locally on a trusted computer with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
in the process environment (never in GitHub, a ZIP, a browser, or ChatGPT).
Only the private art-originals bucket is written. Does not enable checkout.
"""
import argparse
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
LEGACY=json.loads((ROOT/'scripts/private-masters-manifest.json').read_text(encoding='utf8'))
SLUGS=['the-golden-man','autumn-queen','moon-phases','child-of-the-sea','the-wise-woman','spring-goddess','winter-frost','phoenix','mother-and-child','the-golden-heart']
parser=argparse.ArgumentParser(description='Private Freddy Bremseth Art Supabase archive importer')
parser.add_argument('--archive-dir',type=Path,help='Folder containing the six established PRINT ZIP archives')
parser.add_argument('--extras-dir',type=Path,help='Folder containing any extra legacy PNG sources')
parser.add_argument('--kintsugi-zip',type=Path,help='Freddy_Bremseth_Kintsugi_Collection_10_Retina.zip or COMPLETE.zip')
parser.add_argument('--scope',choices=['all','established','kintsugi'],default='all')
parser.add_argument('--dry-run',action='store_true',help='Validate archive contents without credentials or uploads')
parser.add_argument('--limit',type=int,default=0,help='Process only the first N masters')
args=parser.parse_args()

if args.scope in ('all','established') and not args.archive_dir:
 parser.error('--archive-dir is required for established masters')
if args.scope in ('all','kintsugi') and not args.kintsugi_zip:
 parser.error('--kintsugi-zip is required for Kintsugi masters')
if args.limit<0:parser.error('--limit cannot be negative')

archives={}
sources=[]
try:
 if args.scope in ('all','established'):
  for m in LEGACY:
   if m['archive']:
    name=args.archive_dir/m['archive']
    if name not in archives:archives[name]=zipfile.ZipFile(name)
    if m['entry'] not in archives[name].namelist():raise FileNotFoundError(str(name)+' :: '+m['entry'])
    entry=m['entry']
   else:
    name=(args.extras_dir or args.archive_dir)/m['entry']
    if not name.is_file():raise FileNotFoundError(str(name))
    entry=None
   sources.append({'id':m['id'],'archive':name,'entry':entry,
     'object_path':m['storage_path'],'width':m.get('width'),'height':m.get('height')})
 if args.scope in ('all','kintsugi'):
  z=args.kintsugi_zip
  if z not in archives:archives[z]=zipfile.ZipFile(z)
  for n,slug in enumerate(SLUGS,1):
   tail='/retina_2x_jpg/'+f'{n:02d}_{slug}_2x.jpg'
   found=[x for x in archives[z].namelist() if ('/'+x).endswith(tail)]
   if len(found)!=1:raise FileNotFoundError(str(z)+' :: expected one '+tail)
   sources.append({'id':'kintsugi-2026-'+slug,'archive':z,'entry':found[0],
    'object_path':'kintsugi-2026-'+slug+'.jpg','width':2244,'height':2804})
except (OSError,zipfile.BadZipFile) as e:
 sys.exit('Archive validation failed: '+str(e))

if len({s['id'] for s in sources})!=len(sources):sys.exit('Duplicate art IDs in source set')
print('Validated source entries:',len(sources),'(no customer-ready files were put in GitHub).')
if args.dry_run:sys.exit(0)
if args.limit:sources=sources[:args.limit]

url=os.environ.get('SUPABASE_URL','').rstrip('/')
key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY','')
if not url.startswith('https://') or not key:sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY locally. Do not publish the key.')
bucket='art-originals'
auth={'apikey':key,'Authorization':'Bearer '+key}

def request(path,method='GET',payload=None,content_type=None,headers=None):
 h={**auth,**(headers or {})}
 if content_type:h['Content-Type']=content_type
 req=urllib.request.Request(url+path,data=payload,headers=h,method=method)
 try:
  with urllib.request.urlopen(req,timeout=180) as response:return response.status,response.read()
 except urllib.error.HTTPError as e:
  return e.code,e.read()

status,raw=request('/storage/v1/bucket/'+bucket)
if status!=200:sys.exit('Cannot access private bucket: HTTP '+str(status))
if json.loads(raw.decode('utf-8')).get('public') is not False:
 sys.exit('ABORT: The art-originals bucket is PUBLIC')

uploaded=already=verified=0
for i,source in enumerate(sources,1):
 payload=(archives[source['archive']].read(source['entry']) if source['entry'] is not None else source['archive'].read_bytes())
 digest=hashlib.sha256(payload).hexdigest()
 escaped=urllib.parse.quote(source['object_path'],safe='/')
 object_url='/storage/v1/object/authenticated/'+bucket+'/'+escaped
 status,remote=request(object_url)
 if status==404:
  content_type='image/png' if source['object_path'].endswith('.png') else 'image/jpeg'
  post_status,post_response=request('/storage/v1/object/'+bucket+'/'+escaped,
      method='POST',payload=payload,content_type=content_type,
      headers={'Cache-Control':'private, max-age=0','x-upsert':'false'})
  if post_status not in (200,201):
   raise RuntimeError('Upload failed for '+source['id']+' (HTTP '+str(post_status)+')')
  uploaded+=1
 elif status==200:already+=1
 else:raise RuntimeError('Existing file check failed for '+source['id']+' (HTTP '+str(status)+')')
 # Verify the actual stored bytes, not merely that an object with the same name exists.
 check_status,check_bytes=request(object_url)
 if check_status!=200 or hashlib.sha256(check_bytes).hexdigest()!=digest:
  raise RuntimeError('Private stored file checksum does not match local source for '+source['id'])
 patch_payload=json.dumps({
  'sha256':digest,'file_bytes':len(payload),
  'pixel_width':source['width'],'pixel_height':source['height'],
  'verified_at':dt.datetime.now(dt.timezone.utc).isoformat(),
  'source_archive':source['archive'].name
 }).encode('utf8')
 endpoint='/rest/v1/art_gallery_masters?artwork_id=eq.'+urllib.parse.quote(source['id'],safe='')
 update_status,updated=request(endpoint,method='PATCH',payload=patch_payload,content_type='application/json',
     headers={'Prefer':'return=representation'})
 if update_status not in (200,201) or not json.loads(updated.decode('utf8')):
  raise RuntimeError('Storage object verified, but catalogue registry update failed for '+source['id'])
 verified+=1
 print(f'{i:03d}/{len(sources):03d} VERIFIED {source["id"]} ({len(payload)//1024} KiB)')
print(f'COMPLETE: {uploaded} new uploads, {already} existing copies checked, {verified} verified master records.')
print('Digital checkout remains disabled until sale-specific QA and explicit enablement.')
