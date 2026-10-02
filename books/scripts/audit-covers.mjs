// Validate every configured book/series image before deployment.
// Missing covers remain honest title-card placeholders until original art arrives.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const context = vm.createContext({ window: {} });
for (const file of ['books-data.js', 'books-extra.js', 'books-catalog-fixes.js']) {
  const source = fs.readFileSync(path.join(assets, file), 'utf8');
  vm.runInContext(source, context, { filename: file, timeout: 2000 });
}
const series = context.window.BOOKS_SERIES || [];
const knownRemoteCovers = new Set(['red-revolution', 'the-cables-beneath-the-world', 'hvordan-makt-fungerer']);
const problems = [];
const unillustrated = [];
let staticCount = 0;
let dynamicCount = 0;
let totalBooks = 0;

function checkCover(cover, identity) {
  if (!cover) {
    unillustrated.push(identity);
    return;
  }
  if (cover.startsWith('api/cover?')) {
    const url = new URL(cover, 'https://books.freddybremseth.com/');
    if (url.pathname !== '/api/cover' || !knownRemoteCovers.has(url.searchParams.get('id'))) {
      problems.push(identity + ': unsupported remote cover ' + cover);
    }
    dynamicCount++;
    return;
  }
  if (!/^assets\/covers\/[a-zA-Z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(cover)) {
    problems.push(identity + ': invalid cover path ' + cover);
    return;
  }
  const file = path.join(root, cover);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile() || fs.statSync(file).size < 1000) {
    problems.push(identity + ': missing or empty file ' + cover);
  }
  staticCount++;
}
for (const s of series) {
  checkCover(s.cover, 'series/' + s.id);
  for (const b of s.books || []) {
    totalBooks++;
    checkCover(b.cover, 'book/' + b.id);
  }
}
for (const [id, file] of [
  ['arms-power', 'assets/covers/arms-power.png'],
  ['lev-100-ar', 'assets/covers/lev-100-ar.jpg'],
]) {
  const book = series.flatMap(s => s.books || []).find(b => b.id === id);
  if (!book || book.cover !== file) problems.push(id + ': existing cover was not linked');
}
console.log('Cover audit: ' + totalBooks + ' books; ' + staticCount + ' local covers; ' + dynamicCount +
  ' API covers (availability not checked); ' + unillustrated.length + ' awaiting original artwork.');
if (unillustrated.length) console.log('Title-card placeholders: ' + unillustrated.join(', '));
if (problems.length) {
  console.error('Broken cover references:\n' + problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('PASS: all configured local cover files exist and remote cover IDs are recognized');
}
