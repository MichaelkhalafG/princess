# Auth RLS smoke checks (Task 0.7)

> Manual checks run against the **live** Supabase project (the sandbox can't reach
> Postgres). Confirms the auth flow honors the profiles RLS policies from
> `0002_rls_and_settings.sql` and the signup trigger from `0001_foundation.sql`.
> Run in the Supabase SQL editor / `psql`. ✅ = expected pass.

## 1. Signup trigger derives status from role (REQ-AUTH-05)

Register one of each role via `POST /api/auth/register` (or the `/register` UI), then:

```sql
select email, role, status
from public.profiles
order by created_at desc
limit 3;
```

- ✅ customer → `status = active`
- ✅ seller   → `status = pending`
- ✅ provider → `status = pending`
- ✅ No row is ever created with `role = admin` from the public register route
      (the route + schema reject `admin`; admins are seeded/promoted server-side).

## 2. A user can read only their own profile (RLS `profiles_select_own`)

Authenticated as user A (anon key + A's session), `GET /api/auth/me`:

- ✅ Returns A's profile only.
- ✅ A direct `select * from profiles` returns exactly 1 row (A's), never other users'.

## 3. No privilege escalation (column grants from 0002)

As an authenticated user, attempt to self-promote:

```sql
update public.profiles set role = 'admin'  where id = auth.uid();  -- ✅ rejected (no grant on role)
update public.profiles set status = 'active' where id = auth.uid(); -- ✅ rejected (no grant on status)
update public.profiles set full_name = 'New Name' where id = auth.uid(); -- ✅ allowed (granted column)
```

- ✅ Updates to `role` / `status` are blocked (column-level grants exclude them).
- ✅ Updates to `full_name` / `phone` / `avatar_url` / `locale` succeed.

## 4. Unauthenticated access is denied

- ✅ `GET /api/auth/me` with no session → `401 UNAUTHENTICATED`.
- ✅ Visiting `/<locale>/dashboard/*` with no session → redirect to `/<locale>/login` (middleware).
- ✅ Visiting another role's dashboard (e.g. customer → `/dashboard/seller`) → redirect to own dashboard.

## 5. Logout clears the session

- ✅ After `POST /api/auth/logout`, `GET /api/auth/me` → `401`.
