import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ORIGIN = process.env.SITE_URL || 'https://books.freddybremseth.com';

const dataJs = fs.readFileSync(path.join(root, 'assets/books-data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('['), dataJs.lastIndexOf(']') + 1);
const series = JSON.parse(json);

const langs = ['no', 'en', 'es'];
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (value, lang) => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.no || value.es || '';
};
const prefixFor = (lang) => lang === 'no' ? '' : `/${lang}`;
const pathFor = (lang, route = '') => `${prefixFor(lang)}${route ? `/${route}` : '/'}`;
const absolute = (lang, route = '') => `${ORIGIN}${pathFor(lang, route)}`;
const coverUrl = cover => cover ? `${ORIGIN}/${String(cover).replace(/^\//, '')}` : `${ORIGIN}/assets/author/freddy-bremseth.jpg`;
const metaDescription = value => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 165) return text;
  return text.slice(0, 162).replace(/\s+\S*$/, '') + '…';
};
const breadcrumbName = (lang, route, title) => {
  if (!route) return title;
  if (route === 'library') return lang === 'en' ? 'Library' : lang === 'es' ? 'Biblioteca' : 'Bibliotek';
  if (route === 'about') return lang === 'en' ? 'About the author' : lang === 'es' ? 'Sobre el autor' : 'Om forfatteren';
  if (route === 'contact') return lang === 'en' ? 'Contact' : lang === 'es' ? 'Contacto' : 'Kontakt';
  return title;
};

function hreflangs(route) {
  return [
    ...langs.map(lang => `<link rel="alternate" hreflang="${lang}" href="${esc(absolute(lang, route))}" />`),
    `<link rel="alternate" hreflang="x-default" href="${esc(absolute('no', route))}" />`,
  ].join('\n  ');
}

function chrome(lang, title, description, route, body, schema, image) {
  const canonical = absolute(lang, route);
  const langAttr = lang === 'no' ? 'no' : lang;
  const imageUrl = image ? coverUrl(image) : `${ORIGIN}/assets/og-books.jpg`;
  const metaDesc = metaDescription(description);
  const crumb = {
    '@context':'https://schema.org',
    '@type':'BreadcrumbList',
    itemListElement: route ? [
      {'@type':'ListItem',position:1,name:lang === 'en' ? 'Books' : lang === 'es' ? 'Libros' : 'Bøker',item:absolute(lang, '')},
      {'@type':'ListItem',position:2,name:breadcrumbName(lang, route, title),item:canonical}
    ] : [
      {'@type':'ListItem',position:1,name:breadcrumbName(lang, route, title),item:canonical}
    ]
  };
  return `<!DOCTYPE html>
<html lang="${langAttr}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(metaDesc)}" />
  <meta name="author" content="Freddy Bremseth" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${esc(canonical)}" />
  ${hreflangs(route)}
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(metaDesc)}" />
  <meta property="og:site_name" content="Freddy Bremseth Books" />
  <meta property="og:type" content="${route.startsWith('book/') ? 'book' : 'website'}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,400;0,600;0,700;1,400&family=Work+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/books.css" />
  <script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>
  <script type="application/ld+json">${JSON.stringify(crumb).replace(/</g, '\\u003c')}</script>
</head>
<body>
  <div id="app">${body}</div>
  <footer class="site-footer seo-network-footer"><div class="container">
    <span class="footer-line">Freddy Bremseth · books, projects and creative work</span>
    <nav class="books-brand-network" aria-label="Freddy Bremseth prosjektnettverk">
      <strong>Freddy Bremseth network</strong>
      <a href="https://www.freddybremseth.com/">FreddyBremseth.com</a>
      <a href="https://www.zenecohomes.com/">Zen Eco Homes</a>
      <a href="https://www.pinosoecolife.com/">Pinoso Eco Life</a>
      <a href="https://www.donaanna.com/">Doña Anna</a>
      <a href="https://www.chatgenius.pro/">ChatGenius</a>
      <a href="https://art.freddybremseth.com/">Art</a>
      <a href="https://remaster.freddybremseth.com/">Re-Master Freddy</a>
    </nav>
  </div></footer>
  <script src="/assets/books-data.js"></script>
  <script src="/assets/books-i18n.js"></script>
  <script src="/assets/books-app.js"></script>
  <script src="/assets/books-growth.js"></script>
  <script defer src="/assets/seo-referral-tracker.js"></script>
</body>
</html>\n`;
}

function nav(lang) {
  const p = prefixFor(lang);
  const labels = lang === 'es'
    ? { home: 'Libros', library: 'Biblioteca', about: 'Sobre el autor' }
    : lang === 'en'
      ? { home: 'Books', library: 'Library', about: 'About the author' }
      : { home: 'Bøker', library: 'Bibliotek', about: 'Om forfatteren' };
  return `<nav aria-label="Primary"><a href="${p || '/'}">${labels.home}</a> · <a href="${p}/library">${labels.library}</a> · <a href="${p}/about">${labels.about}</a> · <a href="https://www.freddybremseth.com/">Freddy Bremseth</a></nav>`;
}

function homePage(lang) {
  const title = lang === 'es' ? 'Freddy Bremseth — Libros y series' : lang === 'en' ? 'Freddy Bremseth — Books & Series' : 'Freddy Bremseth — Bøker & serier';
  const desc = lang === 'es'
    ? 'Thrillers psicológicos y libros de no ficción sobre economía, poder, geopolítica, salud, olivos, agricultura y la vida en España.'
    : lang === 'en'
      ? 'Psychological thrillers and nonfiction about economics, power, geopolitics, health, olives, agriculture and life in Spain.'
      : 'Psykologiske thrillere og sakprosa om økonomi, makt, geopolitikk, helse, oliven, jordbruk og livet i Spania.';
  const cards = series.map(s => `<article><h2><a href="${prefixFor(lang)}/series/${esc(s.id)}">${esc(pick(s.title, lang))}</a></h2><p>${esc(pick(s.desc, lang))}</p><ul>${(s.books || []).map(b => `<li><a href="${prefixFor(lang)}/book/${esc(b.id)}">${esc(b.title)}</a></li>`).join('')}</ul></article>`).join('');
  const body = `<main style="max-width:1100px;margin:40px auto;padding:0 24px">${nav(lang)}<h1>${esc(title)}</h1><p>${esc(desc)}</p>${cards}</main>`;
  const schema = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': ORIGIN + '/#website', url: absolute(lang, ''), name: 'Freddy Bremseth Books', inLanguage: lang, publisher: { '@id': 'https://www.freddybremseth.com/#person' } },
    { '@type': 'ProfilePage', '@id': absolute(lang, '') + '#profile', url: absolute(lang, ''), mainEntity: { '@type': 'Person', '@id': 'https://www.freddybremseth.com/#person', name: 'Freddy Bremseth', url: 'https://www.freddybremseth.com/', jobTitle: lang === 'en' ? 'Author' : lang === 'es' ? 'Autor' : 'Forfatter', knowsAbout: ['Psychological thrillers','Crime fiction','Economics','Geopolitics','Mediterranean living','Olive oil','Spain'] } }
  ] };
  return chrome(lang, title, desc, '', body, schema);
}

function seriesPage(s, lang) {
  const name = pick(s.title, lang);
  const desc = pick(s.desc, lang) || pick(s.tag, lang);
  const route = `series/${s.id}`;
  const title = `${name} — Freddy Bremseth`;
  const books = (s.books || []).map((b) => `<article><h2><a href="${prefixFor(lang)}/book/${esc(b.id)}">${esc(b.title)}</a></h2><p>${esc(pick(b.descShort, lang))}</p>${b.cover ? `<img src="/${esc(b.cover)}" alt="${esc(b.title)} book cover" loading="lazy" width="220" />` : ''}</article>`).join('');
  const body = `<main style="max-width:1000px;margin:40px auto;padding:0 24px">${nav(lang)}<p><a href="${prefixFor(lang) || '/'}">← ${lang === 'en' ? 'All books' : lang === 'es' ? 'Todos los libros' : 'Alle bøker'}</a></p><h1>${esc(name)}</h1><p>${esc(desc)}</p>${books}</main>`;
  const schema = { '@context': 'https://schema.org', '@type': 'CreativeWorkSeries', '@id': absolute(lang, route) + '#series', name, description: desc, url: absolute(lang, route), genre: pick(s.tag, lang), author: { '@type': 'Person', '@id': 'https://www.freddybremseth.com/#person', name: 'Freddy Bremseth', url: 'https://www.freddybremseth.com/' }, hasPart: (s.books || []).map((b, i) => ({ '@type': 'Book', name: b.title, position: i + 1, url: absolute(lang, `book/${b.id}`) })) };
  return chrome(lang, title, desc, route, body, schema, s.cover);
}

function bookPage(s, b, lang) {
  // Some catalog records have a title and verified series but no description.
  // Never fabricate a plot summary or leave an empty metadata/HTML description.
  const name = pick(s.title, lang);
  const factualFallback = lang === 'es'
    ? 'Descubre ' + b.title + ', un título de la serie ' + name + ' de Freddy Bremseth. Consulta los detalles del libro y de la serie.'
    : lang === 'en'
      ? 'Discover ' + b.title + ', a book in the ' + name + ' series by Freddy Bremseth. Explore the book and its series.'
      : 'Utforsk ' + b.title + ', en bok i serien ' + name + ' av Freddy Bremseth. Se bokinformasjon og resten av serien.';
  const desc = pick(b.descFull, lang) || pick(b.descShort, lang) || b.excerpt || factualFallback;
  const short = pick(b.descShort, lang) || desc;
  const route = `book/${b.id}`;
  const title = `${b.title}${b.subtitle ? ` — ${b.subtitle}` : ''} | Freddy Bremseth`;
  const buy = b.amazon ? `<p><a href="${esc(b.amazon)}" rel="nofollow sponsored noopener">Amazon</a></p>` : '';
  const sample = b.samplePath ? `<p><a href="/${esc(b.samplePath)}">${lang === 'en' ? 'Read a free sample' : lang === 'es' ? 'Leer una muestra gratis' : 'Les gratis prøvekapittel'}</a></p>` : '';
  const body = `<main style="max-width:920px;margin:40px auto;padding:0 24px">${nav(lang)}<p><a href="${prefixFor(lang)}/series/${esc(s.id)}">← ${esc(pick(s.title, lang))}</a></p><article><h1>${esc(b.title)}</h1>${b.subtitle ? `<p>${esc(b.subtitle)}</p>` : ''}${b.cover ? `<img src="/${esc(b.cover)}" alt="${esc(b.title)} book cover by Freddy Bremseth" width="320" />` : ''}<p>${esc(desc)}</p>${b.words ? `<p>${Number(b.words).toLocaleString('en-US')} words${b.pages ? ` · ${b.pages} pages` : ''}</p>` : ''}${sample}${buy}</article></main>`;
  const schema = { '@context': 'https://schema.org', '@type': 'Book', '@id': absolute(lang, route) + '#book', name: b.title, description: desc, url: absolute(lang, route), image: b.cover ? coverUrl(b.cover) : undefined, author: { '@type': 'Person', '@id': 'https://www.freddybremseth.com/#person', name: 'Freddy Bremseth', url: 'https://www.freddybremseth.com/' }, isPartOf: { '@type': 'CreativeWorkSeries', '@id': absolute(lang, `series/${s.id}`) + '#series', name: pick(s.title, lang), url: absolute(lang, `series/${s.id}`) }, genre: pick(s.tag, lang), inLanguage: lang, numberOfPages: b.pages || undefined, sameAs: b.amazon || undefined };
  return chrome(lang, title, short, route, body, schema, b.cover);
}

function simplePage(route, lang) {
  const map = {
    about: {
      no: ['Om Freddy Bremseth', 'Møt Freddy Bremseth, forfatter av psykologiske thrillere, krim og sakprosa om økonomi, makt, helse, oliven, Spania og middelhavsliv.'],
      en: ['About Freddy Bremseth', 'Meet Freddy Bremseth, author of psychological thrillers, crime fiction and nonfiction about economics, power, health, olives, Spain and Mediterranean living.'],
      es: ['Sobre Freddy Bremseth', 'Conoce a Freddy Bremseth, autor de thrillers psicológicos, novela negra y no ficción sobre economía, poder, salud, olivos, España y vida mediterránea.'],
    },
    library: {
      no: ['Bibliotek', 'Utforsk hele bokkatalogen til Freddy Bremseth: psykologiske thrillere, krim, økonomi, geopolitikk, helse, Spania, oliven og barnebøker.'],
      en: ['Library', 'Explore Freddy Bremseth’s complete book catalogue: psychological thrillers, crime, economics, geopolitics, health, Spain, olives and children’s books.'],
      es: ['Biblioteca', 'Explora el catálogo completo de Freddy Bremseth: thrillers psicológicos, novela negra, economía, geopolítica, salud, España, olivos y libros infantiles.'],
    },
    contact: {
      no: ['Kontakt', 'Kontakt forfatter Freddy Bremseth.'],
      en: ['Contact', 'Contact author Freddy Bremseth.'],
      es: ['Contacto', 'Contacta con el autor Freddy Bremseth.'],
    },
  };
  const [heading, desc] = map[route][lang];
  const body = `<main style="max-width:900px;margin:40px auto;padding:0 24px">${nav(lang)}<h1>${esc(heading)}</h1><p>${esc(desc)}</p>${route === 'library' ? series.map(s => `<h2><a href="${prefixFor(lang)}/series/${esc(s.id)}">${esc(pick(s.title, lang))}</a></h2>`).join('') : ''}</main>`;
  const schema = route === 'library'
    ? { '@context':'https://schema.org', '@type':'CollectionPage', name:heading, description:desc, url:absolute(lang, route), isPartOf:{'@id':ORIGIN+'/#website'}, mainEntity:{'@type':'ItemList',numberOfItems:series.length,itemListElement:series.map((s,i)=>({'@type':'ListItem',position:i+1,name:pick(s.title,lang),url:absolute(lang,`series/${s.id}`)}))} }
    : route === 'about'
      ? { '@context':'https://schema.org', '@type':'ProfilePage', name:heading, description:desc, url:absolute(lang, route), mainEntity:{'@type':'Person','@id':'https://www.freddybremseth.com/#person',name:'Freddy Bremseth',url:'https://www.freddybremseth.com/',jobTitle:lang==='en'?'Author':lang==='es'?'Autor':'Forfatter'} }
      : { '@context':'https://schema.org', '@type':'ContactPage', name:heading, description:desc, url:absolute(lang, route), about:{'@id':'https://www.freddybremseth.com/#person'} };
  return chrome(lang, `${heading} — Freddy Bremseth`, desc, route, body, schema);
}

function writeRoute(lang, route, html) {
  const prefix = lang === 'no' ? '' : lang;
  let file;
  if (!route) file = path.join(root, prefix, 'index.html');
  else file = path.join(root, prefix, `${route}.html`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

for (const lang of langs) {
  writeRoute(lang, '', homePage(lang));
  for (const route of ['about', 'library', 'contact']) writeRoute(lang, route, simplePage(route, lang));
  for (const s of series) {
    writeRoute(lang, `series/${s.id}`, seriesPage(s, lang));
    for (const b of s.books || []) writeRoute(lang, `book/${b.id}`, bookPage(s, b, lang));
  }
}

console.log(`Prerendered ${langs.length} languages × ${4 + series.length + series.reduce((n, s) => n + (s.books || []).length, 0)} routes.`);