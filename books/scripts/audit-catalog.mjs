import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const dataJs = fs.readFileSync(path.join(root, 'assets/books-data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('['), dataJs.lastIndexOf(']') + 1);
const series = JSON.parse(json);

const langs = ['no', 'en', 'es'];
const rows = [];
let total = 0;

for (const s of series) {
  for (const b of s.books || []) {
    total++;
    const issues = [];
    if (!b.amazon) issues.push('missing_amazon_url');
    if (!b.cover) issues.push('missing_cover');
    if (!b.samplePath) issues.push('missing_sample');
    if (!b.descShort) issues.push('missing_desc_short');
    if (!b.descFull) issues.push('missing_desc_full');

    for (const lang of langs) {
      if (b.descShort && typeof b.descShort === 'object' && !b.descShort[lang]) issues.push(`missing_desc_short_${lang}`);
      if (b.descFull && typeof b.descFull === 'object' && !b.descFull[lang]) issues.push(`missing_desc_full_${lang}`);
    }

    if (!b.words) issues.push('missing_word_count');
    if (!b.pages) issues.push('missing_page_count');

    rows.push({ series: s.id, book: b.id, title: b.title, issues });
  }
}

const counts = {};
for (const row of rows) for (const issue of row.issues) counts[issue] = (counts[issue] || 0) + 1;
const unhealthy = rows.filter(r => r.issues.length);

const report = {
  generatedAt: new Date().toISOString(),
  totalBooks: total,
  healthyBooks: total - unhealthy.length,
  booksWithIssues: unhealthy.length,
  issueCounts: counts,
  books: unhealthy,
};

const outDir = path.join(root, 'reports');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'catalog-audit.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`Catalog audit: ${total} books, ${unhealthy.length} with issues.`);
for (const [issue, count] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(3)}  ${issue}`);
}

if (process.env.CATALOG_AUDIT_STRICT === 'true' && unhealthy.length) process.exitCode = 1;
