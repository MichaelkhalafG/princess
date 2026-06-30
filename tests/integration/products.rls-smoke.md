# Products RLS smoke checks (Task 1.7 / Phase 1 DoD)

> Manual checks against the **live** Supabase project (the sandbox can't reach
> Postgres). Confirms the catalog ownership model from `0003_catalog.sql`:
> `products_select_active` (public read = active only), `products_owner_all`
> (owner-only ALL via `seller_id = auth.uid()`), and revoked anon writes.
> Run in the Supabase SQL editor. ✅ = expected result.
>
> Automated equivalent: `tests/integration/products-rls.test.ts` (opt-in — add
> `RLS_TEST=1` to `.env.local`, then `pnpm test products-rls`). It creates two
> users; teardown: `delete from auth.users where email like '%@rls-test.princess.test';`

## Model under test

| Policy | Effect |
|--------|--------|
| `products_select_active` (`using status = 'active'`) | Anyone (incl. anon) reads **active** products only — drafts/inactive are invisible. |
| `products_owner_all` (`using/with check seller_id = auth.uid()`) | A seller can `select/insert/update/delete` **only their own** rows, any status. |
| `revoke insert/update/delete … from anon` | Anon cannot write at all. |

## SQL-editor block (impersonate roles — the editor is superuser/RLS-bypassed)

Pick two real seller ids and one of seller A's product ids first:

```sql
-- Two distinct profile ids to play sellers A and B:
select id from public.profiles order by created_at limit 2;   -- <A>, <B>

-- Seed a DRAFT product owned by A (run as superuser so it just inserts):
insert into public.products (seller_id, title, price, currency, status)
values ('<A>', 'RLS Smoke Draft', 100, 'SAR', 'draft')
returning id;                                                 -- <PID>
```

**(a) Anon: writes revoked, drafts invisible**
```sql
set role anon;
select count(*) from public.products where id = '<PID>';      -- ✅ 0 (draft not active)
insert into public.products (seller_id, title, price, currency)
  values ('<A>', 'Anon Insert', 10, 'SAR');                   -- ✅ ERROR 42501 permission denied for table products
reset role;
```

**(b) Seller B cannot see / modify A's product**
```sql
set role authenticated;
set request.jwt.claims = '{"sub":"<B>","role":"authenticated"}';
select count(*) from public.products where id = '<PID>';      -- ✅ 0 (not active, not B's)
update public.products set title = 'Hijacked' where id = '<PID>';  -- ✅ UPDATE 0 (row scoped out by RLS)
delete from public.products where id = '<PID>';               -- ✅ DELETE 0
reset role; reset request.jwt.claims;
```

**(c) Seller A has full control of their own product**
```sql
set role authenticated;
set request.jwt.claims = '{"sub":"<A>","role":"authenticated"}';
select count(*) from public.products where id = '<PID>';      -- ✅ 1 (owner sees own draft)
update public.products set title = 'Owned & Updated' where id = '<PID>';  -- ✅ UPDATE 1
insert into public.products (seller_id, title, price, currency)
  values ('<B>', 'Spoofed seller_id', 5, 'SAR');              -- ✅ ERROR new row violates row-level security (with check)
reset role; reset request.jwt.claims;
```

**(d) Public read sees it once active**
```sql
update public.products set status = 'active' where id = '<PID>';   -- as superuser
set role anon;
select count(*) from public.products where id = '<PID>';      -- ✅ 1 (now active → public)
reset role;
```

**Teardown:**
```sql
delete from public.products where id = '<PID>';
```

## Expected results summary

- ✅ anon: 0 draft rows; insert/update/delete → permission denied.
- ✅ seller B: 0 rows for A's draft; update/delete affect **0 rows** (no error — RLS scopes them out).
- ✅ seller A: sees + updates own row; cannot insert a row with another seller's `seller_id` (`with check` violation).
- ✅ once `status = 'active'`, the row is publicly readable.
