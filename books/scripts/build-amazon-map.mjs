import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataJs = fs.readFileSync(path.join(root, 'assets/books-data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('['), dataJs.lastIndexOf(']') + 1);
const series = JSON.parse(json);

const rows = [];
for (const s of series) {
  for (const b of s.books || []) {
    if (!b.amazon) continue;
    const match = String(b.amazon).match(/\/dp\/([A-Z0-9]{10})(?:[/?#]|$)/i);
    rows.push({
      slug: b.id,
      title: b.title,
      series: s.id,
      amazon_url: b.amazon,
      asin: match ? match[1].toUpperCase() : null,
    });
  }
}
rows.sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(path.join(root, 'amazon-map.json'), JSON.stringify({ generated_at: new Date().toISOString(), count: rows.length, books: rows }, null, 2) + '\n');
console.log(`amazon-map.json: ${rows.length} explicit Amazon links`);
