// Build-time contract for the actual books/ Vercel project. Never infer
// success from a sibling repository-root vercel.json or ungenerated .html files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://books.freddybremseth.com';
const langs = ['no', 'en', 'es'];
const source = fs.readFileSync(path.join(root, 'assets/books-data.js'), 'utf8');
const start = source.indexOf('[', source.indexOf('window.BOOKS_SERIES'));
const end = source.lastIndexOf(']');
if (start < 0 || end <= start) throw Error('Book catalog is missing');
const series = JSON.parse(source.slice(start, end + 1));
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

const getPath = (lang, route) =>
  (lang === 'no' ? '' : '/' + lang) + (route ? '/' + route : '/');
const getFile = (lang, route) =>
  path.join(root, ...(lang === 'no' ? [] : [lang]), route ? route + '.html' : 'index.html');
const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let pages = 0, bookPages = 0, seriesPages = 0;
const seen = new Set();
function checkPage(lang, route, label, isBook = false) {
  const publicPath = getPath(lang, route);
  const url = origin + publicPath;
  const file = getFile(lang, route);
  if (seen.has(publicPath)) throw Error('Duplicate public SEO route ' + publicPath);
  seen.add(publicPath);
  if (!fs.existsSync(file)) throw Error('No generated HTML for ' + publicPath);
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('<link rel="canonical" href="' + url + '"')) {
    throw Error('Wrong exact canonical for ' + publicPath);
  }
  if (!html.includes('<meta property="og:url" content="' + url + '"')) {
    throw Error('Wrong OG URL for ' + publicPath);
  }
  if (!html.includes('<link rel="alternate" hreflang="' + lang + '" href="' + url + '"')) {
    throw Error('Missing local hreflang for ' + publicPath);
  }
  if (!html.includes('<title>') || !/<meta name="description" content="[^"]+"/.test(html)) {
    throw Error('Missing crawlable title or description for ' + publicPath);
  }
  if (!html.includes('<h1>') || !html.includes('/assets/books-app.js') ||
      !html.includes('/assets/books-data.js') ||
      !html.includes('/assets/books-sample-links.js')) {
    throw Error('SEO HTML missing readable body or expected runtime for ' + publicPath);
  }
  // Every generated, indexable book/series/language HTML page has exactly one
  // bounded public referrer tracker; never add this to API or checkout pages.
  if (html.split('src="/assets/seo-referral-tracker.js"').length - 1 !== 1) {
    throw Error('Public book SEO route missing unique source tracker ' + publicPath);
  }
  if (!sitemap.includes('<loc>' + url + '</loc>')) {
    throw Error('Generated SEO route missing from sitemap ' + publicPath);
  }
  for (const alternate of langs) {
    const alternateUrl = origin + getPath(alternate, route);
    if (!html.includes('<link rel="alternate" hreflang="' + alternate +
        '" href="' + alternateUrl + '"')) throw Error('Missing reciprocal hreflang ' + publicPath);
  }
  if (isBook) {
    if (!html.includes('<h1>' + escapeHtml(label) + '</h1>')) {
      throw Error('Book landing page title is not in initial HTML ' + publicPath);
    }
    const json = html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/);
    if (!json) throw Error('Book schema absent for ' + publicPath);
    let book;
    try { book = JSON.parse(json[1]); } catch { throw Error('Invalid Book schema for ' + publicPath); }
    if (book['@type'] !== 'Book' || book.name !== label || book.url !== url) {
      throw Error('Wrong Book schema URL/name ' + publicPath);
    }
    bookPages++;
  }
  pages++;
}
for (const lang of langs) {
  for (const route of ['', 'about', 'library', 'contact']) checkPage(lang, route);
  for (const s of series) {
    checkPage(lang, 'series/' + s.id, s.id); seriesPages++;
    for (const b of s.books || []) checkPage(lang, 'book/' + b.id, b.title, true);
  }
}
if (bookPages < 9 || seriesPages < 3) throw Error('Incomplete catalog prerender');
console.log('PASS books SEO: ' + pages + ' verified per-route HTML documents; ' +
  bookPages + ' individual book pages; ' + seriesPages +
  ' series pages; exact canonical, OG, reciprocal language URLs, sitemap, Book JSON-LD and JS app preserved.');
