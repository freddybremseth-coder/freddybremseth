// GET /api/download?session_id=... -> { url }
// Verifies a Stripe Checkout session is paid, then returns a short-lived signed
// URL to the purchased ebook in the private `book-ebooks` Storage bucket.
const { getSupabase } = require('./_supabase');

const BUCKET = 'book-ebooks';
const TTL_SECONDS = 3600; // signed URL valid 1 hour

module.exports = async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(400).json({ error: 'not_configured' });

  const sessionId = (req.query && req.query.session_id) ||
    (() => { try { return new URL(req.url, 'http://x').searchParams.get('session_id'); } catch (_) { return null; } })();
  if (!sessionId) return res.status(400).json({ error: 'session_id required' });

  const stripe = require('stripe')(stripeKey);
  let session;
  try { session = await stripe.checkout.sessions.retrieve(sessionId); }
  catch (_) { return res.status(404).json({ error: 'session_not_found' }); }
  if (!session || session.payment_status !== 'paid') return res.status(402).json({ error: 'not_paid' });

  const sb = getSupabase();
  if (!sb) return res.status(400).json({ error: 'not_configured' });

  const md = session.metadata || {};
  let query = sb.from('book_titles').select('ebook_file_path,title');
  query = md.bookUuid ? query.eq('id', md.bookUuid) : query.eq('slug', md.bookId);
  const { data } = await query.maybeSingle();
  if (!data || !data.ebook_file_path) return res.status(404).json({ error: 'file_missing' });

  const { data: signed, error } = await sb.storage.from(BUCKET)
    .createSignedUrl(data.ebook_file_path, TTL_SECONDS, { download: true });
  if (error || !signed) return res.status(500).json({ error: 'sign_failed' });

  return res.status(200).json({ url: signed.signedUrl, title: data.title });
};
