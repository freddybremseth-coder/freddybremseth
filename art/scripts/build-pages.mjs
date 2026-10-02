import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/catalog.json'),'utf8'));
const curatedVariantIds=new Set(JSON.parse(fs.readFileSync(path.join(root,'assets/curated-variants.json'),'utf8')).map(row=>row.variant_id));
let template=fs.readFileSync(path.join(root,'index.html'),'utf8');
// The homepage and SEO metadata reflect the actual build-time catalogue, including imported previews.
template=template.replace(/Explore \d+ digital artworks/,`Explore ${catalog.length} digital artworks`).replace(/collection of \d+ visual stories/,`collection of ${catalog.length} visual stories`).replace(/id="art-count">\d+<\/strong>/,`id="art-count">${catalog.length}</strong>`).replace(/id="end-number">\d+<\/span>/,`id="end-number">${catalog.length}</span>`);
fs.writeFileSync(path.join(root,'index.html'),template);
const domain='https://art.freddybremseth.com';
const encode=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const curation=JSON.parse(fs.readFileSync(path.join(root,'assets/collections.json'),'utf8'));
const collectionFor=art=>art.collection_id||curation.byArtworkId[art.id]||curation.byStyle[art.style_id];
const collectionById=new Map(curation.collections.map(collection=>[collection.id,collection]));

const artworkNavHeader='<header class="site-header"><a class="brand" href="/" aria-label="Freddy Bremseth Art — home"><span class="brand-symbol">FB<span class="brand-star">✳</span></span><span class="brand-name">FREDDY BREMSETH <small>ART STUDIO &amp; GALLERY</small></span></a><nav aria-label="Main navigation"><a href="/#collections-featured">Collections</a><a href="/#collection">All artworks</a><a href="/shop/">Shop</a><a href="/#approach">The artist</a><a href="/#collect">Collect art</a></nav><div class="nav-right"><a class="nav-cta" href="/#collection">Explore gallery <span>↗</span></a></div></header>';
const artworkFooter='<footer class="footer"><div class="footer-top"><a class="footer-brand" href="/">FREDDY BREMSETH <em>ART</em></a><p>Art that stays with you. Stories you can live with.</p></div><div class="footer-links"><span>© '+new Date().getFullYear()+' Freddy Bremseth Art.</span><div><a href="/legal/license.html">Digital license</a><a href="/legal/terms.html">Purchase terms</a><a href="/legal/privacy.html">Privacy</a><a href="https://freddybremseth.com/">Main website ↗</a><a href="https://books.freddybremseth.com/">Books ↗</a></div></div></footer>';
for(const art of catalog){
 const target=path.join(root,'verk',art.id);fs.mkdirSync(target,{recursive:true});
 const title=`${art.title} — Freddy Bremseth Art`;
 const sale=art.digital_available!==false;
 const collectionId=collectionFor(art)||'studio-archive';
 const collection=collectionById.get(collectionId);
 const collectionName=collection?.name||'Studio Archive';
 const canonical=domain+'/verk/'+art.id+'/';
 const image=domain+art.image;
 const story=String(art.story||'A digital artwork by Freddy Bremseth.');
 const metaDescription=(story+' Explore this '+String(art.category||'digital art').toLowerCase()+' work in '+collectionName+'.').replace(/\s+/g,' ').trim().slice(0,165);
 const visualArtwork={
   '@context':'https://schema.org',
   '@type':'VisualArtwork',
   '@id':canonical+'#artwork',
   name:art.title,
   description:story,
   artform:'Digital art',
   artMedium:'AI-assisted digital composition',
   creator:{'@type':'Person','@id':'https://www.freddybremseth.com/#person',name:'Freddy Bremseth',url:'https://www.freddybremseth.com/'},
   copyrightHolder:{'@id':'https://www.freddybremseth.com/#person'},
   image,
   url:canonical,
   isPartOf:{'@type':'CollectionPage',name:collectionName,url:domain+'/collections/'+collectionId+'/'},
   width:art.width||undefined,
   height:art.height||undefined,
   offers:sale?{'@type':'Offer',price:'50.00',priceCurrency:'EUR',availability:'https://schema.org/InStock',url:domain+'/?artwork='+encodeURIComponent(art.id)+'#collection'}:undefined
 };
 const breadcrumbs={
   '@context':'https://schema.org',
   '@type':'BreadcrumbList',
   itemListElement:[
     {'@type':'ListItem',position:1,name:'Gallery',item:domain+'/'},
     {'@type':'ListItem',position:2,name:collectionName,item:domain+'/collections/'+collectionId+'/'},
     {'@type':'ListItem',position:3,name:art.title,item:canonical}
   ]
 };
 const collect= sale
  ? '<a class="btn btn-dark" href="/?artwork='+encodeURIComponent(art.id)+'#collection">Collect digital edition · €50 ↗</a>'
  : '<span class="artwork-availability">Gallery preview · Edition not currently available</span>';
 const dimensions=art.width&&art.height?art.width+' × '+art.height+' px public preview':'Public gallery preview';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f4f0e9"><meta name="robots" content="index,follow,max-image-preview:large"><meta name="author" content="Freddy Bremseth"><title>'+encode(title)+'</title><meta name="description" content="'+encode(metaDescription)+'"><link rel="canonical" href="'+canonical+'"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><meta property="og:type" content="article"><meta property="og:site_name" content="Freddy Bremseth Art"><meta property="og:url" content="'+canonical+'"><meta property="og:title" content="'+encode(title)+'"><meta property="og:description" content="'+encode(metaDescription)+'"><meta property="og:image" content="'+image+'"><meta name="twitter:card" content="summary_large_image"><link rel="stylesheet" href="/assets/css/site.css"><script type="application/ld+json">'+JSON.stringify(visualArtwork).replaceAll('<','\\u003c')+'</script><script type="application/ld+json">'+JSON.stringify(breadcrumbs).replaceAll('<','\\u003c')+'</script></head><body class="artwork-seo-page"><a class="skip" href="#artwork-detail">Skip to artwork</a><div class="announcement"><span class="ann-dot"></span> Art that stays with you <span class="ann-separator">✳</span> Individual artwork</div>'+artworkNavHeader+'<main class="collection-landing artwork-detail-page"><div class="collection-landing-inner"><nav class="collection-crumbs" aria-label="Breadcrumb"><a href="/">Gallery</a><span aria-hidden="true">/</span><a href="/collections/'+encodeURIComponent(collectionId)+'/">'+encode(collectionName)+'</a><span aria-hidden="true">/</span><span aria-current="page">'+encode(art.title)+'</span></nav><section class="artwork-detail-hero" id="artwork-detail"><div class="artwork-detail-copy"><p class="eyebrow"><span class="line"></span> '+encode(String(art.category||'DIGITAL ART').toUpperCase())+'</p><h1>'+encode(art.title)+'</h1><p class="artwork-story">'+encode(story)+'</p><dl class="artwork-facts"><div><dt>Collection</dt><dd><a href="/collections/'+encodeURIComponent(collectionId)+'/">'+encode(collectionName)+'</a></dd></div><div><dt>Format</dt><dd>'+encode(art.orientation||'Digital artwork')+'</dd></div><div><dt>Preview</dt><dd>'+encode(dimensions)+'</dd></div><div><dt>Artist</dt><dd>Freddy Bremseth</dd></div></dl><div class="artwork-actions">'+collect+'<a class="btn btn-outline" href="/collections/'+encodeURIComponent(collectionId)+'/">More from this collection ↗</a><a class="text-link" href="/#collection">Browse all artworks ↗</a></div></div><figure class="artwork-detail-figure"><img src="'+encode(art.image)+'" alt="'+encode(art.title)+' — Freddy Bremseth Art" width="'+art.width+'" height="'+art.height+'" fetchpriority="high"><figcaption>Public gallery preview · The full composition is shown without intentional cropping.</figcaption></figure></section><section class="artwork-context"><p class="eyebrow"><span class="line"></span> BEHIND THE IMAGE</p><h2>A work from <em>'+encode(collectionName)+'</em>.</h2><p>'+encode(story)+'</p><p>This work is presented as part of the '+encode(collectionName)+' collection. Explore related works to see how the visual language develops across the series, or return to the gallery to discover a different path through the collection.</p><div class="artwork-context-links"><a class="text-link" href="/collections/'+encodeURIComponent(collectionId)+'/">Explore '+encode(collectionName)+' ↗</a><a class="text-link" href="/#approach">Read about the artistic approach ↗</a></div></section></div></main>'+artworkFooter+'<script defer src="/assets/js/seo-referral-tracker.js"></script></body></html>';
 fs.writeFileSync(path.join(target,'index.html'),html);
}

// First-class collection pages generated from the curated collection taxonomy.
// These remain usable, linkable and indexable without JavaScript.
const collectionUrls=[];
const navHeader='<header class="site-header"><a class="brand" href="/" aria-label="Freddy Bremseth Art — home"><span class="brand-symbol">FB<span class="brand-star">✳</span></span><span class="brand-name">FREDDY BREMSETH <small>ART STUDIO &amp; GALLERY</small></span></a><nav aria-label="Main navigation"><a href="/#collections-featured">Collections</a><a href="/#collection">All artworks</a><a href="/#approach">The artist</a><a href="/#collect">Collect art</a></nav><div class="nav-right"><a class="nav-cta" href="/#collection">All artworks <span>↗</span></a></div></header>';
const footer='<footer class="footer"><div class="footer-top"><a class="footer-brand" href="/">FREDDY BREMSETH <em>ART</em></a><p>Art that stays with you. Stories you can live with.</p></div><div class="footer-links"><span>© '+new Date().getFullYear()+' Freddy Bremseth Art.</span><div><a href="/legal/license.html">Digital license</a><a href="/legal/terms.html">Purchase terms</a><a href="/legal/privacy.html">Privacy</a><a href="https://freddybremseth.com/">Main website ↗</a></div></div></footer>';
const notes={
  'human-condition':'Stories about connection, resilience and the feelings that shape our choices.',
  'words-that-matter':'Expressive street-inspired art where form, colour and imagery carry a message.',
  'symbolic-street-art':'A meeting of symbolic figures, expressive urban imagery and words that carry feeling.',
  'mediterranean-soul':'Imagined coasts, warm light and atmospheric landscapes rather than documented locations.',
  'earth-and-emotion':'Botanical forms, grounded palettes and tactile-looking digital compositions.',
  'city-after-dark':'Nocturnal city stories shaped by rain, windows, music, solitude and cinematic light.',
  'sunken-worlds':'Imagined civilizations below the waterline, where architecture, memory and the sea meet.',
  'forgotten-places':'Abandoned architecture, fading grandeur and spaces where silence becomes part of the story.',
  'gilded-dreams':'Gold-mended bodies, moonlit symbols and surreal relics exploring transformation, fragility and repair.',
  'after-the-war':'Cinematic ruins and the stillness after conflict, focused on human cost, compassion and the possibility of peace.',
  'mediterranean-silence':'Limestone, terracotta, olive trees and sea light reduced to quiet, spacious compositions.',
  'impossible-rooms':'Architectural scenes that stay elegant while perspective, gravity, water or space quietly stops obeying the rules.',
  'midnight-gold':'Nocturnal luxury in midnight blue, black marble and antique gold, shaped by reflections and cinematic light.',
  'golden-scars':'Objects, structures and natural forms transformed by luminous kintsugi-like repair.',
  'dream-logic':'Plausible scenes with one impossible detail — images designed to reward the second look.',
  'studio-archive':'A wider selection of historical and stylistic studies from the digital studio.'
};
for(const collection of curation.collections){
 if(!/^[a-z0-9-]+$/.test(collection.id))throw Error('Invalid collection URL segment: '+collection.id);
 const works=catalog.filter(art=>collectionFor(art)===collection.id&&!curatedVariantIds.has(art.id));
 const url=domain+'/collections/'+collection.id+'/';
 const configuredCover=String(collection.cover||'');
 let cover=configuredCover?configuredCover.replace('-thumb.webp','-view.webp'):(works[0]?.image||'');
 if(cover&&!fs.existsSync(path.join(root,cover.replace(/^\//,''))))throw Error('Collection cover missing: '+cover);
 const title=collection.name+' — Freddy Bremseth Art';
 const description=collection.description+(works.length?' Discover '+works.length+' digital artworks in this curated collection.':' New works in this collection are added from the private studio catalogue.');
 const cards=works.map(art=>'<article class="art-card'+(art.id==='drmmetrappen-til-manen'?' art-card-landscape-feature':'')+'"><a href="/verk/'+encodeURIComponent(art.id)+'/" aria-label="Explore '+encode(art.title)+'"><span class="art-photo"><img loading="lazy" src="'+encode(art.id==='drmmetrappen-til-manen'?art.image:art.thumb)+'" alt="'+encode(art.title)+'" width="'+art.width+'" height="'+art.height+'"></span><span class="art-card-meta"><span><span class="art-title">'+encode(art.title)+'</span><span class="art-category">'+encode(art.category)+' · '+(art.digital_available===false?'Gallery preview · Not for sale':'Digital edition €50')+'</span></span><span class="art-number">'+String(art.number).padStart(3,'0')+'</span></span></a></article>').join('\n');
 const siblings=curation.collections.filter(c=>c.id!==collection.id).map(c=>'<a href="/collections/'+encodeURIComponent(c.id)+'/">'+encode(c.name)+' ↗</a>').join('');
 const structured={'@context':'https://schema.org','@type':'CollectionPage',name:collection.name,description,url,mainEntity:{'@type':'ItemList',numberOfItems:works.length,itemListElement:works.map((art,i)=>({'@type':'ListItem',position:i+1,name:art.title,url:domain+'/verk/'+art.id+'/'}))}};
 const ogImage=cover?'<meta property="og:image" content="'+domain+encode(cover)+'">':'';
 const heroFigure=cover
  ?'<figure id="collection-cover-figure"><img id="collection-cover-img" src="'+encode(cover)+'" alt="A selected artwork from '+encode(collection.name)+'" fetchpriority="high"><figcaption>Selected work from this collection · Digital gallery preview</figcaption></figure>'
  :'<figure id="collection-cover-figure" data-auto-cover="true" hidden><img id="collection-cover-img" alt="A selected artwork from '+encode(collection.name)+'"><figcaption>Selected work from this collection · Digital gallery preview</figcaption></figure>';
 const emptyNote=works.length?'':'<p id="collection-empty-note" class="subtle">This collection is ready for new studio imports. New artworks appear here automatically after publication.</p>';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f3efe7"><meta name="robots" content="index,follow,max-image-preview:large"><title>'+encode(title)+'</title><meta name="description" content="'+encode(description)+'"><link rel="canonical" href="'+url+'"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><meta property="og:type" content="website"><meta property="og:site_name" content="Freddy Bremseth Art"><meta property="og:title" content="'+encode(title)+'"><meta property="og:description" content="'+encode(description)+'">'+ogImage+'<link rel="stylesheet" href="/assets/css/site.css"><script defer src="/assets/js/gallery-config.js"></script><script defer src="/assets/js/collection-sync.js"></script><script type="application/ld+json">'+JSON.stringify(structured).replaceAll('<','\\u003c')+'</script></head><body class="collection-page"><a class="skip" href="#collection-works">Skip to artworks</a><div class="announcement"><span class="ann-dot"></span> Art that stays with you <span class="ann-separator">✳</span> Curated collections</div>'+navHeader+'<main class="collection-landing"><div class="collection-landing-inner"><nav class="collection-crumbs" aria-label="Breadcrumb"><a href="/">Gallery</a><span aria-hidden="true">/</span><a href="/#collections-featured">Collections</a><span aria-hidden="true">/</span><span aria-current="page">'+encode(collection.name)+'</span></nav><section class="collection-landing-hero"><div><p class="eyebrow"><span class="line"></span> '+(collection.featured?'SIGNATURE COLLECTION':'STUDIO ARCHIVE')+' / <span id="collection-work-count">'+works.length+'</span> ARTWORKS</p><h1>'+encode(collection.name)+'</h1><p class="collection-landing-lede">'+encode(collection.description)+'</p><p>'+encode(notes[collection.id]||'A curated selection from the studio.')+'</p><a href="#collection-works" class="btn btn-dark">Explore the artworks ↘</a></div>'+heroFigure+'</section><section id="collection-works" aria-labelledby="works-title"><div class="collection-gallery-header"><h2 id="works-title">Explore the collection</h2><p>'+works.length+' artworks · Print availability is shown on individual artworks</p></div>'+emptyNote+'<div class="gallery-grid">'+cards+'</div></section><nav class="collection-footer-nav" aria-label="Explore other collections"><a href="/#collection">All artworks ↗</a>'+siblings+'</nav></div></main>'+footer+'<script defer src="/assets/js/seo-referral-tracker.js"></script></body></html>';
 const destination=path.join(root,'collections',collection.id);fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'index.html'),html);
 collectionUrls.push(url);
}

const urls=[domain+'/',domain+'/shop/',domain+'/legal/license.html',domain+'/legal/terms.html',domain+'/legal/privacy.html',...collectionUrls,...catalog.map(a=>domain+'/verk/'+a.id+'/')];
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`<url><loc>${u}</loc></url>`).join('\n')+'\n</urlset>\n');
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: '+domain+'/sitemap.xml\nSitemap: '+domain+'/artwork-sitemap.xml\n');
console.log('Generated '+catalog.length+' canonical individual artwork pages and '+collectionUrls.length+' dedicated collection pages, sitemap and robots.txt');
