-- ============================================================================
-- Princess — 0002_rls_and_settings
-- Per CLAUDE_RULES §5 (security/RLS) & §6 (money), DATABASE.md §3.1/§3.19/§3.20/§6,
-- PROJECT_ANALYSIS Business Rules (BR-2..BR-5), Conflicts C7/C10. Phase 0.
--
-- A) RLS policies on public.profiles (RLS was ENABLED in 0001).
-- B) public.platform_settings (commissions, BR-4) + public.platform_upfront_fees
--    (per offering_type × currency, integer MINOR UNITS — C7/C10) + RLS + seed.
--
-- Money: numeric in DB; commission as percent numeric; upfront fees as integer
-- minor units. Logic always computes in integer minor units (CLAUDE_RULES §6).
-- Idempotent-friendly. No app code.
-- ============================================================================

-- ===========================================================================
-- A) public.profiles — RLS policies (REQ-AUTH-06, REQ-NFR-03/05)
-- ===========================================================================

-- SELECT: a user can read only their own row.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

-- UPDATE: a user can update only their own row.
-- Column-level write restriction (below) is what prevents privilege escalation:
-- role/status/email/id/provider_type are NOT in the grant, so an end user cannot
-- change them — only the service-role (admin, bypasses RLS) can.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No-privilege-escalation via Postgres column privileges (deterministic, declarative).
-- End users may write ONLY these columns; role/status/email/id/provider_type are
-- writable solely through the service-role client (admin ops). The set_updated_at
-- trigger still maintains updated_at (trigger writes are not subject to the
-- invoker's column grants).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, avatar_url, locale) on public.profiles to authenticated;

-- NOTE (deferred): a narrow public-read policy exposing only minimal public fields
-- of provider/seller profiles (for catalog listings, DATABASE.md §3.1) is added in
-- the phase that needs it (Phase 1/4) via a column-limited view — NOT a broad
-- profiles read policy. Admin full access is via the service-role client only
-- (no public admin policy here). A reusable SECURITY DEFINER role helper
-- (e.g. public.current_profile_role()) will be introduced when the first table
-- needs non-owner, non-service-role policies — kept out of 0002 to avoid dead code.

-- ===========================================================================
-- B) Platform money configuration (single source of truth — never hardcode 15/10%)
-- ===========================================================================

-- B.1 Commission settings — singleton row (BR-4 / REQ-PAY-06).
create table if not exists public.platform_settings (
  singleton           boolean primary key default true check (singleton),
  commission_products numeric(5,2) not null default 15,  -- BR-4
  commission_services numeric(5,2) not null default 10,  -- BR-4
  commission_rentals  numeric(5,2) not null default 10,  -- BR-4
  updated_by          uuid references public.profiles (id),
  updated_at          timestamptz not null default now()
);

-- B.2 Upfront fees — per (offering_type, currency), in INTEGER MINOR UNITS (C7 + C10).
-- Decision (DATABASE.md §3.20): a typed child table, NOT a jsonb blob —
-- queryable per (offering_type, currency), enforces integer minor units via a
-- typed column + CHECK, and is RLS-readable at checkout. Cleaner than jsonb.
create table if not exists public.platform_upfront_fees (
  offering_type text not null check (offering_type in ('product', 'rental', 'service')),
  currency      public.currency_code not null,                 -- C10 per-region (SAR/EGP)
  amount_minor  integer not null check (amount_minor >= 0),    -- minor units (halalas/piastres)
  updated_by    uuid references public.profiles (id),
  updated_at    timestamptz not null default now(),
  primary key (offering_type, currency)
);

-- Maintain updated_at on edits (reuse the helper from 0001).
drop trigger if exists set_platform_settings_updated_at on public.platform_settings;
create trigger set_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_platform_upfront_fees_updated_at on public.platform_upfront_fees;
create trigger set_platform_upfront_fees_updated_at
  before update on public.platform_upfront_fees
  for each row execute function public.set_updated_at();

-- B.3 RLS — authenticated may SELECT (fees + commission are needed at checkout and
-- settlement, both behind auth); writes only via the service-role client (admin),
-- which bypasses RLS. No write policy is added, and DML grants are revoked so even
-- a default grant cannot let anon/authenticated mutate config. (DATABASE.md §3.19.)
alter table public.platform_settings enable row level security;
alter table public.platform_upfront_fees enable row level security;

drop policy if exists platform_settings_select_all on public.platform_settings;
drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select
  on public.platform_settings
  for select
  to authenticated
  using (true);

drop policy if exists platform_upfront_fees_select_all on public.platform_upfront_fees;
drop policy if exists platform_upfront_fees_select on public.platform_upfront_fees;
create policy platform_upfront_fees_select
  on public.platform_upfront_fees
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.platform_settings from anon, authenticated;
revoke insert, update, delete on public.platform_upfront_fees from anon, authenticated;

-- B.4 Seed defaults.
-- Commissions: BR-4 (products 15%, services 10%, rentals 10%).
insert into public.platform_settings (singleton)
values (true)
on conflict (singleton) do nothing;

-- Upfront fees (C7 accepted defaults; admin-editable). Integer minor units:
--   product:  10.00 SAR / 20.00 EGP    rental: 50.00 SAR / 50.00 EGP
--   service: 100.00 SAR /100.00 EGP
insert into public.platform_upfront_fees (offering_type, currency, amount_minor) values
  ('product', 'SAR', 1000),  ('product', 'EGP', 2000),
  ('rental',  'SAR', 5000),  ('rental',  'EGP', 5000),
  ('service', 'SAR', 10000), ('service', 'EGP', 10000)
on conflict (offering_type, currency) do nothing;
