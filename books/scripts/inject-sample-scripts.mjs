import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git'].includes(entry.name)) return [];
      return walk(full);
    }
    return entry.isFile() && entry.name.endsWith('.html') ? [full] : [];
  });
}

let changed = 0;
for (const file of walk(root)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  if (html.includes('/assets/books-data.js') && !html.includes('/assets/sample-overrides.js')) {
    html = html.replace(
      '<script src="/assets/books-data.js"></script>',
      '<script src="/assets/books-data.js"></script>\n  <script src="/assets/sample-overrides.js"></script>',
    );
  }
  if (html.includes('/assets/books-app.js') && !html.includes('/assets/books-sample-links.js')) {
    html = html.replace(
      '<script src="/assets/books-app.js"></script>',
      '<script src="/assets/books-app.js"></script>\n  <script src="/assets/books-sample-links.js"></script>',
    );
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}

console.log(`Sample scripts verified/injected in generated HTML (${changed} files changed).`);
