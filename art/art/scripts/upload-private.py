#!/usr/bin/env python3
"""One-time, local private Supabase Storage upload from the six previously supplied print ZIPs.

Reads originals in memory one at a time. Never writes customer-ready master files into
web assets, GitHub, or this deployable project directory. Standard-library only.
"""
import argparse,json,mimetypes,os,sys,urllib.parse,urllib.request,urllib.error,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MASTERS=json.loads((ROOT/'scripts/private-masters-manifest.json').read_text())
parser=argparse.ArgumentParser(description='Upload artwork masters to a PRIVATE Supabase Storage bucket')
parser.add_argument('--archive-dir',type=Path,required=True,help='Folder with Freddy_Bremseth_*_PRINT.zip files')
parser.add_argument('--extras-dir',type=Path,help='Folder containing non-archived source PNGs')
parser.add_argument('--dry-run',action='store_true',help='Validate all local source files without credentials or uploading')
parser.add_argument('--limit',type=int,default=0,help='Upload at most N works, for testing')
args=parser.parse_args()

missing=[];bundles={}
for m in MASTERS:
 if m['archive']:
  f=args.archive_dir/m['archive']
  if not f.is_file():missing.append(str(f));continue
  if f not in bundles:bundles[f]=zipfile.ZipFile(f)
  if m['entry'] not in bundles[f].namelist():missing.append(f'{f} :: {m["entry"]}')
 else:
  folder=args.extras_dir or args.archive_dir
  if not (folder/m['entry']).is_file():missing.append(str(folder/m['entry']))
if missing:
 print('MISSING PRIVATE SOURCES:');print('\n'.join('  '+s for s in missing));sys.exit(2)
print(f'Validated {len(MASTERS)} original sources in {len(bundles)} ZIP archives and extra files.')
if args.dry_run:sys.exit(0)
url=os.environ.get('SUPABASE_URL','').rstrip('/');key=os.environ.get('SUPABASE_SERVICE_ROLE_KEY','');bucket=os.environ.get('ART_STORAGE_BUCKET','art-originals')
if not(url.startswith('https://') and key):sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables. Never paste them in chat or code.')
headers={'apikey':key,'Authorization':'Bearer '+key}
try:
 req=urllib.request.Request(url+'/storage/v1/bucket/'+urllib.parse.quote(bucket,safe=''),headers=headers)
 with urllib.request.urlopen(req,timeout=30) as r:info=json.load(r)
 if info.get('public') is not False:sys.exit('ABORT: Storage bucket must exist and be PRIVATE before uploading.')
except urllib.error.HTTPError as e:sys.exit(f'Cannot verify bucket {bucket}: HTTP {e.code}. Create a PRIVATE bucket first.')

uploaded=0;skipped=0
for m in MASTERS[:args.limit if args.limit>0 else None]:
 if m['archive']:payload=bundles[args.archive_dir/m['archive']].read(m['entry'])
 else:payload=(args.extras_dir or args.archive_dir).joinpath(m['entry']).read_bytes()
 dest=url+'/storage/v1/object/'+urllib.parse.quote(bucket,safe='')+'/'+urllib.parse.quote(m['storage_path'],safe='/')
 h={**headers,'Content-Type':'image/jpeg' if m['storage_path'].endswith('.jpg') else 'image/png','Cache-Control':'private, max-age=0','x-upsert':'false'}
 req=urllib.request.Request(dest,data=payload,headers=h,method='POST')
 try:
  with urllib.request.urlopen(req,timeout=180) as r:r.read()
  uploaded+=1
 except urllib.error.HTTPError as e:
  if e.code in (400,409):
   try:error=json.loads(e.read().decode('utf-8'))
   except:error={}
   if str(error.get('statusCode',''))=='409' or error.get('error')=='Duplicate' or 'already exists' in str(error.get('message','')).lower():skipped+=1;continue
  print(f'FAILED {m["id"]}: HTTP {e.code}',file=sys.stderr);sys.exit(3)
 print(f'{uploaded:03d} / {len(MASTERS)}  {m["id"]}  ({len(payload)//1024} KiB)')
print(f'COMPLETE: {uploaded} uploaded, {skipped} already existed, {len(MASTERS)} total artworks.')
