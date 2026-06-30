# SESSION_STATE.md — resume note

> Scratch hand-off so work can resume exactly where it stopped. Last updated: **2026-06-30**.
> Authoritative planning docs: `REQUIREMENTS_MATRIX.md` (the law), `DATABASE.md`, `IMPLEMENTATION_PLAN.md`, `CLAUDE_RULES.md`, `DESIGN_RULES.md`, `ENV_SETUP.md`.

## Where we are
**Phase 0 (Foundation) — ✅ COMPLETE (gate PASSED 2026-06-30).** Live-verified: typecheck + lint clean, E2E 16/16, RLS smoke confirmed, green deploy at `princess-woad.vercel.app` (7/7 acceptance). Built: REQ-AUTH-01..06, REQ-NFR-01/02/03/05/07/08/10/11, REQ-PAY-06/07. Deferred (foundation built, scheduled): REQ-PAY-01→Phase 2, REQ-NOT-01→Phase 5. `docs/PHASE_0_ACCEPTANCE.md` finalized. **Git commit + tag `phase-0` handled by the user.** ⚠️ Deploy is Production-from-`main` with **sandbox/placeholder keys** — real launch = Phase 7.

**Phase 1 (Catalog & Storage) — ⏳ DoD prepared, awaiting the user's live E2E + Vercel preview.** Tasks 1.1–1.8 done; sandbox gate green (typecheck + lint clean, vitest 29 passed/19 skipped, 26 E2E compile). Built: REQ-PROD-01..06, REQ-NFR-12. REQ-NFR-04 In progress (catalog caching/CLS done). Deferred: REQ-DASH-05 admin CategoryManager UI → Phase 5 (categories API built + consumed read-only). `docs/PHASE_1_ACCEPTANCE.md` produced. Throwaway dev upload-test harness **deleted**. **Remaining to close: the user runs `pnpm test:e2e` (expect 24 passed / 2 seller-opt-in skipped) + a green Vercel preview (§3 checklist), then commit + tag `phase-1`.**

**Next: Phase 2 — Cart, Orders & Checkout (Tap intent + COD).** See carry-forwards below.

| Task | What | Status |
|------|------|--------|
| 0.1 | Scaffold (Next 14 + TS strict + Tailwind + shadcn/ui, brand tokens, folder skeleton, PWA baseline) | ✅ Done — typecheck + lint green |
| 0.2 | Supabase clients (`lib/supabase/{client,server,admin}.ts`), `lib/database.types.ts`, `db:types` script, `.env.example` | ✅ Done — typecheck + lint green |
| 0.3 | `supabase/migrations/0001_foundation.sql` (extensions, enums, `profiles`, `handle_new_user` + `set_updated_at` triggers, RLS enabled) | ✅ Done — **applied to live DB & verified** |
| 0.4 | `supabase/migrations/0002_rls_and_settings.sql` (profiles RLS + no-escalation column grants; `platform_settings` + `platform_upfront_fees` + seed; RLS authenticated-read/service-role-write) | ✅ Done — **applied to live DB & verified** |
| 0.5 | i18n + RTL shell (`next-intl` v4, `app/[locale]`, `ar` default + `localeDetection:false`, message catalogs, ThemeProvider+Toaster, localized landing). Root layout deleted so `[locale]/layout` is root (fixes missing-html-tags). | ✅ Done — **verified in browser** (/→/ar Arabic RTL; /en LTR; no root-layout error) |
| 0.6 | Composed `middleware.ts` (intl + Supabase session refresh + `/dashboard/*` role guard from DB) + `lib/rbac.ts` | ✅ Done — **verified in browser** (logged-out → /login; role guard) |
| 0.7 | Auth: routes `register`/`login`/`logout`/`me` (typed envelope, server Zod), `features/auth/*` (schema/queries/mutations/client + components AuthCard/LoginForm/RegisterForm/RoleSelect), role-based redirect, minimal dashboard landings + PendingApprovalBanner. Unit test (schema) + RLS smoke note. **+ Playwright E2E** (config + `tests/e2e/auth.spec.ts`, 16 tests ar/en) to verify auth without hand-testing. | ✅ Done — **verified via Playwright E2E (16/16 passed, ar+en)** + typecheck/lint/unit green |
| 0.8 | Provider abstractions: `lib/payments/{PaymentProvider,tap,stripe,index}` (Tap primary — sandbox-stub createIntent w/ optional `destination` for split→Phase 2; **Tap hashstring** webhook verify, timing-safe + fail-closed; Stripe NotImplemented stub; factory) + `lib/notifications/{NotificationService,resend,sms,index}` (Resend email channel; SMS interface placeholder Phase 2). Secrets env + `server-only`; integer minor units; feature code → interfaces only. Unit test (factory + minor-units guard + webhook round-trip/tamper). | ✅ **PASS** (user-reviewed) — typecheck + lint + 21/21 unit green |
| 0.9 | Tap sandbox spike: `TapProvider.createIntent` now makes the **real** `/v2/charges` call (minor→major `toTapAmount`, raw on `PaymentIntent.raw`); `scripts/tap-spike.ts` + `scripts/tsconfig.json` + `pnpm spike:tap`; createIntent unit tests mock `fetch`; `docs/SPIKE_NOTES.md`. | ✅ **PASS** — verified live (charge `chg_TS05A…`, INITIATED, transaction.url; SAR=2dp confirmed). Caveat (a) webhook secret deferred → Phase 2 |

### Task 0.3 — DoD: FULL PASS
- Migration applied to live project `kukjkkkpyohsykaeealw`. ✅
- Enums + `profiles` match DATABASE.md §3.1 exactly (`user_role` has `provider` not service_provider; `profile_status` includes `rejected`; `currency_code` SAR/EGP). ✅
- Signup trigger sets status per role — **verified live: seller → `pending`, customer → `active`.** ✅
- RLS enabled on `profiles` — **verified live: `relrowsecurity = true`.** ✅
- `lib/database.types.ts` regenerated from the LIVE database (contains `profiles` + 4 enums). ✅
- `pnpm typecheck` + `pnpm lint` green against regenerated types. ✅

REQ-AUTH-01..06 marked **In progress** in the matrix (DB foundation + RLS + session/RBAC middleware live; auth routes/forms still to come in 0.7).

## What's next
**Phase 0 is COMPLETE** (gate passed live; see "Where we are" + `docs/PHASE_0_ACCEPTANCE.md`). The user is doing the git commit + tag `phase-0`.

**Phase 1 — Catalog & Storage** — all 8 tasks built; **DoD prepared, awaiting the user's live E2E + preview** (see `docs/PHASE_1_ACCEPTANCE.md`). Task pack: `docs/Phasses prompt's/PHASE_1_TASKS.md`.
- ✅ **1.1 done & applied:** `0003_catalog.sql` live (categories/products/product_variants, indexes, RLS public-read-`active`/owner-CRUD, 5 product categories seeded); `db:types` regenerated; typecheck clean.
- ✅ **1.2 verified PASS (live):** `products` bucket + Storage RLS applied (dashboard SQL `supabase/storage/products_bucket.sql`); `/api/upload` (RLS via user session, no service-role) + `useUpload` + reusable `ImageUploader` + `lib/constants.ts PRODUCT_IMAGE_LIMITS`. Live: 6 imgs under `products/{uid}/…`, public URLs render, `{url,alt,sort}` shape correct, guards BAD_FILE/TOO_LARGE/401, E2E 16/16. Throwaway dev harness `app/[locale]/dev/upload-test/` **deleted at Phase 1 close (1.8)**.
- ✅ **1.3 done:** `lib/money.ts` (+5 unit tests) · `Money`/`PriceTag`/`StatusBadge`/`Pagination`/`ProductCardSkeleton`.
- ✅ **1.4 done:** `useFilters` (URL state, debounced price, page-reset) · `FilterBar` (mobile Sheet) · generic `DataTable<T>`.
- ✅ **1.5 done:** `getCategories` (cached, tag `categories`, `lib/supabase/public.ts`) · `GET/PUT /api/admin/categories` (admin-gated; PUT service-role + revalidate). Admin CategoryManager UI deferred → admin phase.
- ✅ **1.6 done (sandbox gate; awaiting browser/E2E verify):** `features/catalog/{schema,queries,images}` (cached `listProducts`/`getProductById`, tags `products`/`product:{id}`) · `GET /api/products` + `GET /api/products/:id` · `/products` (RSC FilterBar+ProductGrid+ProductCard+Pagination, Suspense skeleton, EmptyState) + `/products/[id]` (ProductGallery, VariantSelector, serif PriceTag, generateMetadata). Pages live in the **`(marketing)` group** for the Navbar/Footer shell. Category filter = category_id in URL.
- ✅ **1.7 done (sandbox gate; awaiting browser verify):** seller product CRUD. `features/catalog/schema.ts productSchema` (number-based; seller-settable statuses only — `rejected` is admin-set) + `mutations.ts` (`createProduct`/`updateProduct`/`deleteProduct` via cookie server client; **`seller_id` from session, never the body**; ownership re-check select→404/403 **on top of** RLS; variant full-replace; `revalidateTag` products + `product:{id}`) · `POST /api/products` (seller-role **+ active** gate, REQ-AUTH-05) + `PUT/DELETE /api/products/:id` (owner gate) · `getMyProducts()` (session client, `*, product_variants(*)` → `SellerProduct[]`) · `ProductManager` (DataTable + edit Sheet + delete ConfirmDialog) + `ProductForm` (RHF/zodResolver, ImageUploader, variants `useFieldArray`) · seller dashboard renders ProductManager only for active sellers, else PendingApprovalBanner. zodResolver input/output divergence (schema `.default()`/`.refine()`) resolved via `as Resolver<ProductInput>`. Seller-isolation RLS test stub `tests/integration/products-rls.test.ts` (opt-in `RLS_TEST=1`, 10 tests: anon-insert denied, seller_id spoof denied, draft invisible to anon/other, B can't update/delete A's row, A full CRUD). Gate: typecheck + lint clean; vitest 29 passed / 19 skipped (live suites skip). **Browser verify pending** (steps below).
- ✅ **1.8 done — Phase 1 DoD gate (prepared; awaiting the user's live run):** `tests/e2e/catalog.spec.ts` (public browse/render/RTL + filter+sort→URL + detail + no-console-errors, ar+en, empty-safe; opt-in seller add-with-image via `tests/e2e/seller.ts` service-role seed + auto teardown) · `data-testid`s on FilterBar/ProductCard/ProductForm/ImageUploader/ProductManager · RLS owner-only `tests/integration/products-rls.test.ts` (opt-in) + SQL smoke `tests/integration/products.rls-smoke.md` · matrix reconciled (REQ-PROD-01..06 Built, NFR-12 Built, NFR-04 In progress, DASH-05 deferred→Phase 5) · `docs/PHASE_1_ACCEPTANCE.md` produced · **deleted** `app/[locale]/dev/upload-test/`. Gate: typecheck + lint clean; 26 E2E compile; vitest 29/19.

### To close Phase 1 (the user runs — Claude can't reach DB/dev/deploy)
1. `pnpm test:e2e` → expect **24 passed / 2 skipped** (seller opt-in). For the seller flow: `E2E_SELLER=1 pnpm test:e2e catalog` (needs `SUPABASE_SERVICE_ROLE_KEY` + `products` bucket) → **26 passed**.
2. Optional DB-layer RLS: `RLS_TEST=1 pnpm test products-rls` (10 passed) or the SQL block in `products.rls-smoke.md`.
3. Vercel **preview** + the §3.3 checklist in `PHASE_1_ACCEPTANCE.md` (no new env vars; confirm the `products` bucket exists in the linked project).
4. Then commit + tag `phase-1`. E2E teardown: `delete from auth.users where email like '%@e2e.princess.test';` (cascades products; storage objects for seeded sellers are auto-removed by the test, else clear `storage.objects` for `bucket_id='products'`).
- Standing workflow unchanged (Claude writes code+migrations + typecheck/lint; user runs `db push`/`db:types`/`dev`/`test:e2e`).

**Phase 2 carry-forward from the Tap spike** (`docs/SPIKE_NOTES.md`): confirm the webhook hashstring secret via a delivered sandbox webhook (public `post.url`/ngrok) and align `verifyWebhook` (`TAP_WEBHOOK_SECRET` vs `TAP_SECRET_KEY`); build `/payment/callback` (redirect.url) + webhook handler at `/api/payments/webhook` (post.url); don't assume merchant/currency from the shared sandbox account (599424/KWD) — ours comes with our keys. Then 0.10 (shared primitives Navbar/Footer/LocaleSwitcher/RoleGuard — uses `public/logo.svg`), 0.11 (Phase 0 DoD gate).

**Verifying tasks from here on:** flows are covered by `pnpm test:e2e` (auto-starts `pnpm dev`, ar+en). After Phase 1: green = **24 passed / 2 skipped** (auth 8×2 + catalog public 4×2; the 2 seller tests are opt-in via `E2E_SELLER=1` → 26). Extend `tests/e2e/*` as new flows land rather than hand-testing. E2E users use unique `…@e2e.princess.test` emails; teardown: `delete from auth.users where email like '%@e2e.princess.test';`.

## Standing workflow
Sandbox limits: **cannot reach Postgres** (DNS/5432 egress blocked; only HTTPS) and **cannot run `pnpm dev`** (Google Fonts egress blocked). So:
1. **Claude Code writes** code + migrations (and updates docs/type expectations); runs `pnpm typecheck` + `pnpm lint` as the sandbox gate.
2. **You run from your own terminal:** `pnpm exec supabase db push` + `pnpm db:types` for DB changes, and `pnpm dev` to verify UI/runtime in the browser.
3. **You paste results back** (push/types output, browser verification); Claude reconciles against DATABASE.md / the task DoD before advancing.
- **Secrets rule:** you NEVER paste DB passwords or PATs into chat. (The 0.3 DB password that was shared earlier should still be rotated — see below.) typecheck+lint passing is necessary but NOT sufficient — runtime bugs (e.g. 0.5) only surface in `pnpm dev`.

## ⚠️ Not committed yet
**Git commit + tag are the user's to do.** Per `git log`, Phase 0 was committed (3 commits through `b0aaad3`); **all Phase 1 work (Tasks 1.1–1.8) is uncommitted** — catalog migration 0003 + storage SQL + regenerated types, money/display primitives, useFilters/FilterBar/DataTable, categories API, public browse pages + queries, seller CRUD (schema/mutations/routes/ProductManager/ProductForm), catalog E2E + seller fixture + fixture PNG, RLS integration test + SQL smoke, docs. Commit on the user's explicit confirm (reference Phase-1 REQ-IDs); tag `phase-1` after E2E + preview are green.

## Brand assets (ready for Task 0.10)
Final logo = **Version C (Rose Jewel)**, confirmed 2026-06-29. Production copies in `public/`: `logo.svg` (horizontal → Navbar), `logo-stacked.svg` (Footer/auth), `icon.svg` (mark), `favicon.svg` (wired in layout `metadata.icons`). Source archive `./logo/` also holds `-reversed` (dark-bg) and `-mono-*` (single-colour) alternates — pull into `public/` when dark mode (Phase 2) / mono use arrives. See memory `brand-logo-assets`.

## Secrets housekeeping
- `.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key value); `SUPABASE_SERVICE_ROLE_KEY` + Tap/Resend still blank.
- The **DB password** was shared in chat during 0.3 — **rotate it** (Dashboard → Project Settings → Database → Reset password) when convenient.

## ⚠️ Pre-launch checklist (carry forward to production)
- **Re-enable Supabase Auth → "Confirm email".** Turned OFF in dev (2026-06-29) so registration returns a session for E2E + smooth dev. App already handles the no-session path (register → "check your email" → login), so re-enabling is safe; do it before production so emails are verified.
- Rotate the 0.3 DB password (above) before launch if not already done.
