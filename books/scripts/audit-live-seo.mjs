/**
 * Read-only public Books deployment smoke check. Build-time generated-page
 * tests can pass even while the live domain serves a legacy homepage fallback
 * for every book URL. Never claim those two independent states are equal.
 *
 * Only fixed, public, search-indexable pages on the known Books origin are
 * requested. No authentication, search queries, cookies, session URLs or
 * index-submission/write side effects are involved.
 */
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ORIGIN = 'https://books.freddybremseth.com';
export const LIVE_BOOK_PATHS = Object.freeze([
  '/es/book/birokt-og-oliven',
  '/es/book/fra-jord-til-bord',
  '/es/book/polyfenolens-kraft',
  '/en/book/the-facade-of-justice',
]);

export async function auditLiveBookPage(route, fetcher = fetch) {
  if (!LIVE_BOOK_PATHS.includes(route)) throw Error('Unapproved public book sample');
  const expectedCanonical = ORIGIN + route;
  let response;
  try {
    response = await fetcher(expectedCanonical, {
      method: 'GET', redirect: 'manual', cache: 'no-store',
      headers: { Accept: 'text/html', 'User-Agent': 'FreddyBooks-Public-SEO-Health/1.0' },
      signal: AbortSignal.timeout(9000),
    });
  } catch {
    return { route, status: 'unreachable' };
  }
  if (response.status !== 200) return { route, status: 'http_' + response.status };
  const type = response.headers.get('content-type') || '';
  if (!/^text\/html(?:;|$)/i.test(type)) return { route, status: 'not_html' };
  const size = Number(response.headers.get('content-length') || 0);
  if (size > 600000) return { route, status: 'response_too_large' };
  let html;
  try {
    html = await response.text();
  } catch {
    return { route, status: 'unreadable' };
  }
  if (html.length > 600000) return { route, status: 'response_too_large' };
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)]
    .find(tag => /\brel\s*=\s*(?:"canonical"|'canonical'|canonical)(?:\s|>)/i.test(tag[0]));
  const href = canonical?.[0].match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const actualCanonical = href && (href[1] || href[2] || href[3]);
  if (!actualCanonical) return { route, status: 'missing_canonical' };
  if (actualCanonical !== expectedCanonical) {
    return { route, status: actualCanonical === ORIGIN + '/' ? 'homepage_canonical_fallback' : 'wrong_canonical' };
  }
  if (!/<h1(?:\s|>)/i.test(html)) return { route, status: 'missing_initial_h1' };
  const title = html.match(/<title(?:\s[^>]*)?>([^<]*)<\/title>/i)?.[1]?.trim() || '';
  if (!title) return { route, status: 'missing_initial_title' };
  return { route, status: 'verified' };
}

async function main() {
  const results = await Promise.all(LIVE_BOOK_PATHS.map(route => auditLiveBookPage(route)));
  for (const item of results) console.log('Books public SEO ' + item.route + ': ' + item.status);
  if (results.some(item => item.status !== 'verified')) {
    console.error('Books live route check failed. Verify that books.freddybremseth.com is assigned to the independent Vercel project rooted at books/, not the repository-root legacy homepage fallback. Fix deployment assignment or rewrites before claiming public SEO is verified.');
    process.exitCode = 1;
  } else {
    console.log('PASS: sampled live book URLs serve their own canonical titles and initial HTML.');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
