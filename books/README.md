# books.freddybremseth.com

Trilingual (🇳🇴/🇬🇧/🇪🇸) author site for Freddy Bremseth — 7 series, 39 books,
€5 direct ebook sales (Stripe), Amazon print links, and free sample chapters
gated behind name+email. Built from the Claude Design handoff.

Lives in the same GitHub repo as `freddybremseth.com` but deploys as its **own
Vercel project rooted at `books/`**, so the live main site config is untouched.

## Stack
- **Frontend:** static `index.html` shell + vanilla JS (`assets/books-app.js`)
  that renders 6 views from `assets/books-data.js` (catalog) and
  `assets/books-i18n.js` (UI strings). Real per-language URLs: `/`, `/en/…`, `/es/…`.
- **API:** Vercel serverless functions in `api/` (Node).
- **Data:** RealtyFlow Supabase (tables prefixed `book_`).
- **Payments:** Stripe Checkout.

## Routes
`/` · `/about` · `/library` · `/series/:slug` · `/book/:slug` · `/contact`
(+ `/en/…`, `/es/…`). SPA fallback + security/cache headers in `vercel.json`.

## Deploy (one-time)

1. **Database** — in the RealtyFlow Supabase SQL editor, run:
   1. `supabase/books_schema.sql` (tables + RLS)
   2. `supabase/books_seed.sql` (7 series + 39 books)
2. **Vercel project** — New Project → import this GitHub repo →
   set **Root Directory = `books`** → deploy.
3. **Domain** — add `books.freddybremseth.com` to that Vercel project.
   Create the DNS record Vercel shows (a `CNAME` `books → cname.vercel-dns.com`).
4. **Environment variables** (Vercel project → Settings → Environment Variables):

   | Var | Purpose |
   |-----|---------|
   | `SUPABASE_URL` | RealtyFlow project URL (`https://ereapsfcsqtdmzosgnnn.supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | server-side inserts (bypasses RLS) |
   | `STRIPE_SECRET_KEY` | Stripe Checkout |
   | `STRIPE_WEBHOOK_SECRET` | verifies the webhook |
   | `SITE_URL` | `https://books.freddybremseth.com` |

5. **Stripe webhook** — add endpoint `…/api/stripe-webhook`, event
   `checkout.session.completed`, and paste its signing secret into
   `STRIPE_WEBHOOK_SECRET`.

The site is fully functional **before** step 4/5: sample downloads, newsletter,
and contact degrade gracefully (they no-op without Supabase), and the ebook
button shows a "coming soon" alert until Stripe is configured.

## Ebook delivery (direct download)
After payment, Stripe redirects to `/book/:slug?purchase=success&session_id=…`.
The page shows a **Download the ebook** button that calls `GET /api/download`,
which verifies the session is paid and returns a 1-hour signed URL to the file
in the **private** Supabase Storage bucket `book-ebooks`.

To enable it:
1. Create a **private** Storage bucket named `book-ebooks` (Public = off).
2. Upload one PDF per book, named by slug, e.g. `the-facade-of-justice.pdf`.
3. Set the path on each row: `update public.book_titles set ebook_file_path = '<slug>.pdf' where slug = '<slug>';`

Samples need no bucket — they are served statically from `books/assets/samples/`.

## Still needed to be 100% complete
- **Sellable ebook PDFs** — the bundle only shipped *sample* chapters. Upload the
  full ebooks to the `book-ebooks` bucket and set `book_titles.ebook_file_path`
  (see "Ebook delivery" above).
- **Amazon URLs** per book (currently print button is a placeholder).
- **EN/ES translations** for the Norwegian-only newer entries (Elias Holm,
  parts of Mediterraneo Vital / Balanced Life). Content lives in
  `assets/books-data.js` and `books_seed.sql`.

## Regenerate the sitemap
```bash
cd books && node scripts/build-sitemap.mjs
```
