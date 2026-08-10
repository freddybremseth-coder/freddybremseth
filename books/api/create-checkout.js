// POST /api/create-checkout { bookId, kind?, locale? } -> { url }
// Creates a Stripe Checkout session for a €5 ebook (server sets the price).
// Requires STRIPE_SECRET_KEY and SITE_URL. Supabase is used (if configured)
// to resolve the book title/price and to record a pending order.
const { getSupabase, readBody } = require('./_supabase');

const SINGLE_CENTS = 500; // €5

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL || 'https://books.freddybremseth.com';
  if (!stripeKey) return res.status(400).json({ error: 'checkout_not_configured' });

  const { bookId, kind = 'single', locale = 'no' } = readBody(req);
  if (kind !== 'single') return res.status(400).json({ error: 'kind_not_supported' });
  if (!bookId) return res.status(400).json({ error: 'bookId required' });

  const stripe = require('stripe')(stripeKey);
  const sb = getSupabase();

  // resolve title + price + uuid from the catalog when available
  let name = bookId, amount = SINGLE_CENTS, bookUuid = null;
  if (sb) {
    const { data } = await sb.from('book_titles')
      .select('id,title,price_ebook_eur').eq('slug', bookId).maybeSingle();
    if (data) {
      name = data.title || name;
      bookUuid = data.id;
      if (data.price_ebook_eur) amount = Math.round(Number(data.price_ebook_eur) * 100);
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: amount,
          product_data: { name: 'E-bok: ' + name },
        },
      }],
      metadata: { bookId, kind, locale, bookUuid: bookUuid || '' },
      success_url: siteUrl + (locale === 'no' ? '' : '/' + locale) + '/book/' + bookId + '?purchase=success&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: siteUrl + (locale === 'no' ? '' : '/' + locale) + '/book/' + bookId + '?purchase=cancel',
    });

    if (sb) {
      await sb.from('book_orders').insert({
        email: 'pending@stripe', kind, book_id: bookUuid,
        amount: amount / 100, currency: 'EUR', status: 'pending',
        provider: 'stripe', provider_ref: session.id,
      });
    }
    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ error: 'stripe_error' });
  }
};
