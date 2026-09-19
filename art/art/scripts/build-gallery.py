#!/usr/bin/env python3
"""Create public, low-resolution gallery images and a manifest of private masters.
Private masters are NEVER placed under assets/ or in this deployable bundle.
"""
from __future__ import annotations
import csv, glob, json, os, re, unicodedata, zipfile
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path(os.environ.get('ART_SOURCE_DIR','/mnt/data'))
DEST=ROOT/'assets'/'art'
DEST.mkdir(parents=True,exist_ok=True)
ARCHIVES={p.name:p for p in SOURCE.glob('Freddy_Bremseth_HELE_SAMLINGEN_del_*_PRINT.zip')}
archive_map={}
for archive,p in sorted(ARCHIVES.items()):
 with zipfile.ZipFile(p) as z:
  rdr=csv.DictReader(z.read('FILOVERSIKT.csv').decode('utf-8-sig').splitlines())
  for entry in rdr:
   if 'kunstverk/'+entry['printfil'] in z.namelist():
    archive_map[entry['original']]={'archive':archive,'entry':'kunstverk/'+entry['printfil'],'width':int(entry['bredde_px']),'height':int(entry['hoyde_px'])}

ALIASES={
 '01_To_ansikter_en_skjebne':'Two Faces, One Destiny', '02_Maneporten':'The Moon Gate',
 '03_Lyset_i_brystet':'Light Within', '04_Doden_og_livet':'Life and Mortality',
 '05_To_sider_av_verden':'Two Worlds', '06_To_sider_av_meg':'Two Sides of Me',
 '07_Under_overflaten':'Beneath the Surface','08_Hjertet_som_gror':'The Heart That Grows',
 '09_Doren_til_frihet':'The Door to Freedom','10_Sommerfuglens_forvandling':'Metamorphosis',
 '11_Den_skulte_doren':'The Hidden Door','12_Frihet_under_overflaten':'Freedom Below',
 '13_Et_hjerte_med_hap':'A Heart of Hope','14_Mot_og_instinkt':'Courage and Instinct',
 '15_Tiden_vi_har':'The Time We Have',
}
SPECIAL_EXCLUDE={'imagegen.png'}
COLLECTIONS=['Symbolism','Surrealism','Abstract','Contemporary','Landscape','Classical']

def slugify(x):
 x=unicodedata.normalize('NFKD',x).encode('ascii','ignore').decode().lower().replace('_','-')
 return re.sub('-+','-',re.sub('[^a-z0-9]+','-',x)).strip('-')

def human(x):
 x=x.replace('_',' ').replace('-', ' ')
 return x[0].upper()+x[1:] if x else x

def categorise(filename):
 s=filename.lower()
 if any(a in s for a in ('kubist','abstrakt','tekstur','solnedgang_over_mykt','terrakott','sol_over_stille','skulpturelt')):return 'Abstract'
 if any(a in s for a in ('terrasse','kystlandsby','fjord','havet','soloppgang','stjernekveld','landskap','landskape','vandrer')):return 'Landscape'
 if any(a in s for a in ('renessanse','barokk','art_nouveau','studie_med','granateple')):return 'Classical'
 if any(a in s for a in ('graffiti','gatekunst','algoritm','neon','dronning','portrett')):return 'Contemporary'
 if any(a in s for a in ('måne','drømm','dør','portal','stigen','trappen','fantasi','katedral')):return 'Surrealism'
 return 'Symbolism'

def story(category):
 return {
 'Symbolism':'An invitation to read beyond the visible: the contrasts, fractures and quiet details hold more than one interpretation.',
 'Surrealism':'An imagined threshold between the familiar and the impossible, where the viewer completes the story.',
 'Abstract':'Colour, texture and space carry the emotion here; the meaning shifts with distance and light.',
 'Contemporary':'A contemporary visual conversation about identity, presence and the contradictions of everyday life.',
 'Landscape':'A place to look again: a landscape can be both a destination and a state of mind.',
 'Classical':'A new digital composition exploring historical painterly techniques, light, atmosphere and visual symbolism.'
 }[category]

# Use source PNGs for previews. Each is included as a separate original composition/variant.
paths=sorted(p for p in SOURCE.glob('*.png') if p.name not in SPECIAL_EXCLUDE and not p.name.startswith('a_wide_'))
records=[]
for p in paths:
 stem=p.stem
 records.append({'source':str(p),'source_filename':p.name,'title':human(stem),'slug':slugify(stem),'priv':archive_map.get(p.name),'type':'Original composition'})
# The 15 works previously extracted from panorama are distinct compositions; include all as 15 individual entries.
legacy=SOURCE/'Freddy_Bremseth_15_individuelle_verk'
for p in sorted(legacy.glob('*.jpg')):
 key=p.name.split('_Freddy_Bremseth_PRINT')[0]
 records.append({'source':str(p),'source_filename':p.name,'title':ALIASES.get(key,human(key)),'slug':'edition-'+slugify(key),'priv':{'local':str(p),'archive':'Freddy_Bremseth_15_verk_signert_oppskalert.zip','entry':p.name},'type':'Individual gallery study'})

# The separate remastered collection of 10 has signed masters and is the preferred private version for those named artworks.
remap={
 'kvinne_med_granateple_ved_vinduet.png': '01_',
 'barokkstudie_med_violin_og_vanitas.png':'02_',
 'morgenlys_ved_italiensk_innsjøterrasse.png':'03_',
 'stjernekveld_over_kystlandsbyen.png':'04_',
 'kubistisk_kaféscene_med_gitar_og_stilleben.png':'05_',
 'drømmenes_åpne_dører.png':'06_',
 'ekspressiv_kvinne_i_fargerik_malerstorm.png':'07_',
 'gylden_sol_over_stille_hav.png':'08_',
 'art_nouveau_dronning_med_iris_og_svaner.png':'09_',
 'kongelig_gatekunst_håp_smerte_og_kjærlighet.png':'10_',
}
for record in records:
 fn=record['source_filename']
 if fn in remap:
  files=list((SOURCE/'Freddy_Bremseth_10_kunstverk_PRINT_6000x7500').glob(remap[fn]+'*.jpg'))
  if files:
   f=files[0]
   record['priv']={'archive':'Freddy_Bremseth_10_kunstverk_PRINT_6000x7500.zip','entry':f.name,'width':6000,'height':7500}

# Ensure slug uniqueness, generated previews are NOT full purchased downloads.
seen=set()
for r in records:
 slug=r['slug']; count=1
 while slug in seen:
  count+=1;slug=r['slug']+'-'+str(count)
 r['slug']=slug;seen.add(slug)

out=[];private=[]
for no,r in enumerate(records,1):
 with Image.open(r['source']) as source_image:
  image=ImageOps.exif_transpose(source_image).convert('RGB')
  w,h=image.size
  for variant,edge,quality in [('thumb',640,76),('view',1480,84)]:
   public=image.copy()
   public.thumbnail((edge,edge),Image.Resampling.LANCZOS)
   public.save(DEST/f"{r['slug']}-{variant}.webp",format='WEBP',quality=quality,method=5)
 cat=categorise(r['source_filename'])
 art={'id':r['slug'],'title':r['title'],'category':cat,'story':story(cat),'image':'/assets/art/'+r['slug']+'-view.webp','thumb':'/assets/art/'+r['slug']+'-thumb.webp','orientation':'Landscape' if w>h else 'Portrait','width':w,'height':h,'number':no,'edition':r['type'],'price_cents':5000,'currency':'eur','print_url':''}
 out.append(art)
 pp=r['priv']
 if pp:
  priv={'id':r['slug'],'archive':pp['archive'],'entry':pp['entry'],'storage_path':r['slug']+'.jpg','width':pp.get('width'),'height':pp.get('height'),'kind':'signed-print-master'}
 else:
  priv={'id':r['slug'],'archive':None,'entry':r['source_filename'],'storage_path':r['slug']+'.png','width':w,'height':h,'kind':'png-original-no-print-master'}
 private.append(priv)

(ROOT/'assets'/'catalog.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'scripts'/'private-masters-manifest.json').write_text(json.dumps(private,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'GALLERY_COUNT={len(out)}')
print('CATEGORIES='+str({k:sum(a['category']==k for a in out) for k in COLLECTIONS}))
print('PRIVATE_SOURCE_MISSING='+str(sum(p['archive'] is None for p in private)))
# A subsequent build must always re-apply the visual-style curation.
# Unknown newly added works deliberately fail until they have been reviewed.
import subprocess, sys
subprocess.run([sys.executable,str(ROOT/'scripts'/'curate-styles.py')],check=True)
