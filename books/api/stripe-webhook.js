// POST /api/stripe-webhook — marks orders paid on checkout.session.completed.
// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET. Raw body needed for
// signature verification, so body parsing is disabled below.
const { getSupabase } = require('./_supabase');

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !whSecret) return res.status(400).json({ error: 'webhook_not_configured' });

  const stripe = require('stripe')(stripeKey);
  let event;
  try {
    const buf = await rawBody(req);
    event = stripe.webhooks.constructEvent(buf, req.headers['stripe-signature'], whSecret);
  } catch (e) {
    return res.status(400).json({ error: 'signature' });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const sb = getSupabase();
    if (sb) {
      await sb.from('book_orders')
        .update({
          status: 'paid',
          email: (s.customer_details && s.customer_details.email) || 'unknown',
          download_expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        })
        .eq('provider_ref', s.id);
      // TODO: deliver the ebook PDF (email a signed Storage URL) once the
      // sellable PDFs are uploaded to Supabase Storage.
    }
  }
  return res.status(200).json({ received: true });
};

handler.config = { api: { bodyParser: false } };
module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
