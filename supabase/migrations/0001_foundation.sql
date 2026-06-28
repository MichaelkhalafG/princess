-- ============================================================================
-- Princess — 0001_foundation
-- Per DATABASE.md §1/§2/§3.1/§5 (authoritative), SYSTEM_ARCHITECTURE §8,
-- PROJECT_ANALYSIS User Roles. Phase 0.
--
-- Creates: extensions, foundation enums, public.profiles, the signup trigger
-- (handle_new_user) and the updated_at touch trigger. RLS is ENABLED on profiles
-- (deny-by-default) — policies arrive in 0002. Pure SQL, idempotent-friendly.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Extensions  (btree_gist needed for availability/rental exclusion later)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- 2. Enums (DATABASE.md §2 — created in 0001: needed now or by 0002/0003).
--    Guarded so the migration is re-runnable.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('customer', 'seller', 'provider', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.provider_type as enum ('freelancer', 'center');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.profile_status as enum ('pending', 'active', 'suspended', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.currency_code as enum ('SAR', 'EGP');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 3. public.profiles  (DATABASE.md §3.1) — extends auth.users 1:1.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  role          public.user_role not null default 'customer',
  provider_type public.provider_type,
  status        public.profile_status not null default 'pending',
  avatar_url    text,
  locale        text not null default 'ar',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- DATABASE.md §3.1 indexes.
create index if not exists profiles_role_status_idx on public.profiles (role, status);
create index if not exists profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- 4. handle_new_user()  (DATABASE.md §5, REQ-AUTH-05)
--    Creates a profiles row on auth.users insert. role from signup metadata
--    (default 'customer'); status 'active' for customers, else 'pending'.
--    SECURITY DEFINER + empty search_path (Supabase-recommended hardening) so it
--    can write through the deny-by-default RLS during signup.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  v_role := coalesce(
    nullif(new.raw_user_meta_data ->> 'role', '')::public.user_role,
    'customer'
  );

  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    v_role,
    case when v_role = 'customer' then 'active'::public.profile_status
         else 'pending'::public.profile_status end
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. updated_at touch trigger (DATABASE.md §5)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. RLS: enable (deny-by-default). Policies are added in 0002_rls_and_settings.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
