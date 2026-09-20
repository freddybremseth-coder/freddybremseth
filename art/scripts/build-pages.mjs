import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/catalog.json'),'utf8'));
let template=fs.readFileSync(path.join(root,'index.html'),'utf8');
// The homepage and SEO metadata reflect the actual build-time catalogue, including imported previews.
template=template.replace(/Explore \d+ digital artworks/,`Explore ${catalog.length} digital artworks`).replace(/collection of \d+ visual stories/,`collection of ${catalog.length} visual stories`).replace(/id="art-count">\d+<\/strong>/,`id="art-count">${catalog.length}</strong>`).replace(/id="end-number">\d+<\/span>/,`id="end-number">${catalog.length}</span>`);
fs.writeFileSync(path.join(root,'index.html'),template);
const domain='https://art.freddybremseth.com';
const encode=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const art of catalog){
 const target=path.join(root,'verk',art.id);fs.mkdirSync(target,{recursive:true});
 const title=`${art.title} — Freddy Bremseth Art`;
 const sale=art.digital_available!==false;
 const desc=`${art.title}: ${art.story} Explore this ${art.category.toLowerCase()} digital artwork by Freddy Bremseth. ${sale?'Digital edition €50.':'Gallery preview. Editions not yet available.'}`;
 let html=template.replace('<html lang="en">','<html lang="en">')
 .replace(/<title>[^<]*<\/title>/,`<title>${encode(title)}</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${encode(desc)}">`)
 .replace('href="https://art.freddybremseth.com/"','href="'+domain+'/verk/'+art.id+'/"')
 .replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${encode(title)}">`)
 .replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${encode(desc)}">`)
 .replace(/<meta property="og:image" content="[^"]*">/,`<meta property="og:image" content="${domain+art.image}">`)
 .replace('<div id="gallery" class="gallery-collections" aria-live="polite"><p>Loading the gallery…</p></div>',`<div id="gallery" class="gallery-grid" aria-live="polite"><article class="art-card${art.id==='drmmetrappen-til-manen'?' art-card-landscape-feature':''}"><a href="#collection" aria-label="${encode(art.title)}"><span class="art-photo"><img src="${art.image}" alt="${encode(art.title)} — Freddy Bremseth Art" width="${art.width}" height="${art.height}"></span><span class="art-card-meta"><span><span class="art-title">${encode(art.title)}</span><span class="art-category">${encode(art.category)} · ${sale?'Digital artwork €50':'Gallery preview · Not for sale'}</span></span></span></a><p>${encode(art.story)}</p></article></div>`)
 .replace('</head>',`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'VisualArtwork',name:art.title,description:art.story,artform:'Digital art',creator:{'@type':'Person',name:'Freddy Bremseth',url:'https://freddybremseth.com/'},image:domain+art.image,url:domain+'/verk/'+art.id+'/'}).replaceAll('<','\\u003c')}</script></head>`);
 fs.writeFileSync(path.join(target,'index.html'),html);
}

// Five first-class collection pages (four signatures and the studio archive).
// These remain usable, linkable and indexable without JavaScript.
const curation=JSON.parse(fs.readFileSync(path.join(root,'assets/collections.json'),'utf8'));
const collectionFor=art=>curation.byArtworkId[art.id]||curation.byStyle[art.style_id];
const collectionUrls=[];
const navHeader='<header class="site-header"><a class="brand" href="/" aria-label="Freddy Bremseth Art — home"><span class="brand-symbol">FB<span class="brand-star">✳</span></span><span class="brand-name">FREDDY BREMSETH <small>ART STUDIO &amp; GALLERY</small></span></a><nav aria-label="Main navigation"><a href="/#collections-featured">Collections</a><a href="/#collection">All artworks</a><a href="/#approach">The artist</a><a href="/#collect">Collect art</a></nav><div class="nav-right"><a class="nav-cta" href="/#collection">All artworks <span>↗</span></a></div></header>';
const footer='<footer class="footer"><div class="footer-top"><a class="footer-brand" href="/">FREDDY BREMSETH <em>ART</em></a><p>Art that stays with you. Stories you can live with.</p></div><div class="footer-links"><span>© '+new Date().getFullYear()+' Freddy Bremseth Art.</span><div><a href="/legal/license.html">Digital license</a><a href="/legal/terms.html">Purchase terms</a><a href="/legal/privacy.html">Privacy</a><a href="https://freddybremseth.com/">Main website ↗</a></div></div></footer>';
const notes={
  'human-condition':'Stories about connection, resilience and the feelings that shape our choices.',
  'words-that-matter':'Expressive street-inspired art where form, colour and imagery carry a message.',
  'mediterranean-soul':'Imagined coasts, warm light and atmospheric landscapes rather than documented locations.',
  'earth-and-emotion':'Botanical forms, grounded palettes and tactile-looking digital compositions.',
  'studio-archive':'A wider selection of historical and stylistic studies from the digital studio.'
};
for(const collection of curation.collections){
 if(!/^[a-z0-9-]+$/.test(collection.id))throw Error('Invalid collection URL segment: '+collection.id);
 const works=catalog.filter(art=>collectionFor(art)===collection.id);
 if(!works.length)throw Error('Empty public collection: '+collection.id);
 const url=domain+'/collections/'+collection.id+'/';
 const cover=collection.cover.replace('-thumb.webp','-view.webp');
 if(!fs.existsSync(path.join(root,cover.replace(/^\//,''))))throw Error('Collection cover missing: '+cover);
 const title=collection.name+' — Freddy Bremseth Art';
 const description=collection.description+' Discover '+works.length+' digital artworks in this curated collection.';
 const cards=works.map(art=>'<article class="art-card'+(art.id==='drmmetrappen-til-manen'?' art-card-landscape-feature':'')+'"><a href="/verk/'+encodeURIComponent(art.id)+'/" aria-label="Explore '+encode(art.title)+'"><span class="art-photo"><img loading="lazy" src="'+encode(art.id==='drmmetrappen-til-manen'?art.image:art.thumb)+'" alt="'+encode(art.title)+'" width="'+art.width+'" height="'+art.height+'"></span><span class="art-card-meta"><span><span class="art-title">'+encode(art.title)+'</span><span class="art-category">'+encode(art.category)+' · '+(art.digital_available===false?'Gallery preview · Not for sale':'Digital edition €50')+'</span></span><span class="art-number">'+String(art.number).padStart(3,'0')+'</span></span></a></article>').join('\n');
 const siblings=curation.collections.filter(c=>c.id!==collection.id).map(c=>'<a href="/collections/'+encodeURIComponent(c.id)+'/">'+encode(c.name)+' ↗</a>').join('');
 const structured={'@context':'https://schema.org','@type':'CollectionPage',name:collection.name,description,url,mainEntity:{'@type':'ItemList',numberOfItems:works.length,itemListElement:works.map((art,i)=>({'@type':'ListItem',position:i+1,name:art.title,url:domain+'/verk/'+art.id+'/'}))}};
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f3efe7"><meta name="robots" content="index,follow,max-image-preview:large"><title>'+encode(title)+'</title><meta name="description" content="'+encode(description)+'"><link rel="canonical" href="'+url+'"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><meta property="og:type" content="website"><meta property="og:site_name" content="Freddy Bremseth Art"><meta property="og:title" content="'+encode(title)+'"><meta property="og:description" content="'+encode(description)+'"><meta property="og:image" content="'+domain+encode(cover)+'"><link rel="stylesheet" href="/assets/css/site.css"><script type="application/ld+json">'+JSON.stringify(structured).replaceAll('<','\\u003c')+'</script></head><body class="collection-page"><a class="skip" href="#collection-works">Skip to artworks</a><div class="announcement"><span class="ann-dot"></span> Art that stays with you <span class="ann-separator">✳</span> Curated collections</div>'+navHeader+'<main class="collection-landing"><div class="collection-landing-inner"><nav class="collection-crumbs" aria-label="Breadcrumb"><a href="/">Gallery</a><span aria-hidden="true">/</span><a href="/#collections-featured">Collections</a><span aria-hidden="true">/</span><span aria-current="page">'+encode(collection.name)+'</span></nav><section class="collection-landing-hero"><div><p class="eyebrow"><span class="line"></span> '+(collection.featured?'SIGNATURE COLLECTION':'STUDIO ARCHIVE')+' / '+works.length+' ARTWORKS</p><h1>'+encode(collection.name)+'</h1><p class="collection-landing-lede">'+encode(collection.description)+'</p><p>'+encode(notes[collection.id]||'A curated selection from the studio.')+'</p><a href="#collection-works" class="btn btn-dark">Explore the artworks ↘</a></div><figure><img src="'+encode(cover)+'" alt="A selected artwork from '+encode(collection.name)+'" fetchpriority="high"><figcaption>Selected work from this collection · Digital gallery preview</figcaption></figure></section><section id="collection-works" aria-labelledby="works-title"><div class="collection-gallery-header"><h2 id="works-title">Explore the collection</h2><p>'+works.length+' artworks · Physical prints are not on sale yet</p></div><div class="gallery-grid">'+cards+'</div></section><nav class="collection-footer-nav" aria-label="Explore other collections"><a href="/#collection">All artworks ↗</a>'+siblings+'</nav></div></main>'+footer+'<script defer src="/assets/js/seo-referral-tracker.js"></script></body></html>';
 const destination=path.join(root,'collections',collection.id);fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,'index.html'),html);
 collectionUrls.push(url);
}

const urls=[domain+'/',domain+'/legal/license.html',domain+'/legal/terms.html',domain+'/legal/privacy.html',...collectionUrls,...catalog.map(a=>domain+'/verk/'+a.id+'/')];
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`<url><loc>${u}</loc></url>`).join('\n')+'\n</urlset>\n');
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: '+domain+'/sitemap.xml\n');
console.log('Generated '+catalog.length+' canonical individual artwork pages and '+collectionUrls.length+' dedicated collection pages, sitemap and robots.txt');
