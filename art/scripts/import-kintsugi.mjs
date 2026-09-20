// Import the ten individually uploaded, public-size Kintsugi gallery previews.
// The sale-ready PNG and upscaled masters must never enter this public build.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(root, 'import-packs');
const previewDir = path.join(root, 'assets', 'art');
const catalogPath = path.join(root, 'assets', 'catalog.json');
const collectionsPath = path.join(root, 'assets', 'collections.json');
const manifestPath = path.join(root, 'assets', 'kintsugi-import-manifest.json');
const originals = [
  ['the-golden-man', 'The Golden Man', 'Even ruins hold their crown.', '01_the_golden_man.webp', 'A crowned man and his raven, with gold-filled fractures across porcelain and skin.'],
  ['autumn-queen', 'Autumn Queen', 'I let the old leaves fall.', '02_autumn_queen.webp', 'Golden oak leaves and pomegranates accompany a portrait about change and release.'],
  ['moon-phases', 'Moon Phases', 'Made of the same dust as stars.', '03_moon_phases.webp', 'A celestial portrait with moon phases, indigo shadows and stardust in the gilded seams.'],
  ['child-of-the-sea', 'Child of the Sea', 'The sea taught me to break gently.', '04_child_of_the_sea.webp', 'Cobalt waves, porcelain fragments and coral-like gold seams evoke the sea.'],
  ['the-wise-woman', 'The Wise Woman', 'Every line a map of surviving.', '05_the_wise_woman.webp', 'Silver hair and gilded lines honour a lifetime of experience and resilience.'],
  ['spring-goddess', 'Spring Goddess', 'Bloom where they tried to bury you.', '06_spring_goddess.webp', 'Magnolias and peonies surround a portrait of renewal in cream and gold.'],
  ['winter-frost', 'Winter Frost', 'Still standing in the cold.', '07_winter_frost.webp', 'A winter portrait with icy porcelain fractures and a white-blue palette.'],
  ['phoenix', 'Phoenix', 'Rise gilded from the ash.', '08_phoenix.webp', 'Fire, feathers and gold emerge from ash in a portrait of rebirth.'],
  ['mother-and-child', 'Mother and Child', 'Broken open, I learned to hold.', '09_mother_and_child.webp', 'Two figures joined by shared gilded seams in an intimate embrace.'],
  ['the-golden-heart', 'The Golden Heart', 'Held together by what tried to break me.', '10_the_golden_heart.webp', 'A broken porcelain heart repaired with gold, among flowers and moths.'],
];
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const curation = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
const style = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'styles.json'), 'utf8'))
  .find(entry => entry.id === 'symbolic-realism');
if (!style || !curation.collections.some(c => c.id === 'human-condition')) {
  throw Error('Required approved Kintsugi style or collection missing');
}
const manifest = originals.map(([slug, title, quote, filename, description]) => ({
  id: 'kintsugi-2026-' + slug, title, quote, filename, description,
  style_id: 'symbolic-realism', collection_id: 'human-condition'
}));
const existing = new Set(catalog.map(a => a.id));
const already = manifest.filter(a => existing.has(a.id)).length;
if (already !== 0 && already !== manifest.length) {
  throw Error('Only part of the 10-work Kintsugi collection exists in the catalogue');
}
for (const art of manifest) {
  const source = path.join(sourceDir, art.filename);
  if (!fs.existsSync(source)) throw Error('Missing individual Kintsugi preview: ' + art.filename);
  const bytes = fs.readFileSync(source);
  if (bytes.length < 10000 || bytes.length > 4000000 ||
      bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw Error('Invalid public WebP preview: ' + art.filename);
  }
}
fs.mkdirSync(previewDir, {recursive:true});
let number = Math.max(...catalog.map(a => a.number));
for (const art of manifest) {
  const source = path.join(sourceDir, art.filename);
  const preview = '/assets/art/' + art.id + '-view.webp';
  const thumbnail = '/assets/art/' + art.id + '-thumb.webp';
  for (const name of [preview, thumbnail]) {
    const target = path.join(root, name.substring(1));
    if (fs.existsSync(target)) {
      if (!fs.readFileSync(target).equals(fs.readFileSync(source))) {
        throw Error('Existing artwork preview differs: ' + name);
      }
    } else {
      fs.copyFileSync(source, target);
    }
  }
  curation.byArtworkId[art.id] = 'human-condition';
  if (already) continue;
  catalog.push({
    id: art.id, title: art.title, category: style.name,
    story: art.description + ' “' + art.quote + '”',
    image: preview, thumb: thumbnail, orientation: 'Portrait',
    width: 1122, height: 1402, number: ++number,
    edition: 'Gallery preview — edition not yet available',
    price_cents: null, currency: 'eur', print_url: '',
    style_id: style.id, style_description: style.description,
    digital_available: false
  });
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
fs.writeFileSync(collectionsPath, JSON.stringify(curation, null, 2) + '\n');
console.log('KINTSUGI_IMPORT_ADDED', already ? 0 : manifest.length,
  'TOTAL', catalog.length, 'PREVIEW_ONLY', manifest.length);
