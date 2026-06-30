# PHASE_1_ACCEPTANCE.md — Catalog & Storage

> ## ⏳ PHASE 1 — DoD prepared (sandbox gate green; awaiting the user's live E2E + Vercel preview)
> All Phase-1 build work is complete and the sandbox gate is green (IMPLEMENTATION_PLAN
> Phase 1; CLAUDE_RULES §0/§11/§12). Tasks 1.1–1.8 done. **Live verification is the
> user's to run** (per the environment split — Claude writes, the user runs db push /
> db:types / dev / test:e2e / deploy): `pnpm test:e2e` green + a green **Vercel preview**.
> **PREVIEW only — no production, no real payments/emails.** Git commit + tag handled by the user.

---

## 1. Gate results

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `pnpm typecheck` | ✅ clean (no output) |
| Lint | `pnpm lint` | ✅ `No ESLint warnings or errors` |
| Unit + integration | `pnpm exec vitest run` | ✅ **29 passed**, 19 skipped (RLS suites opt-in) |
| E2E compiles | `pnpm exec playwright test --list` | ✅ **26 tests** (13 × ar/en) |
| E2E run | `pnpm test:e2e` | ⏳ **user runs** — expected green (see §2) |
| RLS owner-only | `products-rls.test.ts` + SQL smoke | ⏳ **user runs** — expected pass (see §2.3) |
| Preview deploy | Vercel | ⏳ **user runs** — checklist in §3 |

Unit/integration coverage now: money (5), providers + Tap/webhook (14), auth schema (10);
opt-in live suites `rls.test.ts` (9) + `products-rls.test.ts` (10) skip unless `RLS_TEST=1`.

---

## 2. Tests for the gate (user runs the live ones)

### 2.1 Catalog + auth E2E (Playwright) — user runs
```bash
pnpm exec playwright install chromium   # one-time
pnpm test:e2e                            # boots `pnpm dev`, runs ar + en
```
**Green (no seller opt-in) = `24 passed`, 2 skipped** (the seller flow). Per locale the
catalog adds:
- `renders /products with the correct direction and localized title` — `/ar` `dir=rtl` + Arabic `المنتجات`; `/en` LTR.
- `filters and sort write to the URL` — category (when seeded) → `?category=`, min price → `?minPrice=50`, sort → `?sort=price_asc` (URL = single source of truth, D1).
- `opens a product detail page when an active product exists` — clicks a `product-card` → `/products/<uuid>`, `<h1>` visible. **Self-skips on an empty catalog.**
- `the catalog pages have no uncaught or console errors`.

Prereq: Supabase Auth **"Confirm email" OFF** (same as Phase 0).

### 2.2 Seller add-product E2E (opt-in) — user runs
```bash
# .env.local needs SUPABASE_SERVICE_ROLE_KEY; the `products` bucket must exist.
E2E_SELLER=1 pnpm test:e2e catalog
```
**Green = the 2 seller tests also pass → `26 passed`.** It seeds an **approved** seller
via service-role (no anon path to an active seller — RLS blocks escalation, by design),
logs in through the UI, adds a product with a **real image upload** to Supabase Storage,
asserts it appears in the ProductManager and on `/products`, then tears the seller down
(storage objects + auth user, which cascades the product). Created sellers also match the
`@e2e.princess.test` teardown key.

### 2.3 RLS owner-only — two ways, user runs

**(a) Automated** (`tests/integration/products-rls.test.ts`, opt-in):
```bash
# add RLS_TEST=1 to .env.local, then:
pnpm test products-rls
```
**Green = 10 passed:** anon cannot insert; a draft is invisible to anon + to another
seller; seller B's update/delete of A's row affect **0 rows**; A can read/update/delete
own; A cannot insert a row spoofing B's `seller_id`. Teardown:
`delete from auth.users where email like '%@rls-test.princess.test';`

**(b) Supabase SQL editor** — role-impersonation block with expected results in
`tests/integration/products.rls-smoke.md` (anon → 0 draft rows + write denied; seller B →
0 rows / 0-row update+delete; seller A → full control + `with check` violation on a spoofed
`seller_id`; once `active` → publicly readable).

---

## 3. Vercel PREVIEW deploy (user runs; prepared here)

> **PREVIEW ONLY** — no Production, no real payments/emails (CLAUDE_RULES §12). Sandbox keys.

### 3.1 Environment variables — **no new vars beyond Phase 0**
Phase 1 introduces **no new env vars** for the app at runtime. The catalog uses the
existing Supabase client/anon + service-role (already set in Phase 0). One **test-only**
flag exists but is **not** a deploy var: `E2E_SELLER` (local E2E opt-in, never set on Vercel).

Re-confirm the Phase-0 set is scoped to **Preview** (client-safe `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL`; server-only `SUPABASE_SERVICE_ROLE_KEY`,
`TAP_SECRET_KEY`, `TAP_WEBHOOK_SECRET`, `RESEND_API_KEY`). No Twilio/Stripe.

### 3.2 Storage bucket (must exist in the linked project)
The catalog reads/writes the **`products`** bucket. Confirm it exists (public) with the 4
Storage RLS policies from `supabase/storage/products_bucket.sql` (run in the SQL editor —
it is **not** in the migration chain because `storage.objects` is owned by
`supabase_storage_admin`). Quick check:
```sql
select id, public from storage.buckets where id = 'products';   -- expect 1 row, public = true
select count(*) from storage.objects where bucket_id = 'products'; -- objects live under {uid}/…
```

### 3.3 Preview acceptance checklist (verify on the preview URL)
- [ ] `/` → `/ar`; **`/ar` renders RTL + Arabic**; `/en` LTR; locale switch preserves path.
- [ ] `/ar/products` + `/en/products` list **active** products; **filters (category, price) + sort + pagination** work and reflect in the URL.
- [ ] `/products/[id]` renders (gallery, price, variants, reviews placeholder); a draft/inactive id → **404**.
- [ ] An **approved seller** can add a product **with an image** and it appears in their ProductManager and on `/products`.
- [ ] A seller sees **only their own** products; a **pending** seller is blocked (banner only; `POST /api/products` → 403).
- [ ] Mobile (< lg): FilterBar collapses to a Sheet; grid reflows 2→3→4; no layout shift.

> (Payments/emails are NOT exercised in Phase 1 — Phase 2/5.)

---

## 4. Migrations & generated types
- `supabase/migrations/0003_catalog.sql` — **pushed & live-verified** (Task 1.1): `categories`,
  `products`, `product_variants`, `listing_status` enum, indexes on every FK + filter/sort col,
  RLS (public-read-`active` / owner-CRUD), 5 product categories seeded.
- `supabase/storage/products_bucket.sql` — **dashboard-run** (Task 1.2, verified live): `products`
  bucket + 4 Storage RLS policies. Kept out of the migration chain on purpose (storage ownership).
- `lib/database.types.ts` — regenerated from the **live** DB; includes `categories` / `products` /
  `product_variants`. Included in the Phase-1 commit.
- Re-confirm anytime: `pnpm exec supabase db push` (no-op if applied) + `pnpm db:types` (clean diff).

---

## 5. Final reconciliation — Built / Deferred

**Built in Phase 1** (implementation complete; live verification = user's E2E + preview):
REQ-PROD-01, -02, -03, -04, -05, -06; **REQ-NFR-12** (Supabase Storage). REQ-NFR-04 stays
**In progress** (catalog RSC + caching + zero-CLS + no-console E2E done; broader perf budgets
later).

**Deferred (with reason + target phase) — *not* cut:**
| REQ | Done in Phase 1 | Remaining | Deferred to |
|-----|-----------------|-----------|-------------|
| REQ-DASH-05 | Categories API (`GET/PUT /api/admin/categories`, admin-gated) + cached `getCategories`; consumed read-only by FilterBar/ProductForm | **Admin CategoryManager UI** | Admin phase (Phase 5) |

> Phase 1 needs categories only as read-only data for browsing/listing, which is built and
> wired; the authoring UI belongs with the rest of the admin console. Surfaced, not silent
> (CLAUDE_RULES §3).

---

## 6. Conflicts / findings surfaced during Phase 1
- **`unstable_cache` + cookies():** the cookie-bound server client throws inside
  `unstable_cache` → added `lib/supabase/public.ts` (cookie-less anon) for cached catalog reads.
- **Storage SQL outside migrations:** `storage.objects` is owned by `supabase_storage_admin`,
  so `db push` can reject policy DDL → bucket + policies live in `products_bucket.sql` (SQL editor).
- **`zodResolver` input/output divergence:** `productSchema` uses `.default()`/`.refine()`, so
  Zod's input type ≠ `ProductInput` (output). Resolved with `as Resolver<ProductInput>` (no `any`)
  so the form stays typed against the parsed output.
- **No anon path to an active seller (by design):** RLS blocks status escalation, so the seller
  E2E seeds an approved seller via service-role in the trusted test process — opt-in, not on by default.
- **Category filter uses `category_id` (uuid) in the URL**, not a slug — slug-pretty URLs noted as a
  future enhancement (avoids a nested cache lookup per request).

---

## 7. Carry-forwards (also in SESSION_STATE)
- Slug-based category URLs (pretty `/products?category=dresses`) — future enhancement.
- Admin CategoryManager UI — Phase 5 (admin console).
- Broader performance budgets / Lighthouse (REQ-NFR-04) — later phases.
- Reviews/ratings on the detail page (placeholder now) — Phase 5.
- Cart/checkout/COD + Tap intent (REQ-PAY-01, REQ-ORD-*) — Phase 2.

---

## 8. Commit/tag plan (user handles git)
- Suggested commit referencing Phase-1 REQ-IDs:
  `feat(catalog): products schema+RLS+storage, public browse/filter/detail, seller CRUD, catalog E2E`
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Tag `phase-1` **after** the user's `pnpm test:e2e` is green and the preview checklist (§3.3) passes.
- `.env.local` stays git-ignored; verify no secret is staged. The deleted `app/[locale]/dev/upload-test/`
  harness should not reappear.
