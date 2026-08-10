// POST /api/subscribe { email, name?, locale?, source? } -> book_subscribers
const { getSupabase, readBody } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { email, name, locale, source } = readBody(req);
  if (!email) return res.status(400).json({ error: 'email required' });
  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true, stored: false }); // pre-config no-op
  const { error } = await sb.from('book_subscribers')
    .upsert({ email, name: name || null, locale: locale || 'no', source: source || 'newsletter' },
            { onConflict: 'email', ignoreDuplicates: true });
  if (error) return res.status(200).json({ ok: true, stored: false });
  return res.status(200).json({ ok: true, stored: true });
};
