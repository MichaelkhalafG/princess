-- ============================================================================
-- Princess — 0008_markets_pricing   ⚠️ PROPOSAL (CR-01 · CR-1A / Phase 1.5)
-- ----------------------------------------------------------------------------
-- Status: PROPOSAL for review. Authored per docs/CHANGE_REQUEST_01.md §A, §B, §E
-- (minimal), §G (all APPROVED 2026-07-01). NOT applied by Claude — you run
-- `pnpm exec supabase db push` then `pnpm db:types`. See the ROLLBACK block at the
-- foot of this file.
--
-- ⚠️ CLOSED-PHASE FOLLOW-UP: this alters tables shipped in closed phases —
--   `products` / `product_variants` (Phase 1, 0003_catalog.sql) and `profiles`
--   (Phase 0, 0001_foundation.sql). Only dummy seed data exists, so a clean cut is
--   safe (CR §7 R1). The dummy seed MUST be regenerated to the new shape afterward
--   (CR §7 R2 + scripts/seed-dummy.ts rewrite — see PHASE_1_5_TASKS.md Task 1.5.1).
--
-- Introduces regional MARKETS (EG/SA) as a first-class, locale-independent axis:
--   • market enum + attribute_input enum
--   • product_prices        — per-market price/stock/availability (replaces the
--                             single price/currency/stock on `products`)      [B]
--   • product_variant_stock — per-market variant stock (Q-B1)                 [B]
--   • vendor_markets        — seller/provider market declaration + approved
--                             local presence (role-agnostic, generalized for F)[B]
--   • attribute_definitions / attribute_options / product_attributes —
--                             controlled-vocabulary EAV powering faceted filters;
--                             seeds COLOR + SIZE to start (both multiselect)      [G]
--   • public_vendor_profiles (view) — narrow public seller block for detail    [E]
--   • profiles += market / country (buyer, self-settable) + is_verified
--                 (admin-set only; the KYC flow that SETS it lands in 0009)  [A/E]
--   • products  -= price / currency / rental_daily_price / security_deposit /
--                  stock   (moved to product_prices)                          [B]
--   • product_variants -= stock (moved to product_variant_stock)              [B]
--
-- Market ≠ currency ≠ locale: market governs VISIBILITY / shipping / COD; currency
-- is the money unit (fixed map EG→EGP, SA→SAR — lib/markets.ts); locale is ar/en.
-- The cross-market VISIBILITY filter lives in the QUERY layer
-- (features/catalog/queries.ts, `inner join product_prices … where market=:active`),
-- NOT in RLS — RLS cannot read the request cookie (CR §A.2, risk R3). RLS here only
-- enforces "is it public?" (parent active + row available).
--
-- Money: numeric in DB; app logic computes in integer minor units (CLAUDE_RULES §6).
-- `currency_code`, `user_role`, `profile_status`, `public.set_updated_at()` come
-- from 0001; `listing_status`, `products`, `product_variants` from 0003.
-- Pure SQL, no app code. Idempotent-friendly (guarded enums, IF (NOT) EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enums (DATABASE.md §2 — created here, their first use). Guarded.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.market as enum ('EG', 'SA');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.attribute_input as enum ('select', 'multiselect');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. profiles — buyer market + geo hint + verification badge (DATABASE.md §3.1).
--    Non-breaking ADDs. `market`/`country` are self-settable by the buyer (they
--    choose/switch their own market); `is_verified` is admin-set ONLY (no-escalation,
--    same posture as role/status in 0002) — the KYC review that flips it ships in
--    0009 (CR §C/§D). `profiles.role` becomes primary/display; real capability is
--    derived from approved applications in 0009 (Q-C1, REQ-VEND-05).
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists market      public.market,
  add column if not exists country     text,
  add column if not exists is_verified boolean not null default false;

-- Extend the existing 0002 column grant so a signed-in buyer can persist their own
-- market/geo (cookie is the primary store; profiles.market mirrors it when logged in).
-- is_verified is intentionally NOT granted → writable via service-role (admin) only.
grant update (market, country) on public.profiles to authenticated;

create index if not exists profiles_market_idx on public.profiles (market);

-- ---------------------------------------------------------------------------
-- 3. vendor_markets (CR §B.1) — a vendor (seller OR provider) declares the
--    markets they serve; covering a market requires an APPROVED local presence
--    (branch + local fulfillment/COD). Role-agnostic so F reuses it verbatim.
--    `is_approved` is set by admin (service-role) only.
-- ---------------------------------------------------------------------------
create table if not exists public.vendor_markets (
  id             uuid primary key default gen_random_uuid(),
  vendor_id      uuid not null references public.profiles (id) on delete cascade,
  market         public.market not null,
  branch_name    text,
  branch_address jsonb,                                   -- local fulfillment; coarse city surfaced publicly, full address PRIVATE
  is_approved    boolean not null default false,          -- admin confirms local presence (ties to KYC, 0009)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (vendor_id, market)
);

create index if not exists vendor_markets_vendor_id_idx      on public.vendor_markets (vendor_id);
create index if not exists vendor_markets_market_approved_idx on public.vendor_markets (market, is_approved);

drop trigger if exists set_vendor_markets_updated_at on public.vendor_markets;
create trigger set_vendor_markets_updated_at
  before update on public.vendor_markets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. product_prices (CR §B.1) — per-market money + base (no-variant) stock.
--    Replaces products.price/currency/rental_daily_price/security_deposit/stock.
--    One row per (product, market). Currency is derived from the market and stored
--    for money-row consistency; a CHECK enforces the EG→EGP / SA→SAR map (Q-B2).
-- ---------------------------------------------------------------------------
create table if not exists public.product_prices (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products (id) on delete cascade,
  market             public.market not null,
  currency           public.currency_code not null,
  price              numeric(10, 2) not null check (price >= 0),
  rental_daily_price numeric(10, 2) check (rental_daily_price >= 0),   -- required (app) when products.is_rentable
  security_deposit   numeric(10, 2) check (security_deposit >= 0),
  stock              int not null default 0 check (stock >= 0),        -- per-market base stock for products WITHOUT variants
  is_available       boolean not null default true,                    -- market-level toggle without deleting the price
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (product_id, market),
  -- Q-B2: currency must match the market map (deterministic, declarative).
  constraint product_prices_currency_matches_market
    check ((market = 'EG' and currency = 'EGP') or (market = 'SA' and currency = 'SAR'))
);

create index if not exists product_prices_product_id_idx     on public.product_prices (product_id);
create index if not exists product_prices_market_avail_idx    on public.product_prices (market, is_available);
create index if not exists product_prices_market_price_idx    on public.product_prices (market, price);  -- market-scoped price sort/filter

drop trigger if exists set_product_prices_updated_at on public.product_prices;
create trigger set_product_prices_updated_at
  before update on public.product_prices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. product_variant_stock (CR §B.1, Q-B1) — per-market variant stock. Each market
--    is a local branch with its own inventory. Resolved stock: a product WITH
--    variants → this table for the active market; WITHOUT variants → product_prices.stock.
-- ---------------------------------------------------------------------------
create table if not exists public.product_variant_stock (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  market     public.market not null,
  stock      int not null default 0 check (stock >= 0),
  unique (variant_id, market)
);

create index if not exists product_variant_stock_variant_id_idx on public.product_variant_stock (variant_id);
create index if not exists product_variant_stock_market_idx      on public.product_variant_stock (market);

-- ---------------------------------------------------------------------------
-- 6. Filterable attributes (CR §G.1) — controlled-vocabulary EAV so facets are
--    clean/indexable. Attributes are MARKET-AGNOSTIC (a property of the product,
--    not its market price). Admin-managed like `categories`.
-- ---------------------------------------------------------------------------
-- 6a) attribute_definitions — the attribute catalog (scoped to a category, or global).
create table if not exists public.attribute_definitions (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories (id) on delete cascade,  -- null = global (e.g. "Color")
  key_ar      text not null,
  key_en      text not null,
  slug        text not null unique,                                      -- facet key in the URL (e.g. `color`, `size`)
  input       public.attribute_input not null default 'select',
  sort_order  int not null default 0
);

create index if not exists attribute_definitions_category_id_idx on public.attribute_definitions (category_id);

-- 6b) attribute_options — the allowed values per attribute.
create table if not exists public.attribute_options (
  id           uuid primary key default gen_random_uuid(),
  attribute_id uuid not null references public.attribute_definitions (id) on delete cascade,
  value_ar     text not null,
  value_en     text not null,
  slug         text not null,                                            -- facet value in the URL
  sort_order   int not null default 0,
  unique (attribute_id, slug)
);

create index if not exists attribute_options_attribute_id_idx on public.attribute_options (attribute_id);

-- 6c) product_attributes — the product's chosen values (the EAV link; controlled).
create table if not exists public.product_attributes (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  attribute_id uuid not null references public.attribute_definitions (id) on delete cascade,
  option_id    uuid not null references public.attribute_options (id) on delete cascade,
  unique (product_id, option_id)
  -- NOTE (app-enforced): for a 'select' (single) attribute, at most one option per
  -- (product_id, attribute_id). Enforced in features/catalog/mutations.ts against the
  -- definition's `input`; a DB trigger is deferred (open item) since it must read the
  -- definition's input type. `multiselect` attributes intentionally allow several.
);

create index if not exists product_attributes_product_id_idx   on public.product_attributes (product_id);
create index if not exists product_attributes_attr_option_idx   on public.product_attributes (attribute_id, option_id);  -- facet lookups
create index if not exists product_attributes_option_id_idx     on public.product_attributes (option_id);

-- ---------------------------------------------------------------------------
-- 7. DROP the single-market money/stock from the closed-phase catalog tables.
--    Their data (dummy seed only) moves to product_prices / product_variant_stock.
--    Dropping `price` auto-drops products_price_idx (0003). `is_rentable` STAYS
--    (market-agnostic flag); per-market rental money now lives in product_prices.
-- ---------------------------------------------------------------------------
alter table public.products
  drop column if exists price,
  drop column if exists currency,
  drop column if exists rental_daily_price,
  drop column if exists security_deposit,
  drop column if exists stock;

alter table public.product_variants
  drop column if exists stock;

-- ===========================================================================
-- 8. RLS — enable (deny-by-default), then policies (CLAUDE_RULES §5, REQ-NFR-03/05).
--    Reads mirror 0003's "public sees ACTIVE listings" posture; the per-market
--    VISIBILITY narrowing is applied in the query layer, not here (CR §A.2).
-- ===========================================================================
alter table public.vendor_markets         enable row level security;
alter table public.product_prices          enable row level security;
alter table public.product_variant_stock   enable row level security;
alter table public.attribute_definitions   enable row level security;
alter table public.attribute_options       enable row level security;
alter table public.product_attributes      enable row level security;

-- 8a) vendor_markets — owner manages own declaration; `is_approved` NOT self-settable
--     (no-escalation: split policies + column grant). Admin approves via service-role.
--     No broad public read (branch_address is PII); public exposure is the narrow
--     public_vendor_profiles view (§10, security-definer).
drop policy if exists vendor_markets_select_own on public.vendor_markets;
create policy vendor_markets_select_own
  on public.vendor_markets for select to authenticated
  using (vendor_id = (select auth.uid()));

drop policy if exists vendor_markets_insert_own on public.vendor_markets;
create policy vendor_markets_insert_own
  on public.vendor_markets for insert to authenticated
  with check (vendor_id = (select auth.uid()) and is_approved = false);   -- can request, never self-approve

drop policy if exists vendor_markets_update_own on public.vendor_markets;
create policy vendor_markets_update_own
  on public.vendor_markets for update to authenticated
  using (vendor_id = (select auth.uid()))
  with check (vendor_id = (select auth.uid()));

drop policy if exists vendor_markets_delete_own on public.vendor_markets;
create policy vendor_markets_delete_own
  on public.vendor_markets for delete to authenticated
  using (vendor_id = (select auth.uid()));

revoke insert, update, delete on public.vendor_markets from anon;
-- Column-level: an owner may edit branch info but NOT is_approved (admin/service-role only).
revoke update on public.vendor_markets from authenticated;
grant  update (branch_name, branch_address) on public.vendor_markets to authenticated;

-- 8b) product_prices — public reads AVAILABLE rows of ACTIVE products; owner has full
--     CRUD on their product's prices RESTRICTED to markets they're APPROVED for.
drop policy if exists product_prices_select_public on public.product_prices;
create policy product_prices_select_public
  on public.product_prices for select to anon, authenticated
  using (
    is_available
    and exists (
      select 1 from public.products p
      where p.id = product_prices.product_id and p.status = 'active'
    )
  );

drop policy if exists product_prices_owner_all on public.product_prices;
create policy product_prices_owner_all
  on public.product_prices for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_prices.product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_prices.product_id and p.seller_id = (select auth.uid())
    )
    and exists (   -- may only price a market with an APPROVED local presence (B)
      select 1 from public.vendor_markets vm
      where vm.vendor_id = (select auth.uid())
        and vm.market = product_prices.market
        and vm.is_approved
    )
  );

revoke insert, update, delete on public.product_prices from anon;

-- 8c) product_variant_stock — public read where the parent product is active;
--     owner CRUD where they own the variant's product.
drop policy if exists product_variant_stock_select_active_parent on public.product_variant_stock;
create policy product_variant_stock_select_active_parent
  on public.product_variant_stock for select to anon, authenticated
  using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = product_variant_stock.variant_id and p.status = 'active'
    )
  );

drop policy if exists product_variant_stock_owner_all on public.product_variant_stock;
create policy product_variant_stock_owner_all
  on public.product_variant_stock for all to authenticated
  using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = product_variant_stock.variant_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = product_variant_stock.variant_id and p.seller_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.product_variant_stock from anon;

-- 8d) attribute_definitions / attribute_options — public read; writes service-role
--     (admin) only (same posture as `categories`, 0003 §7a).
drop policy if exists attribute_definitions_select_public on public.attribute_definitions;
create policy attribute_definitions_select_public
  on public.attribute_definitions for select to anon, authenticated using (true);

drop policy if exists attribute_options_select_public on public.attribute_options;
create policy attribute_options_select_public
  on public.attribute_options for select to anon, authenticated using (true);

revoke insert, update, delete on public.attribute_definitions from anon, authenticated;
revoke insert, update, delete on public.attribute_options     from anon, authenticated;

-- 8e) product_attributes — public read where the parent product is active; owner
--     CRUD via the product join; admin service-role.
drop policy if exists product_attributes_select_active_parent on public.product_attributes;
create policy product_attributes_select_active_parent
  on public.product_attributes for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_attributes.product_id and p.status = 'active'
    )
  );

drop policy if exists product_attributes_owner_all on public.product_attributes;
create policy product_attributes_owner_all
  on public.product_attributes for all to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_attributes.product_id and p.seller_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_attributes.product_id and p.seller_id = (select auth.uid())
    )
  );

revoke insert, update, delete on public.product_attributes from anon;

-- ===========================================================================
-- 9. public_vendor_profiles (view, CR §E) — the NARROW public seller/vendor block
--    for product/service detail. SECURITY DEFINER (security_invoker = false) so it
--    can expose ONLY these public columns across RLS, without a broad public read of
--    `profiles`/`vendor_markets` (which hold PII). DATABASE.md §3.1 anticipates this.
--    Full rating rollup arrives with `reviews` (Phase 5); avg_rating/total_reviews
--    are per-vendor aggregates added then — omitted here to avoid dead reference.
-- ===========================================================================
drop view if exists public.public_vendor_profiles;
create view public.public_vendor_profiles
  with (security_invoker = false) as
select
  p.id                                             as vendor_id,
  p.full_name                                      as display_name,
  p.avatar_url,
  p.is_verified,
  p.created_at                                     as member_since,
  coalesce(
    array_agg(vm.market order by vm.market) filter (where vm.is_approved),
    '{}'::public.market[]
  )                                                as markets,
  coalesce(
    array_agg(distinct (vm.branch_address ->> 'city')) filter (
      where vm.is_approved and (vm.branch_address ->> 'city') is not null
    ),
    '{}'::text[]
  )                                                as cities
from public.profiles p
left join public.vendor_markets vm on vm.vendor_id = p.id
group by p.id, p.full_name, p.avatar_url, p.is_verified, p.created_at;

grant select on public.public_vendor_profiles to anon, authenticated;

-- ===========================================================================
-- 10. Seed the launch attribute vocabulary — COLOR + SIZE (controlled facets),
--     keyed on slug so it is safe to re-run — mirrors the category seed in 0003 §8.
--     Both are `multiselect` (a product is offered in several colors/sizes → each is
--     a facetable option). Sellers PICK from these options (no free text → clean
--     facets). Admin extends the vocabulary via /api/admin/attributes (REQ-DASH-05);
--     category-scoped attributes (e.g. numeric shoe sizes) can be added later.
--     Global (category_id null) to start. Size codes are locale-neutral (XS…XXL).
-- ===========================================================================
insert into public.attribute_definitions (category_id, key_ar, key_en, slug, input, sort_order) values
  (null, 'اللون',  'Color', 'color', 'multiselect', 1),
  (null, 'المقاس', 'Size',  'size',  'multiselect', 2)
on conflict (slug) do nothing;

insert into public.attribute_options (attribute_id, value_ar, value_en, slug, sort_order)
select d.id, v.value_ar, v.value_en, v.slug, v.sort_order
from public.attribute_definitions d
join (values
  ('color', 'أسود',       'Black',   'black',   1),
  ('color', 'أبيض',       'White',   'white',   2),
  ('color', 'وردي',       'Rose',    'rose',    3),
  ('color', 'ذهبي',       'Gold',    'gold',    4),
  ('color', 'كحلي',       'Navy',    'navy',    5),
  ('color', 'بيج',        'Beige',   'beige',   6),
  ('color', 'أحمر',       'Red',     'red',     7),
  ('color', 'أخضر زمردي', 'Emerald', 'emerald', 8),
  ('size',  'XS',         'XS',      'xs',      1),
  ('size',  'S',          'S',       's',       2),
  ('size',  'M',          'M',       'm',       3),
  ('size',  'L',          'L',       'l',       4),
  ('size',  'XL',         'XL',      'xl',      5),
  ('size',  'XXL',        'XXL',     'xxl',     6)
) as v(def_slug, value_ar, value_en, slug, sort_order) on v.def_slug = d.slug
on conflict (attribute_id, slug) do nothing;

-- ============================================================================
-- ROLLBACK NOTES (manual — no automatic down-migration; dev-only data)
-- ----------------------------------------------------------------------------
-- This migration is destructive to closed-phase columns. Rolling back RE-ADDS the
-- dropped columns but CANNOT restore their values (they were moved to the new
-- tables); dummy seed is disposable, so re-run `pnpm seed:reset` after either
-- direction. To revert:
--
--   -- 1. restore the single-market columns on the catalog tables
--   alter table public.products
--     add column if not exists price numeric(10,2) not null default 0 check (price >= 0),
--     add column if not exists currency public.currency_code not null default 'SAR',
--     add column if not exists rental_daily_price numeric(10,2) check (rental_daily_price >= 0),
--     add column if not exists security_deposit numeric(10,2) check (security_deposit >= 0),
--     add column if not exists stock int not null default 0 check (stock >= 0);
--   create index if not exists products_price_idx on public.products (price);
--   alter table public.product_variants
--     add column if not exists stock int not null default 0 check (stock >= 0);
--
--   -- 2. drop the new objects (view first, then tables, then enums)
--   drop view  if exists public.public_vendor_profiles;
--   drop table if exists public.product_attributes;
--   drop table if exists public.attribute_options;
--   drop table if exists public.attribute_definitions;
--   drop table if exists public.product_variant_stock;
--   drop table if exists public.product_prices;
--   drop table if exists public.vendor_markets;
--
--   -- 3. revert profiles additions
--   alter table public.profiles
--     drop column if exists is_verified,
--     drop column if exists country,
--     drop column if exists market;
--
--   -- 4. drop the enums LAST (only once nothing references them)
--   drop type if exists public.attribute_input;
--   drop type if exists public.market;
--
-- Then regenerate types (`pnpm db:types`) and re-seed.
-- ============================================================================
