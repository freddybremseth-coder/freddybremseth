// Lazy service-role Supabase client (server-side only — bypasses RLS).
// Configure SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the Vercel project.
const { createClient } = require('@supabase/supabase-js');

let client = null;
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null; // not configured yet — callers no-op gracefully
  if (!client) client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

module.exports = { getSupabase, readBody };
