import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The portfolio root project has its OWN Vercel book-host rewrites. The
// separately deployed books/ project's cleanUrls configuration does not prove
// those rewrites serve per-title canonical HTML on the root Vercel project.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
const sitemap = fs.readFileSync(path.join(root, 'books/sitemap.xml'), 'utf8');
const origin = 'https://books.freddybremseth.com';
const langs = ['no', 'en', 'es'];
const routed = [
  'the-facade-of-justice', 'shadows-of-the-past', 'the-ascendants',
  'birokt-og-oliven', 'fra-jord-til-bord', 'polyfenolens-kraft',
];

function exactRoute(lang, slug) {
  return (lang === 'no' ? '' : '/' + lang) + '/book/' + slug;
}

function firstBookHostDestination(publicPath) {
  for (const item of config.routes || []) {
    if (!item.has?.some(entry => entry.type === 'host' && entry.value === 'books.freddybremseth.com')) continue;
    const re = new RegExp(item.src);
    if (re.test(publicPath)) return publicPath.replace(re, item.dest);
  }
  return null;
}

test('explicit book-host rewrites serve exact-language HTML for six sitemap titles', () => {
  for (const slug of routed) {
    for (const lang of langs) {
      const route = exactRoute(lang, slug);
      const canonical = origin + route;
      const expected = '/books/seo/' + lang + '/' + slug + '.html';
      assert.equal(firstBookHostDestination(route), expected, route + ' must not fall back to the books homepage');
      const file = path.join(root, expected.slice(1));
      assert.ok(fs.existsSync(file), 'No committed static landing for ' + route);
      const html = fs.readFileSync(file, 'utf8');
      assert.ok(html.includes('<link rel="canonical" href="' + canonical + '"'), 'Wrong canonical ' + route);
      assert.ok(html.includes('<meta property="og:url" content="' + canonical + '"'), 'Wrong OG URL ' + route);
      assert.ok(/<h1>[^<]+<\/h1>/.test(html), 'No crawlable title ' + route);
      assert.ok(/<meta name="description" content="[^\"]+"/.test(html), 'No crawlable description ' + route);
      assert.ok(html.includes('src="/assets/books-app.js"'), 'The interactive book UI is missing ' + route);
      for (const alternate of langs) {
        const href = origin + exactRoute(alternate, slug);
        assert.ok(html.includes('hreflang="' + alternate + '" href="' + href + '"'), 'Missing language alternate ' + route);
      }
      assert.ok(sitemap.includes('<loc>' + canonical + '</loc>'), 'Not in sitemap ' + route);
    }
  }
});
