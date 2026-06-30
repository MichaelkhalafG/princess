-- ============================================================================
-- Princess — 0003_catalog
-- Per DATABASE.md §2 (enum `listing_status`) & §3.2–§3.4 (categories, products,
-- product_variants), SYSTEM_ARCHITECTURE §8, CLAUDE_RULES §5 (RLS-first) / §6 (money).
-- Phase 1. Pure SQL, no app code. Idempotent-friendly.
--
-- Creates: listing_status enum; categories / products / product_variants;
-- indexes (every FK + every API_MAP filter/sort column); updated_at trigger on
-- products; RLS (public read of ACTIVE listings / owner CRUD) deny-by-default;
-- seeds the 5 product categories (SEED_DATA.md).
--
-- Money: numeric in DB; logic computes in integer minor units (CLAUDE_RULES §6).
-- `currency_code` enum + `public.set_updated_at()` come from 0001.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum (DATABASE.md §2 — created in 0003, its first use). Guarded.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.listing_status as enum ('draft', 'active', 'inactive', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. public.categories (DATABASE.md §3.2) — product/service taxonomy.
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid references public.categories (id),
  kind       text not null check (kind in ('product', 'service')),
  name_ar    text not null,
  name_en    text not null,
  slug       text not null unique,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------------
-- 3. public.products (DATABASE.md §3.3) — seller-owned catalog listing.
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.profiles (id) on delete cascade,
  category_id        uuid references public.categories (id),
  title              text not null,
  description        text,
  price              numeric(10, 2) not null check (price >= 0),
  currency           public.currency_code not null default 'SAR',
  is_rentable        boolean not null default false,
  rental_daily_price numeric(10, 2) check (rental_daily_price >= 0),
  security_deposit   numeric(10, 2) check (security_deposit >= 0),
  images             jsonb not null default '[]'::jsonb,            -- [{url,alt,sort}] (Supabase Storage)
  stock              int not null default 0 check (stock >= 0),
  status             public.listing_status not null default 'draft', -- public only when 'active'
  avg_rating         numeric(3, 2) not null default 0,               -- trigger-maintained (Phase 5)
  total_reviews      int not null default 0,                         -- trigger-maintained (Phase 5)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. public.product_variants (DATABASE.md §3.4) — size/color/stock per product.
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  size       text,
  color      text,
  stock      int not null default 0 check (stock >= 0),
  sku        text
);

-- ---------------------------------------------------------------------------
-- 5. Indexes — every FK + every API_MAP product filter/sort column (DATABASE.md
--    §3.2–3.4 + sort note). `slug` unique index is created by the column UNIQUE.
-- ---------------------------------------------------------------------------
create index if not exists categories_kind_idx        on public.categories (kind);
create index if not exists categories_parent_id_idx   on public.categories (parent_id);

create index if not exists products_category_status_idx on public.products (category_id, status);
create index if not exists products_seller_id_idx       on public.products (seller_id);
create index if not exists products_price_idx           on public.products (price);
create index if not exists products_status_idx          on public.products (status);
create index if not exists products_is_rentable_idx     on public.products (is_rentable);
create index if not exists products_created_at_idx      on public.products (created_at desc); -- "newest" sort
create index if not exists products_avg_rating_idx      on public.products (avg_rating desc); -- "top-rated" sort

create index if not exists product_variants_product_id_idx on public.product_variants (product_id);
create unique index if not exists product_variants_product_size_color_key
  on public.product_variants (product_id, size, color);

-- ---------------------------------------------------------------------------
-- 6. updated_at touch trigger on products (reuse the 0001 helper).
-- ---------------------------------------------------------------------------
drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- 7. RLS — enable (deny-by-default), then policies (CLAUDE_RULES §5, REQ-NFR-03/05).
-- ===========================================================================
alter table public.categories       enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;

-- 7a) categories — public read; writes via service-role (admin) only.
drop policy if exists categories_select_public on public.categories;
create policy categories_select_public
  on public.categories
  for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.categories from anon, authenticated;

-- 7b) products — public reads ACTIVE only; owner has full CRUD on own rows.
drop policy if exists products_select_active on public.products;
create policy products_select_active
  on public.products
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists products_owner_all on public.products;
create policy products_owner_all
  on public.products
  for all
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

-- anon never writes products (defense-in-depth beyond the authenticated-only owner policy).
revoke insert, update, delete on public.products from anon;

-- 7c) product_variants — public read where the PARENT product is active;
--     owner CRUD where they own the parent (no broad admin policy; admin = service-role).
drop policy if exists product_variants_select_active_parent on public.product_variants;
create policy product_variants_select_active_parent
  on public.product_variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.status = 'active'
    )
  );

drop policy if exists product_variants_owner_all on public.product_variants;
create policy product_variants_owner_all
  on public.product_variants
  for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_variants.product_id and p.seller_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.product_variants from anon;

-- ===========================================================================
-- 8. Seed product categories (SEED_DATA.md — 5 product categories). Keyed on
--    slug so the seed is safe to re-run.
-- ===========================================================================
insert into public.categories (kind, name_ar, name_en, slug, sort_order) values
  ('product', 'فساتين',          'Dresses',     'dresses',     1),
  ('product', 'أحذية',           'Shoes',       'shoes',       2),
  ('product', 'حقائب',           'Bags',        'bags',        3),
  ('product', 'إكسسوارات',       'Accessories', 'accessories', 4),
  ('product', 'مستحضرات تجميل',  'Cosmetics',   'cosmetics',   5)
on conflict (slug) do nothing;
