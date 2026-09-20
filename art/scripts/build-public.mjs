import fs from 'node:fs';
import path from 'node:path';

// Vercel's static output must contain only files intended for public viewing.
// Keep serverless API handlers, build scripts, environment files and private
// source manifests in the project root, never in the published directory.
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'public');
const publicDirectories = ['assets', 'legal', 'verk', 'collections'];
const publicFiles = ['index.html', 'robots.txt', 'sitemap.xml'];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const directory of publicDirectories) {
  const source = path.join(root, directory);
  if (!fs.statSync(source).isDirectory()) throw Error('Missing public directory: ' + directory);
  fs.cpSync(source, path.join(output, directory), { recursive: true });
}
for (const file of publicFiles) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/catalog.json'), 'utf8'));
for (const item of catalog) {
  const page = path.join(output, 'verk', item.id, 'index.html');
  const image = path.join(output, item.image.replace(/^\//, ''));
  const thumb = path.join(output, item.thumb.replace(/^\//, ''));
  if (![page, image, thumb].every(file => fs.existsSync(file))) {
    throw Error('Missing published page or preview: ' + item.id);
  }
}
const curated = JSON.parse(fs.readFileSync(path.join(root, 'assets/collections.json'), 'utf8'));
for (const collection of curated.collections) {
  const page = path.join(output, 'collections', collection.id, 'index.html');
  if (!fs.existsSync(page) || !fs.readFileSync(page, 'utf8').includes('<h1>' + collection.name.replaceAll('&','&amp;') + '</h1>')) {
    throw Error('Missing or incorrect published collection page: ' + collection.id);
  }
}
if (fs.existsSync(path.join(output, 'api')) ||
    fs.existsSync(path.join(output, 'scripts')) ||
    fs.existsSync(path.join(output, 'private-originals'))) {
  throw Error('Non-public application files entered the static output');
}
console.log('PASS: Vercel public output contains ' + catalog.length + ' artwork pages, '+curated.collections.length+' dedicated collection pages and previews; server files excluded');
