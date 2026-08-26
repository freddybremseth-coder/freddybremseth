// GET /api/cover?id=<book-slug>
// Serves only explicitly allow-listed cover artwork from the private book-ebooks
// bucket. For Hvordan makt fungerer, the cover is extracted from the stored EPUB.
const { getSupabase } = require('./_supabase');
const JSZip = require('jszip');

const BUCKET = 'book-ebooks';
const COVERS = {
  'red-revolution': {
    file: 'Red_Revolution_KDP_Kindle_Cover_1600x2560.jpg',
    type: 'image/jpeg',
  },
  'the-cables-beneath-the-world': {
    file: 'The_Cables_Beneath_the_World_Cover_1600x2560.jpg',
    type: 'image/jpeg',
  },
  'hvordan-makt-fungerer': {
    epub: 'Hvordan_Makt_Fungerer_Freddy_Bremseth.epub',
  },
};

function mimeFor(name) {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
  const id = (req.query && req.query.id) || (() => {
    try { return new URL(req.url, 'http://x').searchParams.get('id'); }
    catch (_) { return null; }
  })();
  const cfg = COVERS[id];
  if (!cfg) return res.status(404).json({ error: 'cover_not_found' });

  const sb = getSupabase();
  if (!sb) return res.status(503).json({ error: 'not_configured' });

  try {
    if (cfg.file) {
      const { data, error } = await sb.storage.from(BUCKET).download(cfg.file);
      if (error || !data) return res.status(404).json({ error: 'cover_file_missing' });
      const buf = Buffer.from(await data.arrayBuffer());
      res.setHeader('Content-Type', cfg.type || data.type || mimeFor(cfg.file));
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(buf);
    }

    if (cfg.epub) {
      const { data, error } = await sb.storage.from(BUCKET).download(cfg.epub);
      if (error || !data) return res.status(404).json({ error: 'epub_missing' });
      const zip = await JSZip.loadAsync(Buffer.from(await data.arrayBuffer()));
      const names = Object.keys(zip.files);
      const preferred = names.find(n => /(^|\/)(cover|front[-_ ]?cover)\.(jpe?g|png|webp)$/i.test(n));
      const fallback = names.find(n => /cover.*\.(jpe?g|png|webp)$/i.test(n));
      const imageName = preferred || fallback;
      if (!imageName) return res.status(404).json({ error: 'embedded_cover_missing' });
      const image = await zip.file(imageName).async('nodebuffer');
      res.setHeader('Content-Type', mimeFor(imageName));
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).send(image);
    }

    return res.status(404).json({ error: 'cover_not_found' });
  } catch (_) {
    return res.status(500).json({ error: 'cover_error' });
  }
};
