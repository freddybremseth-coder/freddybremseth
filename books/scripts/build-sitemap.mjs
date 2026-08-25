// Generates sitemap.xml (all routes × no/en/es) + robots.txt from the catalog.
// Run: node scripts/build-sitemap.mjs  (also runnable in CI / before deploy)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ORIGIN = process.env.SITE_URL || 'https://books.freddybremseth.com';

// load catalog from the browser bundle (window.BOOKS_SERIES = [...];)
const dataJs = fs.readFileSync(path.join(root, 'assets/books-data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('['), dataJs.lastIndexOf(']') + 1);
const series = JSON.parse(json);

const routes = [
  '', 'about', 'library', 'contact',
  'topics/geopolitics-power',
  'topics/psychological-thrillers',
  'topics/money-economics',
];
series.forEach(s => {
  routes.push('series/' + s.id);
  (s.books || []).forEach(b => routes.push('book/' + b.id));
});

const langs = ['no', 'en', 'es'];
const urls = [];
for (const r of routes) {
  for (const lang of langs) {
    const prefix = lang === 'no' ? '' : '/' + lang;
    const loc = ORIGIN + prefix + (r ? '/' + r : '/');
    urls.push({ loc, lang, r });
  }
}

const body = urls.map(u => {
  const alts = langs.map(l => {
    const prefix = l === 'no' ? '' : '/' + l;
    const href = ORIGIN + prefix + (u.r ? '/' + u.r : '/');
    return `    <xhtml:link rel="alternate" hreflang="${l}" href="${href}"/>`;
  }).join('\n');
  return `  <url>\n    <loc>${u.loc}</loc>\n${alts}\n  </url>`;
}).join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
fs.writeFileSync(path.join(root, 'sitemap.xml'), xml);

fs.writeFileSync(path.join(root, 'robots.txt'),
  `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`);

console.log(`sitemap.xml: ${urls.length} urls (${routes.length} routes × ${langs.length} langs)`);
