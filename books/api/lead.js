// POST /api/lead { name, email, book, locale?, source? } -> book_leads
// Captures the name+email before a sample-chapter download.
const { getSupabase, readBody } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { name, email, book, locale, source } = readBody(req);
  if (!email) return res.status(400).json({ error: 'email required' });
  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true, stored: false });
  // resolve the book slug to its id (book_titles.slug); tolerate missing catalog rows
  let book_id = null;
  if (book) {
    const { data } = await sb.from('book_titles').select('id').eq('slug', book).maybeSingle();
    if (data) book_id = data.id;
  }
  const { error } = await sb.from('book_leads')
    .insert({ book_id, name: name || null, email, locale: locale || 'no', source: source || 'sample' });
  if (error) return res.status(200).json({ ok: true, stored: false });
  return res.status(200).json({ ok: true, stored: true });
};
