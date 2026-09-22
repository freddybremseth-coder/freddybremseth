#!/usr/bin/env python3
"""Import 50 distinct additional works from the four original or corrected public-preview ZIP packs.

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
# Accept either the original 56-work source ZIPs already in GitHub or the corrected 55-work ZIPs.
# Publish the same curated 55 works in both cases; the original duplicate never reaches public output.
if not isinstance(manifest,list) or len(manifest) not in (55,56):
    raise ValueError('Expected a 55- or 56-work source manifest')
duplicate_baroque='barokk-studie-med-musikk-og-maneskinn'
matching=[item for item in manifest if item.get('id')==duplicate_baroque]
if len(manifest)==56 and len(matching)!=1:
    raise ValueError('A 56-work pack must contain exactly the known baroque duplicate')
if len(matching)>1:
    raise ValueError('Unexpected repeated baroque duplicate')
if matching:
    manifest=[item for item in manifest if item.get('id')!=duplicate_baroque]
    for variant in ('thumb','view'):
        preview_key='assets/art/'+duplicate_baroque+'-'+variant+'.webp'
        if preview_key not in previews:
            raise ValueError('Duplicate baroque preview missing: '+preview_key)
        del previews[preview_key]
if len(manifest)!=55 or len(previews)!=110:
    raise ValueError('Expected 55 artworks and 110 previews after removing the baroque duplicate')
if duplicate_baroque in {item.get('id') for item in manifest} or any(duplicate_baroque in name for name in previews):
    raise ValueError('The duplicate baroque image must not be published')

# These five new titles are alternate names for older gallery works. Keep the
# original canonical artwork IDs, secure digital purchase references and URLs.
# Drop both public preview variants before building catalog or public/ output.
repeat_pairs={
    'impresjonistisk-hagefest-ved-innsjen':'impresjonistisk-hagefest-ved-elven',
    'romantisk-solnedgang-pa-verandaen':'melankolsk-solnedgang-ved-havet',
    'stormlys-over-det-gamle-fjordlandskapet':'vandreren-ved-det-stormfulle-fjordlandskapet',
    'modig-bykvinne-i-graffitiunivers':'modig-dronning-i-fargerik-gatekunst',
    'renessansebibliotek-med-lrde-og-solnedgang':'renessansestudie-med-symbolske-skatter',
}
if not set(repeat_pairs.values()).issubset(existing):
    raise ValueError('Do not remove duplicate variants unless all five canonical works exist in the protected catalogue')
found={item.get('id') for item in manifest}.intersection(repeat_pairs)
if found!=set(repeat_pairs):
    raise ValueError('Unexpected repeated-artwork import mapping: '+repr(sorted(found)))
manifest=[item for item in manifest if item.get('id') not in repeat_pairs]
for repeated_id in repeat_pairs:
    for variant in ('thumb','view'):
        preview_key='assets/art/'+repeated_id+'-'+variant+'.webp'
        if preview_key not in previews:
            raise ValueError('Repeated artwork preview missing: '+preview_key)
        del previews[preview_key]
if len(manifest)!=50 or len(previews)!=100:
    raise ValueError('Expected exactly 50 distinct newly imported artworks and 100 public previews')
if any(item.get('id') in repeat_pairs for item in manifest) or any(repeated_id in name for name in previews for repeated_id in repeat_pairs):
    raise ValueError('A repeated artwork variant remained in the public import')

# Most imported titles were written in English-style title case. Normalize to
# Norwegian sentence-style capitalization; do not lower-case proper names.
manual_titles={
    'middelhavscollage-med-olivengreiner-og-terrakottav':'Middelhavscollage med olivengreiner og terrakotta',
    'kintsugi-maskens-gyldne-hemmelighet':'Kintsugi-maskens gyldne hemmelighet',
    'signert-botanisk-art-deco-collage':'Signert botanisk art deco-collage',
    'wabi-sabi-moon':'Wabi-sabi moon',
    'manen-treet-og-den-gylne-reden':'Månen, treet og den gylne reden',
    'maneskinn-flammer-og-frigjorte-fugler':'Måneskinn, flammer og frigjorte fugler',
}
proper_names={'Mediterranean'}
for item in manifest:
    title=item.get('title')
    if not isinstance(title,str) or not title.strip():
        raise ValueError('Missing artwork title '+str(item.get('id')))
    if item['id'] in manual_titles:
        item['title']=manual_titles[item['id']]
    else:
        parts=title.strip().split()
        item['title']=' '.join([parts[0]]+[word if word in proper_names else word[0].lower()+word[1:] for word in parts[1:]])
    for word in item['title'].split()[1:]:
        plain=word.strip('.,:;!?–—()[]')
        if plain and plain[0].isupper() and plain not in proper_names:
            raise ValueError('Unexpected uppercase in title '+str(item['title']))
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
    collections['byArtworkId'].setdefault(id,item['collection_id'])  # preserve audited collection overrides

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
