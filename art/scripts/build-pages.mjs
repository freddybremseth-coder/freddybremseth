import fs from 'node:fs';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'assets/catalog.json'),'utf8'));
let template=fs.readFileSync(path.join(root,'index.html'),'utf8');
const domain='https://art.freddybremseth.com';
const encode=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const art of catalog){
 const target=path.join(root,'verk',art.id);fs.mkdirSync(target,{recursive:true});
 const title=`${art.title} — Freddy Bremseth Art`;
 const desc=`${art.title}: ${art.story} Explore this ${art.category.toLowerCase()} digital artwork by Freddy Bremseth. Digital edition €50.`;
 let html=template.replace('<html lang="en">','<html lang="en">')
 .replace(/<title>[^<]*<\/title>/,`<title>${encode(title)}</title>`)
 .replace(/<meta name="description" content="[^"]*">/,`<meta name="description" content="${encode(desc)}">`)
 .replace('href="https://art.freddybremseth.com/"','href="'+domain+'/verk/'+art.id+'/"')
 .replace(/<meta property="og:title" content="[^"]*">/,`<meta property="og:title" content="${encode(title)}">`)
 .replace(/<meta property="og:description" content="[^"]*">/,`<meta property="og:description" content="${encode(desc)}">`)
 .replace(/<meta property="og:image" content="[^"]*">/,`<meta property="og:image" content="${domain+art.image}">`)
 .replace('<div id="gallery" class="gallery-grid" aria-live="polite"><p>Loading the gallery…</p></div>',`<div id="gallery" class="gallery-grid" aria-live="polite"><article class="art-card"><a href="#collection" aria-label="${encode(art.title)}"><span class="art-photo"><img src="${art.image}" alt="${encode(art.title)} — Freddy Bremseth Art" width="${art.width}" height="${art.height}"></span><span class="art-card-meta"><span><span class="art-title">${encode(art.title)}</span><span class="art-category">${encode(art.category)} · Digital artwork €50</span></span></span></a><p>${encode(art.story)}</p></article></div>`)
 .replace('</head>',`<script type="application/ld+json">${JSON.stringify({'@context':'https://schema.org','@type':'VisualArtwork',name:art.title,description:art.story,artform:'Digital art',creator:{'@type':'Person',name:'Freddy Bremseth',url:'https://freddybremseth.com/'},image:domain+art.image,url:domain+'/verk/'+art.id+'/'}).replaceAll('<','\\u003c')}</script></head>`);
 fs.writeFileSync(path.join(target,'index.html'),html);
}
const now='2026-09-19';
const urls=[domain+'/',domain+'/legal/license.html',domain+'/legal/terms.html',domain+'/legal/privacy.html',...catalog.map(a=>domain+'/verk/'+a.id+'/')];
fs.writeFileSync(path.join(root,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(u=>`<url><loc>${u}</loc></url>`).join('\n')+'\n</urlset>\n');
fs.writeFileSync(path.join(root,'robots.txt'),'User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: '+domain+'/sitemap.xml\n');
console.log('Generated '+catalog.length+' canonical individual artwork pages, sitemap and robots.txt');
