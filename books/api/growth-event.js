const { getSupabase, readBody } = require('./_supabase');

const ALLOWED_EVENTS = new Set([
  'book_view',
  'amazon_click',
  'sample_click',
  'direct_buy_click',
  'topic_to_book_click',
  'series_to_book_click',
]);

function text(value, max = 500) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const body = readBody(req);
  const eventType = text(body.eventType, 64);
  const bookSlug = text(body.bookSlug, 160);
  if (!eventType || !ALLOWED_EVENTS.has(eventType)) return res.status(400).json({ error: 'invalid_event_type' });
  if (!bookSlug) return res.status(400).json({ error: 'book_slug_required' });

  const sb = getSupabase();
  if (!sb) return res.status(204).end();

  const { data: book, error: lookupError } = await sb
    .from('book_titles')
    .select('id,series_id,slug')
    .eq('slug', bookSlug)
    .maybeSingle();

  if (lookupError) return res.status(500).json({ error: 'lookup_failed' });
  if (!book) return res.status(404).json({ error: 'book_not_found' });

  const row = {
    book_id: book.id,
    book_slug: book.slug,
    series_id: book.series_id,
    event_type: eventType,
    locale: text(body.locale, 8),
    path: text(body.path, 500),
    referrer: text(body.referrer, 1000),
    utm_source: text(body.utmSource, 200),
    utm_medium: text(body.utmMedium, 200),
    utm_campaign: text(body.utmCampaign, 300),
    utm_content: text(body.utmContent, 300),
    utm_term: text(body.utmTerm, 300),
    metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
      ? body.metadata
      : {},
  };

  const { error } = await sb.from('book_growth_events').insert(row);
  if (error) return res.status(500).json({ error: 'insert_failed' });
  return res.status(204).end();
};
