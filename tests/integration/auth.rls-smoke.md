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

---

## 6. SQL-editor RLS block (run in Supabase → SQL editor)

The SQL editor connects as a superuser (RLS bypassed), so we **impersonate** roles to
exercise the policies. Run each block; expected results noted. Pick a real id first:

```sql
select id from public.profiles limit 1;   -- copy one id, use as <UID> below
```

**(a) Anon is denied (deny-by-default):**
```sql
set role anon;
select count(*) from public.profiles;          -- expect 0
select count(*) from public.platform_settings; -- expect 0
reset role;
```

**(b) Authenticated self-read only + settings readable:**
```sql
set role authenticated;
set request.jwt.claims = '{"sub":"<UID>","role":"authenticated"}';
select count(*) from public.profiles;                 -- expect 1 (own row only)
select bool_and(id = '<UID>') from public.profiles;   -- expect t
select count(*) from public.platform_settings;        -- expect 1 (readable)
reset role; reset request.jwt.claims;
```

**(c) Escalation blocked (run the last two ONE AT A TIME — each should ERROR):**
```sql
set role authenticated;
set request.jwt.claims = '{"sub":"<UID>","role":"authenticated"}';
update public.profiles set full_name = 'RLS OK' where id = '<UID>';  -- expect UPDATE 1 (allowed column)
update public.profiles set role   = 'admin'  where id = '<UID>';     -- expect ERROR 42501 permission denied for column role
update public.profiles set status = 'active' where id = '<UID>';     -- expect ERROR 42501 permission denied for column status
reset role; reset request.jwt.claims;
```

> Automated equivalent: `tests/integration/rls.test.ts` (opt-in — add `RLS_TEST=1`
> to `.env.local`, then `pnpm test rls`). Teardown for users it creates:
> `delete from auth.users where email like '%@rls-test.princess.test';`
