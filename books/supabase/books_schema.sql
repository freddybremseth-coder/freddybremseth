-- ============================================================================
-- books.freddybremseth.com — author / book-catalog + commerce schema
-- Target: RealtyFlow Supabase project (ereapsfcsqtdmzosgnnn)
-- Run in the Supabase SQL editor. All objects prefixed `book_` so they coexist
-- safely with existing RealtyFlow tables in the public schema. Safe to re-run.
--
-- Model reflects the design handoff: 7 series, ~40 books, trilingual (no/en/es)
-- content, €5 direct ebook sales, 50% series-bundle / 65% all-books discounts,
-- Amazon print links, and free sample-chapter PDFs gated behind name+email.
-- ============================================================================

create or replace function public.book_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------------------------------------------------------------------------
-- 1. Series  (Michael Thorne, Elias Holm, Makten bak kulissene, Mediterraneo
--    Vital, Balanced Life, Let Me Explain It to You, Let Me Guide You)
-- ---------------------------------------------------------------------------
create table if not exists public.book_series (
  id              uuid primary key default gen_random_uuid(),
  slug            text unique not null,
  -- trilingual text stored as jsonb: {"no": "...", "en": "...", "es": "..."}
  title           jsonb not null,
  tag             jsonb,                 -- e.g. genre label per language
  description     jsonb,
  category        text,                  -- 'fiction' | 'nonfiction'
  cover_image_url text,                  -- series banner
  book_count      int,                   -- declared count (may exceed rows)
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. Books
-- ---------------------------------------------------------------------------
create table if not exists public.book_titles (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  series_id        uuid references public.book_series(id) on delete set null,
  series_number    int,
  title            text not null,               -- primary display title
  subtitle         jsonb,                        -- "Book One" / "Bok 1" per lang
  language         text not null default 'no',   -- original language of the work
  description_short jsonb,                        -- card-level (2-3 sentences)
  description_full  jsonb,                        -- detail-page (long form)
  excerpt          jsonb,                         -- pull-quote sample excerpt
  cover_image_url  text,
  sample_pdf_path  text,                          -- gated sample chapter
  word_count       int,
  page_count       int,
  isbn             text,
  price_ebook_eur  numeric(10,2) default 5.00,
  amazon_url       text,                          -- print edition (affiliate)
  ebook_file_path  text,                          -- sellable ebook (Storage)
  status           text not null default 'published', -- 'published'|'upcoming'|'placeholder'
  is_featured      boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists book_titles_series_idx on public.book_titles(series_id);
create index if not exists book_titles_status_idx on public.book_titles(status);

-- ---------------------------------------------------------------------------
-- 3. Sample-download leads (name+email captured to unlock a sample PDF)
-- ---------------------------------------------------------------------------
create table if not exists public.book_leads (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid references public.book_titles(id) on delete set null,
  name       text,
  email      text not null,
  locale     text default 'no',
  source     text,                    -- page/CTA that captured the lead
  created_at timestamptz not null default now()
);
create index if not exists book_leads_email_idx on public.book_leads(email);

-- ---------------------------------------------------------------------------
-- 4. Ebook orders  (€5 single / 50% series bundle / 65% all-books)
-- ---------------------------------------------------------------------------
create table if not exists public.book_orders (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  kind                text not null default 'single', -- 'single'|'series'|'all'
  book_id             uuid references public.book_titles(id) on delete set null,
  series_id           uuid references public.book_series(id) on delete set null,
  amount              numeric(10,2),
  currency            text default 'EUR',
  status              text not null default 'pending', -- 'pending'|'paid'|'delivered'|'refunded'
  provider            text,                            -- 'stripe' | 'paypal'
  provider_ref        text,
  download_token      uuid default gen_random_uuid(),
  download_expires_at timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists book_orders_email_idx on public.book_orders(email);

-- ---------------------------------------------------------------------------
-- 5. Newsletter subscribers
-- ---------------------------------------------------------------------------
create table if not exists public.book_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  name       text,
  locale     text default 'no',
  source     text,
  confirmed  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6. Contact messages
-- ---------------------------------------------------------------------------
create table if not exists public.book_contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null,
  message    text not null,
  locale     text default 'no',
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_book_series_updated on public.book_series;
create trigger trg_book_series_updated before update on public.book_series
  for each row execute function public.book_set_updated_at();
drop trigger if exists trg_book_titles_updated on public.book_titles;
create trigger trg_book_titles_updated before update on public.book_titles
  for each row execute function public.book_set_updated_at();

-- ============================================================================
-- Row Level Security
--   Catalog (series/books): public read, no public write.
--   Leads/orders/subscribers/messages: public INSERT only, never public read.
--   Server-side code uses the service_role key (bypasses RLS) for fulfillment.
-- ============================================================================
alter table public.book_series           enable row level security;
alter table public.book_titles           enable row level security;
alter table public.book_leads            enable row level security;
alter table public.book_orders           enable row level security;
alter table public.book_subscribers      enable row level security;
alter table public.book_contact_messages enable row level security;

create policy "book_series read" on public.book_series for select using (true);
create policy "book_titles read" on public.book_titles for select using (true);

create policy "book_leads insert"    on public.book_leads            for insert with check (true);
create policy "book_orders insert"   on public.book_orders           for insert with check (true);
create policy "book_subs insert"     on public.book_subscribers      for insert with check (true);
create policy "book_contact insert"  on public.book_contact_messages for insert with check (true);

-- ============================================================================
-- Seed data lives in books_seed.sql (7 series + 39 books, generated verbatim
-- from the design's seriesData). Run that file AFTER this one.
-- ============================================================================
