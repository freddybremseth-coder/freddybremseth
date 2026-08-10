// POST /api/contact { name, email, message, locale? } -> book_contact_messages
const { getSupabase, readBody } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { name, email, message, locale } = readBody(req);
  if (!email || !message) return res.status(400).json({ error: 'email and message required' });
  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true, stored: false });
  const { error } = await sb.from('book_contact_messages')
    .insert({ name: name || null, email, message, locale: locale || 'no' });
  if (error) return res.status(200).json({ ok: true, stored: false });
  return res.status(200).json({ ok: true, stored: true });
};
