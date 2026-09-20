#!/usr/bin/env python3
"""Import 56 approved public-only WebP previews from four small GitHub ZIP packs.

Place all four gallery_web_part_N_of_4.zip archives in art/import-packs/.
If none or only some exist, the existing gallery is left unchanged.
Never unpack original/print masters into the public Vercel directory or GitHub.
"""
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PACKS=[ROOT/'import-packs'/f'gallery_web_part_{n}_of_4.zip' for n in range(1,5)]
present=[p.exists() for p in PACKS]
if not all(present):
    print('ART_IMPORT_WAITING_FOR_PACKS',sum(present),'of 4; existing catalogue unchanged')
    raise SystemExit(0)

def read_json(path):
    return json.loads(path.read_text(encoding='utf8'))

catalog_path=ROOT/'assets/catalog.json'
collections_path=ROOT/'assets/collections.json'
styles=read_json(ROOT/'assets/styles.json')
catalog=read_json(catalog_path)
collections=read_json(collections_path)
style_by_id={s['id']:s for s in styles}
collection_ids={c['id'] for c in collections['collections']}
existing={a['id'] for a in catalog}
manifest=None
previews={}
for n,pack in enumerate(PACKS):
    with zipfile.ZipFile(pack) as z:
        for name in z.namelist():
            if n==0 and name=='new-import-manifest.json':
                manifest=json.loads(z.read(name).decode('utf8'))
                continue
            if not re.fullmatch(r'assets/art/[a-z0-9-]+-(?:thumb|view)\.webp',name):
                raise ValueError('Unexpected path in import ZIP: '+name)
            if name in previews: raise ValueError('Duplicate preview path '+name)
            info=z.getinfo(name)
            if info.file_size>4_000_000:raise ValueError('Oversized public preview '+name)
            binary=z.read(name)
            if binary[:4]!=b'RIFF' or binary[8:12]!=b'WEBP':
                raise ValueError('Invalid WebP '+name)
            previews[name]=binary
if not isinstance(manifest,list) or len(manifest)!=56:
    raise ValueError('Expected exactly 56 approved artworks in import manifest')
ids=[a['id'] for a in manifest]
if len(set(ids))!=len(ids):raise ValueError('Duplicate artwork IDs')
expected=set()
for item in manifest:
    id=item['id']
    if not re.fullmatch('[a-z0-9-]+',id):raise ValueError('Invalid artwork id '+id)
    if item['style_id'] not in style_by_id:raise ValueError('Unknown art style '+id)
    if item['collection_id'] not in collection_ids:raise ValueError('Unknown collection '+id)
    if item.get('digital_available') is not False:raise ValueError('New artwork must not be advertised as a paid digital download')
    for kind in ('view','thumb'):
        key='assets/art/'+id+'-'+kind+'.webp'
        expected.add(key)
        if key not in previews:raise ValueError('Missing public preview '+key)
        sha=hashlib.sha256(previews[key]).hexdigest()
        if sha!=item[kind+'_sha256']:raise ValueError('Preview checksum mismatch '+key)
if set(previews)!=expected:raise ValueError('Unrecognized preview files in import packs')
if any(id in existing for id in ids):
    # Treat the importer as idempotent when a previous build already appended all new records.
    if not all(id in existing for id in ids):raise ValueError('Only part of the import is already in catalogue')
    print('ART_IMPORT_ALREADY_PRESENT',len(ids))
    raise SystemExit(0)

collection_by_id={c['id']:c for c in collections['collections']}
next_number=max(a['number'] for a in catalog)+1
new_records=[]
for item in manifest:
    id=item['id'];style=style_by_id[item['style_id']]
    thematic=collection_by_id[item['collection_id']]
    new_records.append({
        'id':id,'title':item['title'],'category':style['name'],
        'story':'A digitally created artwork from the '+thematic['name']+' collection. '+thematic['description'],
        'image':item['image'],'thumb':item['thumb'],
        'orientation':item['orientation'],'width':item['width'],'height':item['height'],
        'number':next_number,'edition':'Gallery preview — edition not yet available',
        'price_cents':None,'currency':'eur','print_url':'',
        'style_id':style['id'],'style_description':style['description'],
        'digital_available':False
    })
    next_number+=1
    collections['byArtworkId'][id]=item['collection_id']

# All validation completes before any file is written.
for name,binary in previews.items():
    target=ROOT/name
    if target.exists():
        if target.read_bytes()!=binary:raise ValueError('Existing preview differs: '+name)
    else:
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(binary)
(ROOT/'assets/new-import-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
catalog_path.write_text(json.dumps(catalog+new_records,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
collections_path.write_text(json.dumps(collections,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('ART_IMPORT_ADDED',len(new_records),'TOTAL',len(catalog)+len(new_records),
      'PUBLIC_PREVIEWS',len(previews),'PRIVATE_MASTER_FILES_PUBLISHED',0)
