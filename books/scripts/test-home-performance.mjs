import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appSource = fs.readFileSync(path.join(root, 'assets/books-app.js'), 'utf8');
const staticHome = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const injectors = fs.readFileSync(path.join(root, 'scripts/inject-sample-scripts.mjs'), 'utf8');

function renderAt(pathname) {
  const books = Array.from({ length: 27 }, (_, i) => ({
    id: i === 0 ? 'hvem-eier-virkeligheten' : 'test-book-' + i,
    title: 'Test Book ' + i,
    cover: 'assets/covers/cover-' + i + '.jpg',
    addedAt: i >= 24 ? '2026-09-' + String(i - 1).padStart(2, '0') + 'T10:00:00Z' : undefined,
    descFull: { no: 'Tekst', en: 'Text', es: 'Texto' },
  }));
  const series = [{ id: 'test-series', title: { no: 'Testserie', en: 'Test series', es: 'Serie de prueba' }, desc: { no: 'Beskrivelse', en: 'Description', es: 'Descripción' }, books }];
  const rootEl = {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  let domReady = null;
  const document = {
    title: '',
    documentElement: { lang: '' },
    addEventListener: (event, handler) => { if (event === 'DOMContentLoaded') domReady = handler; },
    getElementById: id => id === 'app' ? rootEl : null,
    querySelector: selector => selector === 'meta[name="description"]' ? { setAttribute() {} } : null,
  };
  const location = { pathname, search: '' };
  const window = { BOOKS_SERIES: series, BOOKS_L: {}, location, scrollTo() {} };
  vm.runInNewContext(appSource, { window, document, location, console, URLSearchParams, Date, Math });
  assert.equal(typeof domReady, 'function', 'The normal DOMContentLoaded entry point stays intact');
  domReady();
  return rootEl.innerHTML;
}

test('home in each supported language renders latest releases once without discarded featured cover', () => {
  for (const lang of ['/', '/en/', '/es/']) {
    const html = renderAt(lang);
    assert.equal((html.match(/class="gallery-item"/g) || []).length, 18, lang + ': bound homepage gallery');
    assert.equal((html.match(/class="book-cell"/g) || []).length, 3, lang + ': three latest releases');
    assert.ok(html.includes('Test Book 26') && html.includes('Test Book 25') && html.includes('Test Book 24'));
    assert.ok(!html.includes('class="featured"'), lang + ': no obsolete first featured image');
    assert.equal((html.match(/class="hero"/g) || []).length, 1, lang + ': hero preserved');
    assert.ok(html.includes('/library'), lang + ': full-catalogue navigation preserved');
    assert.ok(html.includes('loading="lazy" decoding="async" width="150" height="225"'), lang + ': cover dimensions');
  }
});

test('library keeps every book available instead of silently removing catalogue entries', () => {
  const html = renderAt('/library');
  assert.equal((html.match(/class="gallery-item"/g) || []).length, 27);
  assert.ok(html.includes('/book/test-book-26'));
});

test('book landing still renders a real book and its checkout control', () => {
  const html = renderAt('/en/book/test-book-26');
  assert.ok(html.includes('<h1>Test Book 26</h1>'));
  assert.ok(html.includes('data-buy="test-book-26"'));
  assert.ok(html.includes('/en/series/test-series'));
});

test('retired post-render latest script no longer ships in entry or injected generated HTML', () => {
  assert.ok(!staticHome.includes('src="/assets/books-latest.js"'));
  assert.ok(!injectors.includes("'<script src=\"/assets/books-latest.js\"></script>'"));
});
