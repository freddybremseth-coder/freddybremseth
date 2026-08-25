import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const samplesRoot = path.join(root, 'assets', 'samples');

const dataJs = fs.readFileSync(path.join(root, 'assets', 'books-data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('['), dataJs.lastIndexOf(']') + 1);
const series = JSON.parse(json);
const overridesPath = path.join(root, 'assets', 'sample-overrides.json');
const overrides = fs.existsSync(overridesPath) ? JSON.parse(fs.readFileSync(overridesPath, 'utf8')) : {};

const declared = new Map();
for (const s of series) {
  for (const b of s.books || []) {
    const sample = overrides[b.id] || b.samplePath;
    if (sample) declared.set(b.id, sample.replace(/^\//, ''));
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.toLowerCase().endsWith('.pdf') ? [full] : [];
  });
}

const physical = new Set(walk(samplesRoot).map((full) => path.relative(root, full).split(path.sep).join('/')));
const declaredPaths = new Set(declared.values());
const missingFiles = [...declared.entries()].filter(([, rel]) => !physical.has(rel));
const orphanFiles = [...physical].filter((rel) => !declaredPaths.has(rel));

console.log(`Sample audit: ${declared.size} books declare samples; ${physical.size} PDFs exist.`);
if (missingFiles.length) {
  console.error('Declared sample files missing:');
  for (const [slug, rel] of missingFiles) console.error(`- ${slug}: ${rel}`);
}
if (orphanFiles.length) {
  console.error('Sample PDFs without a book mapping:');
  for (const rel of orphanFiles) console.error(`- ${rel}`);
}
if (missingFiles.length || orphanFiles.length) process.exit(1);
console.log('Sample audit passed: every declared sample exists and every sample PDF is mapped.');
