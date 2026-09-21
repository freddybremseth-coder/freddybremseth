#!/usr/bin/env python3
"""Curated visual-style assignment, separate from subject matter or symbolism."""
from pathlib import Path
from collections import Counter
import json
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'assets/catalog.json').read_text(encoding='utf8'))
styles=[
 {'id':'renaissance-baroque','name':'Renaissance & Baroque','description':'Chiaroscuro, layered glazes, historical interiors and carefully composed figurative scenes.'},
 {'id':'impressionism','name':'Impressionism & Post-Impressionism','description':'Visible brushwork, luminous atmosphere and painterly interpretations of landscape and light.'},
 {'id':'art-nouveau','name':'Art Nouveau','description':'Flowing line, botanical ornament and decorative compositions inspired by turn-of-the-century design.'},
 {'id':'cubism','name':'Cubism & Geometric Art','description':'Fragmented viewpoints, interlocking planes and expressive geometric structure.'},
 {'id':'abstract','name':'Abstract & Minimalist','description':'Colour fields, material texture and distilled forms that create space for personal interpretation.'},
 {'id':'expressionism','name':'Expressionism','description':'Gesture, vivid contrast and energetic marks used to heighten emotional intensity.'},
 {'id':'street-art','name':'Street Art & Pop','description':'Layered paint, urban imagery and graphic collage with contemporary social references.'},
 {'id':'symbolic-street-art','name':'Symbolic Street Art','description':'Emotion-led art combining realistic symbolism, expressive graffiti, layered urban textures and pop-art colour.'},
 {'id':'surrealism','name':'Surrealism & Dreamscapes','description':'Impossible architecture, thresholds and otherworldly scenes that follow the logic of dreams.'},
 {'id':'symbolic-realism','name':'Symbolic Realism','description':'Detailed figurative imagery where objects, gestures and contrasts suggest meanings beyond the visible.'},
 {'id':'conceptual','name':'Contemporary Conceptual','description':'Digital-era imagery that explores identity, technology, consumerism and modern social pressures.'},
 {'id':'landscape','name':'Atmospheric Landscapes','description':'Places shaped by weather, horizon and silence, from coastal light to mountain distance.'},
]
byid={s['id']:s for s in styles}
assign={}
def setid(style, ids):
 for id in ids.split():
  if id in assign: raise ValueError('Duplicate '+id)
  assign[id]=style
setid('renaissance-baroque','''barokk-kabinett-med-lesende-kvinne barokk-studie-med-musiker-og-vanitas-stilleben barokkstudie-med-violin-og-vanitas kvinne-med-granateple-ved-vinduet renessanse-ved-vinduet-med-pomegranate renessansestudie-med-symbolske-skatter''')
setid('impressionism','''impresjonistisk-hagefest-ved-elven morgenlys-ved-italiensk-innsjterrasse soloppgang-pa-den-blomstrende-terrassen terrasse-i-solnedgang-ved-havet stjernekveld-over-kystlandsbyen stjernekveld-over-landsbyen-ved-vannet''')
setid('art-nouveau','''art-nouveau-dronning-med-iris-og-svaner art-nouveau-med-svaner-og-iris''')
setid('cubism','''kafe-i-kubistiske-minner kubistisk-kafe-med-drmmende-utsikt kubistisk-kafescene-med-gitar-og-stilleben kubistisk-kvinne-i-byens-stille-rom''')
setid('abstract','''abstrakt-portal-i-jordtoner abstrakt-solnedgang-over-mykt-hav gylden-sol-over-stille-hav skulpturelt-landskap-i-gulltoner teksturert-landskap-med-sedimentre-lag terrakottasolen-over-det-bla-landskapet''')
setid('expressionism','''abstrakt-maleri-med-ansikter-og-ravner ekspressiv-kvinne-i-fargerik-malerstorm stormfylt-abstrakt-skikkelse''')
setid('street-art','''gater-hap-og-kronede-drmmer graffitikvinne-med-byens-drmmer kaotisk-graffitiportrett-med-kroner-og-hap kaotisk-skjnnhet-i-graffitiportrett kronet-graffitihelt-i-byens-hap''')
setid('symbolic-street-art','''fargerikt-portrett-av-motstandskraft kongelig-gatekunst-hap-smerte-og-kjrlighet modig-dronning-i-fargerik-gatekunst''')
setid('surrealism','''den-himmelske-trappen-til-manen drmmenes-landskap-med-flytende-drer drmmenes-apne-drer drmmestigen-mot-manens-portal drmmestigen-til-maneportalen drmmetrappen-mot-manen drmmetrappen-til-manen drer-mot-nye-horisonter en-katedral-for-utbrente-drmmer forgylt-taushet-i-en-knust-katedral kunnskapens-katedral-ved-solnedgang manenymfen-ved-innsjen maneskinnets-fortryllede-blomstersti manetrappen-til-en-lysere-deg portalen-av-gyllent-lys portalen-mellom-to-verdener portalen-mot-det-gylne-lyset trappen-mot-manens-dr edition-02-maneporten edition-09-doren-til-frihet edition-11-den-skulte-doren''')
setid('conceptual','''applausens-tomme-fest barn-av-algoritmen-drmmer-i-gull barn-av-algoritmen-i-neonbyen en-roligere-lysere-verden fortsatt-nok-i-det-gylne-tempelet kosmisk-hjerte-i-neonbyen paradis-med-plastens-skjulte-spor paradis-over-plast-freddys-dystre-vannlinje speilbildet-bak-applausen speilsalens-tomme-festning edition-14-mot-og-instinkt''')
setid('landscape','''melankolsk-solnedgang-ved-havet maneportalen-ved-fjordvannet vandreren-ved-det-stormfulle-fjordlandskapet''')
# All remaining entries are primarily detailed, symbol-driven figurative compositions.
setid('symbolic-realism','''botanisk-drm-i-gull-og-grnt dd-og-liv-ved-tidens-timeglass forgylt-glasshjerte-med-blomster frihet-over-lenker-under-vann gudinne-mellom-paradis-og-forurenset-hav gull-ravner-og-gyldne-kartveier gullforgylt-nestenkyss-ved-hvite-blomster gylden-pakt-mellom-kvinne-og-leopard gyllenblomstrende-naturgudinne kart-over-minner-og-ruiner kintsugi-delt-kvinneportrett-i-gull-og-svart kintsugi-kyss-i-gull-og-marmor kjeder-under-solnedgangen knust-glasshjerte-med-gyldne-blomster marmorbyste-med-gullsprekker-og-sommerfugl stillhetens-blomstrende-opprr stillhetens-gyldne-sannhet strre-ting-samme-horisonter tidens-timeglass-ved-solnedgang edition-01-to-ansikter-en-skjebne edition-03-lyset-i-brystet edition-04-doden-og-livet edition-05-to-sider-av-verden edition-06-to-sider-av-meg edition-07-under-overflaten edition-08-hjertet-som-gror edition-10-sommerfuglens-forvandling edition-12-frihet-under-overflaten edition-13-et-hjerte-med-hap edition-15-tiden-vi-har''')
# Approved new artwork mappings are available only after all four public preview packs are imported.
# They do not replace the hand-curated assignments of the original 63 artworks.
new_import_path=root/'assets/new-import-manifest.json'
if new_import_path.exists():
 for entry in json.loads(new_import_path.read_text(encoding='utf8')):
  new_id=entry['id'];new_style=entry['style_id']
  if new_id in {a['id'] for a in catalog} and new_id not in assign:
   if new_style not in byid:raise ValueError('Unknown approved new style: '+new_style)
   assign[new_id]=new_style
# The ten individual Kintsugi works are explicitly approved for Symbolic Realism.
kintsugi_manifest=root/'assets/kintsugi-import-manifest.json'
if kintsugi_manifest.exists():
 for entry in json.loads(kintsugi_manifest.read_text(encoding='utf8')):
  if entry['style_id']!='symbolic-realism':raise ValueError('Unexpected Kintsugi style')
  if entry['id'] in {a['id'] for a in catalog} and entry['id'] not in assign:
   assign[entry['id']]='symbolic-realism'
actual={a['id'] for a in catalog}
missing=actual-set(assign)
extra=set(assign)-actual
if missing:
 raise ValueError(f'Curated style ID mismatch: missing={sorted(missing)}')
# Historical style assignments for excluded variants are retained for traceability.
for a in catalog:
 style=byid[assign[a['id']]]
 a['style_id']=style['id'];a['category']=style['name'];a['style_description']=style['description']
# Stable original numbering and filenames remain unchanged. Store curated order in separate style manifest.
(root/'assets/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
for s in styles:
 s['count']=sum(a['style_id']==s['id'] for a in catalog)
 s['cover']=next(a['thumb'] for a in catalog if a['style_id']==s['id'])
(root/'assets/styles.json').write_text(json.dumps(styles,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('CURATED_WORKS',len(catalog),'STYLE_GROUPS',len(styles))
for s in styles:print(s['id'],s['count'])
