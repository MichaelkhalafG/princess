# PHASE 1 — Catalog & Storage · Claude Code Task Pack

> **Project:** Princess — All-in-One Women's Marketplace
> **Phase goal (IMPLEMENTATION_PLAN Phase 1):** Products + categories + variants + image storage + public browsing + seller CRUD.
> **Deliverables:** Browseable catalog; seller product management.
> **Database:** `categories`, `products`, `product_variants`, indexes, RLS (public read active / owner CRUD), `products` Storage bucket. Migration `0003_catalog.sql`.
> **Phase acceptance:** Seller adds a product with images; the public sees active products; filters/sort/pagination work.
> **Phase DoD:** RLS verified (seller sees only own); images persist; reuse-first primitives (Money, DataTable, FilterBar, ImageUploader, ProductGallery, Pagination) built here.
> **Final commit (whole phase):** `feat(catalog): products, variants, categories, storage, seller crud`

---

## How to use this file

Each task is a self-contained unit for a single Claude Code session. Run them **in order** — later tasks depend on earlier ones. For each task:

1. Paste the **Prompt** block into Claude Code.
2. Claude works against the **Files** list (creates/edits only those, unless it surfaces a needed addition).
3. Do **not** mark done until every **DoD** checkbox passes (`typecheck`, `lint`, stated tests).
4. The task **REQ-IDs** must be satisfied or explicitly deferred in `REQUIREMENTS_MATRIX.md` — never silently skipped (CLAUDE_RULES §0). Each task states its expected matrix status change.

> ### ⛔ MANDATORY PROJECT STANDARDS — applies to EVERY task below
> Before writing **any** code in **any** task in this file, you must:
> 1. **Read `docs/CLAUDE_RULES.md`** (engineering standards).
> 2. **Read `docs/DESIGN_RULES.md`** (the single source of truth for all UI/UX).
> 3. **Follow both documents fully** before writing any code.
> 4. **Never violate** any rule in either document (see `DESIGN_RULES.md §17 — Forbidden`).
> 5. **Keep the entire application visually consistent** with the established design system (semantic tokens only, typography scale, 8px spacing, the 3 shadows, defined radii, Lucide icons, RTL logical properties, no default shadcn theme, no emoji UI). Reuse the Phase-0 shell (Navbar/Footer).
>
> A task that breaks a forbidden rule does not pass review. If a needed pattern is missing, add it to the relevant rules doc first, then implement. This instruction is repeated atop every prompt block so it is never skipped.

**Binding rules for every task:** locked stack only (Supabase · Next 14 App Router + TS · Tailwind + shadcn/ui · Vercel · Resend · Tap); no Prisma / next-auth / Cloudinary (C1/C2/C3); no `any` (strong types, generated `database.types.ts`); typed API envelope `{ data } | { error: { code, message, details? } }`; **RLS deny-by-default on every new table**; provider abstractions for storage; Arabic-first RTL with no hardcoded UI strings (all copy via `messages/*`); **all UI to `DESIGN_RULES.md`**; surface conflicts instead of silently breaking a rule. Quality bar for the catalog: **Zara (image-forward elegance) + Amazon (filter/sort/pagination density)** — DESIGN_RULES §9.

### ⚙️ Environment reality (same as Phase 0 — bake into every task)
Claude Code's sandbox **cannot reach the Supabase DB and cannot run `pnpm dev`/`pnpm test:e2e`**. So for every task:
- **Claude Code WRITES** code + SQL migrations and runs `pnpm typecheck` + `pnpm lint` as the sandbox gate.
- **You RUN the live steps** from your terminal and paste results: `pnpm exec supabase db push` (apply migration) → `pnpm db:types` (regen `lib/database.types.ts`) → `pnpm dev` (browser) → `pnpm test:e2e`.
- Claude must **not claim** a migration applied, types regenerated, or a page rendered — those are your verifications. Claude writes them to be correct on first run and hands you exact commands.
- The Supabase **Storage `products` bucket** is created via migration SQL (or dashboard) — that apply step is yours.

---

## 🚦 Phase 1 — Decisions (✅ APPROVED 2026-06-29)

> **All five recommendations (D1–D5) + both defaults are APPROVED as-is.** Build to them; no further sign-off needed. One added constraint from the approval: **the image limits live in a single constant** (see the box below D5) so the 6→8 bump for premium/dress listings is a one-line change.

**D1 — Filter/sort state location.**
- (a) **URL `searchParams` as the single source of truth** — RSC page reads them server-side for the query; a small client `useFilters` reads/writes them via `next/navigation` (`useSearchParams`/`useRouter`). ✅ **Recommended** — shareable/bookmarkable links, SSR-correct, back/forward works, no client store.
- (b) Client `zustand` store. (c) Local React state only.
- *Reason:* the catalog must be linkable and server-rendered; URL state is the only option that satisfies both.

**D2 — Pagination strategy.**
- (a) **Offset/limit (`?page=&limit=`, default 1/20)** returning `{ items, total, page }`. ✅ **Recommended** — it is the exact API_MAP contract, simple, and fine at catalog scale; a total count enables a page list.
- (b) Cursor/keyset pagination.
- *Reason:* matches API_MAP verbatim; cursor can be added later behind the same endpoint for very large datasets (noted as a Phase-6+ scalability option).

**D3 — Image upload flow.**
- (a) **Server Route Handler `POST /api/upload`** receives multipart, validates mime (`image/*`) + size, uploads to the Supabase Storage `products` bucket **using the cookie-bound server client (the user's session)** so **Storage RLS enforces per-owner write**, returns the public URL(s); the client never holds the service-role key. ✅ **Recommended** — exactly DATABASE.md §7 ("uploads go through `POST /api/upload`") + API_MAP; central validation; RLS-enforced.
- (b) Client direct-to-Storage with a short-lived signed upload URL minted by a server route. (c) Client direct upload with anon + Storage RLS.
- *Reason:* one validated server path, no service-role on the client, ownership via RLS. (b) is the future optimization for very large files (offloads bandwidth) — note it, don't build it.

**D4 — `DataTable<T>` generic typing.**
- (a) **Lightweight in-house generic**: `DataTable<T>({ columns: Column<T>[]; rows: T[]; ... })` where `Column<T> = { id; header; cell:(row:T)=>ReactNode; align?; sortable? }`. ✅ **Recommended** — no new dependency, fully typed, covers our needs (custom cells, right-aligned numerics, empty/loading/pagination slots).
- (b) Adopt `@tanstack/react-table` (headless). (c) Bespoke table per dashboard.
- *Reason:* Phase-1 tables are simple; a minimal typed generic keeps the bundle lean and the API ours. If sorting/virtualization grows complex, swap the internals to `@tanstack/react-table` **behind the same `DataTable` API** (noted) — callers don't change.

**D5 — Catalog caching / revalidation.**
- (a) **Tag-based revalidation**: wrap catalog reads in `unstable_cache(fn, keys, { tags })` (Supabase JS isn't `fetch`, so tags go on `unstable_cache`), tags `products` (lists) and `product:{id}` (detail); seller `POST/PUT/DELETE` handlers call `revalidateTag('products')` and `revalidateTag('product:{id}')`. ✅ **Recommended** — catalog stays cached/fast (REQ-NFR-04) and invalidates precisely on seller edits.
- (b) Fully dynamic (no cache). (c) Time-based ISR (`revalidate = N`).
- *Reason:* precise invalidation gives both speed and correctness; time-based ISR risks stale listings after an edit, fully-dynamic gives up the perf win.

> **Defaults (✅ approved):** sort options = **newest** (`created_at desc`, default), **price asc**, **price desc**, **top-rated** (`avg_rating desc`) — each index-backed (Task 1.1). Image limits = **≤ 6 images/product, ≤ 5 MB each, `image/jpeg|png|webp`** (`413 TOO_LARGE` / `400 BAD_FILE` otherwise).
>
> **🔧 Single source for image limits (approval constraint):** define these in ONE place — `lib/constants.ts`:
> ```ts
> export const PRODUCT_IMAGE_LIMITS = {
>   maxCount: 6,                                   // bump to 8 for premium/dress listings — change here only
>   maxSizeBytes: 5 * 1024 * 1024,
>   allowedMime: ["image/jpeg", "image/png", "image/webp"] as const,
> } as const;
> ```
> Both the server route (`/api/upload`, Task 1.2) and the client `ImageUploader` (mirror) **must import this constant** — never re-hardcode `6`/`5MB`/mime anywhere. The 6→8 change is then a single edit (CLAUDE_RULES §2, one source of truth).

---

## Task index

| # | Task | Key REQ-IDs |
|---|------|-------------|
| 1.1 | DB migration `0003_catalog.sql` — `listing_status`, `categories`, `products`, `product_variants`, indexes, RLS, seed categories | REQ-PROD-01/02/04/05, REQ-DASH-05, REQ-NFR-05 |
| 1.2 | Storage: `products` bucket + Storage RLS · `POST /api/upload` · `lib/storage` · `useUpload` · `ImageUploader` | REQ-NFR-12, REQ-PROD-06 |
| 1.3 | Reuse primitives I — `lib/money.ts`, `Money`/`PriceTag`, `StatusBadge`, `Pagination`, catalog skeletons | REQ-NFR-04/08 (reuse) |
| 1.4 | Reuse primitives II — `useFilters` (URL state), `FilterBar`, `DataTable<T>` | REQ-PROD-02, REQ-NFR-04 (reuse) |
| 1.5 | Categories — `GET/PUT /api/admin/categories` + public `getCategories` query | REQ-DASH-05, REQ-PROD-02 |
| 1.6 | Public browsing — products read API (list+detail) + `/products` + `/products/[id]` (ProductCard, ProductGrid, ProductGallery, VariantSelector) | REQ-PROD-01/02/03, REQ-NFR-04 |
| 1.7 | Seller CRUD — write APIs + ProductManager (DataTable + ProductForm + ImageUploader + variants) | REQ-PROD-04/05/06, REQ-NFR-03 |
| 1.8 | Phase DoD gate — typecheck/lint, catalog E2E, RLS (owner-only) tests, Vercel preview, matrix reconcile | Phase DoD |

---

## Task 1.1 — DB migration `0003_catalog.sql` (categories, products, variants, RLS)

**REQ-IDs:** REQ-PROD-01 (catalog), REQ-PROD-02 (filter/sort fields), REQ-PROD-04 (variants), REQ-PROD-05 (seller ownership), REQ-DASH-05 (categories), REQ-NFR-05 (RLS deny-by-default per table)

**Objective:** Third migration — the `listing_status` enum and the three catalog tables exactly per DATABASE.md §2/§3.2–3.4, with every FK + every filter/sort column indexed, RLS (public read of `active` / owner CRUD), and seeded product categories.

> Cross-check **every** name against DATABASE.md before writing SQL — table/column/enum names, FK targets, defaults. DATABASE.md wins on any conflict; note the reconciliation.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Write supabase/migrations/0003_catalog.sql per DATABASE.md §2 (enums) and §3.2–§3.4 (tables), SYSTEM_ARCHITECTURE §8, and CLAUDE_RULES §5/§6. Pure SQL, no app code. Idempotent-friendly.

1. Enum: create type listing_status as enum ('draft','active','inactive','rejected').  -- 0003 per DATABASE.md §2
2. public.categories (DATABASE.md §3.2): id uuid PK default gen_random_uuid(); parent_id uuid null FK→categories(id); kind text not null check (kind in ('product','service')); name_ar text not null; name_en text not null; slug text not null unique; sort_order int not null default 0.
3. public.products (DATABASE.md §3.3): id uuid PK; seller_id uuid not null FK→profiles(id) on delete cascade; category_id uuid null FK→categories(id); title text not null; description text null; price numeric(10,2) not null check (price>=0); currency currency_code not null default 'SAR'; is_rentable boolean not null default false; rental_daily_price numeric(10,2) null check (>=0); security_deposit numeric(10,2) null check (>=0); images jsonb not null default '[]'; stock int not null default 0 check (>=0); status listing_status not null default 'draft'; avg_rating numeric(3,2) not null default 0; total_reviews int not null default 0; created_at/updated_at timestamptz not null default now().
4. public.product_variants (DATABASE.md §3.4): id uuid PK; product_id uuid not null FK→products(id) on delete cascade; size text null; color text null; stock int not null default 0 check (>=0); sku text null.
5. Indexes — index EVERY FK and EVERY column used by API_MAP product filters/sorts:
   - categories: (kind), (parent_id), unique (slug).
   - products: (category_id, status), (seller_id), (price), (status), (is_rentable), AND (created_at desc) for the "newest" sort and (avg_rating desc) for "top-rated" (D5/sort note).
   - product_variants: (product_id), unique (product_id, size, color).
6. set_updated_at trigger on products (reuse the 0001 helper).
7. RLS (enable on all three; deny-by-default, then policies):
   - categories: enable RLS; policy public SELECT (to anon, authenticated) using (true); revoke insert/update/delete from anon, authenticated (writes via service-role / admin only).
   - products: enable RLS; public SELECT using (status = 'active') to anon+authenticated; owner ALL (select/insert/update/delete) to authenticated using/with check (seller_id = (select auth.uid())). No broad admin policy (admin via service-role).
   - product_variants: enable RLS; public SELECT where the parent product is active (exists join to products where products.id = product_id and status='active'); owner ALL via exists join to products where seller_id = (select auth.uid()).
8. Seed initial PRODUCT categories from SEED_DATA.md if present (else: Dresses/فساتين, Shoes/أحذية, Bags/حقائب, Accessories/إكسسوارات, Cosmetics/مستحضرات تجميل) with kind='product', unique slugs, sort_order.

Constraints: money as numeric in DB (logic computes in integer minor units elsewhere); no app code; deny-by-default before policies. Match DATABASE.md exactly; if anything differs, follow DATABASE.md and note it.

When done: print the migration, run pnpm typecheck + pnpm lint (no app changes expected), and give me the EXACT commands to apply it + regen types. Do not claim it applied. Do not commit.
```

**Files (create/edit):**
- `supabase/migrations/0003_catalog.sql`
- `lib/database.types.ts` (regenerated — **by me**, after `db:types`)

**Tests / verification (I run):**
- `pnpm exec supabase db push` applies cleanly; `pnpm db:types` regenerates types containing `categories`, `products`, `product_variants`, `listing_status`.
- Insert a `draft` product → anon `select` returns 0 rows; flip to `active` → anon sees it.
- A seller can `insert`/`update`/`delete` only rows where `seller_id = auth.uid()`; another user's row is not updatable/visible-for-write.
- Variants readable only where parent active; writable only by the parent's owner.

**DoD:**
- [ ] Enum + 3 tables match DATABASE.md §3.2–3.4 exactly (names, FKs, defaults, checks)
- [ ] Every FK + every filter/sort column indexed (incl. `created_at`, `avg_rating`, `(category_id,status)`)
- [ ] RLS: public read `active` only; owner-only CRUD; categories writes service-role-only; deny-by-default proven on a draft/non-owned row
- [ ] Product categories seeded (kind='product', AR+EN, unique slugs)
- [ ] `pnpm typecheck` + `pnpm lint` clean; exact apply/types commands provided
- [ ] **Matrix:** REQ-PROD-01/04 → In progress; REQ-DASH-05 → In progress (schema live)

**Suggested commit:** `feat(db): catalog migration — listing_status, categories, products, variants, indexes, RLS`

---

## Task 1.2 — Storage `products` bucket + `/api/upload` + `ImageUploader`

**REQ-IDs:** REQ-NFR-12 (Supabase Storage, replaces Cloudinary — C3), REQ-PROD-06 (product images)

**Objective:** Create the `products` Storage bucket with ownership RLS, the validated server upload route, the `lib/storage` helpers, the reusable `useUpload` hook, and the `ImageUploader` component. **Reuse flag:** `ImageUploader`/`useUpload` are reused by services, portfolio, and avatars later (COMPONENT_TREE Reuse map) — build them generic (bucket-parametrized) now.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Implement Supabase Storage upload per DATABASE.md §7, API_MAP "Uploads/Storage", CLAUDE_RULES §5, and Decision D3 (server route, user-session client, RLS-enforced — NO service-role on the client). No Cloudinary (C3).

1. Migration supabase/migrations/0003b_storage_products.sql (or extend via SQL I run in the dashboard if buckets aren't migratable in this setup — tell me which): create the 'products' Storage bucket (public read); Storage RLS policies so an authenticated user may insert/update/delete objects only under a path they own (path convention: `products/{auth.uid()}/{productId}/{filename}`); public SELECT on the bucket. Document the path convention.
2. lib/constants.ts — define PRODUCT_IMAGE_LIMITS = { maxCount: 6, maxSizeBytes: 5*1024*1024, allowedMime: ['image/jpeg','image/png','image/webp'] } as const. This is the SINGLE source for image limits (approval constraint — bump maxCount to 8 here only for premium/dress later). Both the route and ImageUploader import it; never re-hardcode the numbers/mime.
3. lib/storage/buckets.ts — typed bucket names enum/const ('avatars'|'products'|'services'|'portfolio') as the single source; helpers to build object paths.
4. POST /api/upload (Route Handler) — User auth required. Accept multipart form-data: files[] + a `bucket` field (must be an allowed bucket). Validate against PRODUCT_IMAGE_LIMITS (mime ∈ allowedMime, each ≤ maxSizeBytes, count ≤ maxCount). Upload via the cookie-bound SERVER client (user session → Storage RLS enforces ownership). Return { data: { urls: string[], items: [{url, path}] } }. Errors: 400 BAD_FILE/VALIDATION, 401 UNAUTHENTICATED, 413 TOO_LARGE. Typed envelope { data } | { error:{code,message} }.
5. lib/hooks/use-upload.ts — useUpload(): client hook wrapping POST /api/upload (progress/pending/error state, returns urls). No `any`.
6. components/shared/ImageUploader.tsx — reusable, bucket-parametrized: drag/drop + file picker (shadcn-based, no hand-rolled inputs), preview thumbnails via next/image (aspect-ratio, zero CLS), remove, reorder (sort), max-count + size guard mirrored client-side **from PRODUCT_IMAGE_LIMITS** (no re-hardcoding), all labels from messages/*. Loading/empty/error states. Emits the ordered [{url,alt,sort}] shape that products.images expects.

Constraints: service-role NEVER used here (RLS via user session). next/image for all previews. No `any`. All strings via messages/*. RTL-correct (logical props). Reuse shadcn primitives.

When done: pnpm typecheck + pnpm lint; give me the exact bucket-apply step + how to test an upload in the browser. Do not claim it applied. Do not commit.
```

**Files:**
- `supabase/migrations/0003b_storage_products.sql` (bucket + Storage RLS) — or documented dashboard SQL
- `lib/constants.ts` (`PRODUCT_IMAGE_LIMITS` — single source)
- `lib/storage/buckets.ts`
- `app/api/upload/route.ts`
- `lib/hooks/use-upload.ts`
- `components/shared/ImageUploader.tsx`
- `messages/{ar,en}.json` (uploader strings)

**Tests / verification (I run):**
- Authenticated upload of a valid jpg → returns a public URL; the object lands under `products/{uid}/...`.
- Oversized file → `413 TOO_LARGE`; non-image → `400 BAD_FILE`; logged-out → `401`.
- A user cannot write to another user's path (Storage RLS).
- `ImageUploader` previews, reorders, removes; zero layout shift.

**DoD:**
- [ ] `products` bucket + ownership Storage RLS + public read
- [ ] `/api/upload` validates mime/size/count, uses user-session client (no service-role), typed envelope + error codes
- [ ] Image limits sourced ONLY from `PRODUCT_IMAGE_LIMITS` in `lib/constants.ts` (route + uploader import it; no re-hardcoded `6`/`5MB`/mime) — 6→8 is a one-line change
- [ ] `useUpload` + `ImageUploader` reusable & bucket-parametrized (reuse-ready for services/portfolio/avatars)
- [ ] next/image previews, RTL, messages-only strings, no `any`
- [ ] typecheck + lint clean
- [ ] **Matrix:** REQ-NFR-12 → Built; REQ-PROD-06 → In progress (uploader ready; wired in 1.7)

**Suggested commit:** `feat(storage): products bucket + RLS, /api/upload, useUpload, ImageUploader`

---

## Task 1.3 — Reuse primitives I: Money, PriceTag, StatusBadge, Pagination, skeletons

**REQ-IDs:** REQ-NFR-04 (perf — skeletons/CLS), REQ-NFR-08 (design system), CLAUDE_RULES §2 (reuse-first), §6 (money)

**Objective:** Build the small, high-reuse primitives the whole app depends on. **Reuse flag (build once, reuse everywhere):** `lib/money.ts` + `Money`/`PriceTag` (every price display — products, rentals, services, checkout, settlements), `StatusBadge` (orders/bookings/rentals/requests/settlements), `Pagination` (every list), catalog skeletons (every async list/detail).

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Build the shared display/money primitives per COMPONENT_TREE §3 Reuse map, CLAUDE_RULES §6 (money), DESIGN_RULES §5 (components), §11 (skeletons/CLS). These are reused everywhere — build them generic and correct now.

1. lib/money.ts — integer MINOR-UNIT math + formatting (single source). toMinor/fromMinor; a Money type { amountMinor:number; currency:'SAR'|'EGP' } (reuse currency_code from database.types); formatMoney(amountMinor, currency, locale) using Intl.NumberFormat (Arabic-Indic vs Latin digits per locale, currency symbol). NEVER float math. No `any`.
2. components/shared/Money.tsx — renders a formatted amount from { amountMinor, currency } for the active locale (tabular-nums, DESIGN_RULES §3.1). 
3. components/shared/PriceTag.tsx — composes Money for catalog/detail (supports a struck-through compare-at later; not required now). Serif option for detail price per DESIGN_RULES §3.1.
4. components/shared/StatusBadge.tsx — maps a status string → the functional token (success/warning/destructive/info with 10% tint) + Lucide icon + label from messages; variants cover listing_status now (draft/active/inactive/rejected) and are extensible to order/booking/rental statuses later. Never color-only (icon + text — §10).
5. components/shared/Pagination.tsx — server-driven (page/limit/total → page links), URL-based (works with Decision D1/D2), prev/next + page numbers, disabled states, RTL chevrons mirror, a11y (aria-current). 
6. components/shared/ProductCardSkeleton.tsx + a generic skeleton list — match the real ProductCard shape/spacing exactly (no layout shift, §11), subtle bg-muted→bg-accent shimmer.

Constraints: semantic tokens only; Lucide icons; messages-only strings; RTL logical props; no `any`. Server components unless interactivity is needed.

When done: pnpm typecheck + pnpm lint; add a unit test for lib/money.ts (minor↔major, format per SAR/EGP + ar/en). Report. Do not commit.
```

**Files:**
- `lib/money.ts`, `tests/unit/money.test.ts`
- `components/shared/{Money.tsx,PriceTag.tsx,StatusBadge.tsx,Pagination.tsx,ProductCardSkeleton.tsx}`
- `messages/{ar,en}.json` (status labels, pagination aria)

**Tests / verification:**
- `pnpm test` → money unit tests green (minor↔major, SAR/EGP formatting, ar Arabic-Indic vs en Latin digits)
- Skeleton matches ProductCard dimensions (visual, in 1.6)

**DoD:**
- [ ] `lib/money.ts` integer-only math + locale/currency formatting; unit-tested
- [ ] `Money`/`PriceTag`/`StatusBadge`/`Pagination`/skeleton built, tokenized, RTL, a11y
- [ ] No `any`; messages-only; Lucide-only
- [ ] typecheck + lint + unit tests pass
- [ ] **Matrix:** note primitives built (reused by Phases 2–5); no REQ flips required yet

**Suggested commit:** `feat(shared): money lib + Money/PriceTag/StatusBadge/Pagination/skeletons`

---

## Task 1.4 — Reuse primitives II: useFilters (URL state), FilterBar, DataTable<T>

**REQ-IDs:** REQ-PROD-02 (filters/sort), REQ-NFR-04 (perf), CLAUDE_RULES §2 (reuse-first)

**Objective:** The filtering + table primitives. **Reuse flag:** `useFilters`/`FilterBar` (products, rentals, services, planners) and `DataTable<T>` (every dashboard table — products, orders, bookings, approvals, settlements). Build to Decisions D1 and D4.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Build the filtering + table primitives per COMPONENT_TREE §3/§7, DESIGN_RULES §5 (Tables, FilterBar), and Decisions D1 (URL state) + D4 (in-house typed DataTable). Reused across many later phases — keep them generic.

1. lib/hooks/use-filters.ts — useFilters(): reads/writes catalog filters as URL searchParams via next/navigation (the SINGLE source of truth, D1). Typed accessors for: category (slug/id), minPrice, maxPrice, sort ('newest'|'price_asc'|'price_desc'|'top_rated'), page, limit. Debounce text/price inputs (300ms, §11). Updating a filter resets page to 1. No `any`.
2. components/shared/FilterBar.tsx — category select (from getCategories — Task 1.5), price min/max, sort select; all bound to useFilters; "clear all"; fully RTL; labels/placeholders from messages/*. Mobile: collapses into a shadcn Sheet/Popover. Reuse shadcn Select/Input — no hand-rolled.
3. components/shared/DataTable.tsx — generic DataTable<T>: props { columns: Column<T>[]; rows: T[]; isLoading?; emptyState?; pagination? }. Column<T> = { id:string; header:ReactNode; cell:(row:T)=>ReactNode; align?:'start'|'end'; sortable?:boolean }. Stripe-style (DESIGN_RULES §5 Tables): airy rows, hairline dividers, sticky header, right-aligned numerics (tabular-nums), row hover, built-in loading (skeleton rows) + EmptyState + Pagination slots. No `any`; fully typed generic; RTL.

Constraints: URL state only (no client store); typed generics (no `any`); semantic tokens; Lucide; messages-only; RTL logical props; reuse shadcn primitives + the Phase-0 EmptyState/LoadingState + the Pagination from Task 1.3.

When done: pnpm typecheck + pnpm lint; report. Do not commit.
```

**Files:**
- `lib/hooks/use-filters.ts`
- `components/shared/{FilterBar.tsx,DataTable.tsx}`
- `messages/{ar,en}.json` (filter/sort/table strings)

**Tests / verification:**
- Changing a filter updates the URL searchParams (shareable); reload preserves state; changing a filter resets `page=1`.
- `DataTable<T>` renders typed columns; loading shows skeleton rows; empty shows EmptyState; pagination wires to URL.

**DoD:**
- [ ] `useFilters` URL-synced, typed, debounced, page-reset-on-change (D1)
- [ ] `FilterBar` (category/price/sort), RTL, messages-only, mobile-collapsible
- [ ] `DataTable<T>` generic, typed (D4), Stripe-style, loading/empty/pagination slots
- [ ] No `any`; typecheck + lint pass
- [ ] **Matrix:** REQ-PROD-02 → In progress (primitives ready; wired in 1.6)

**Suggested commit:** `feat(shared): useFilters (url state), FilterBar, DataTable<T>`

---

## Task 1.5 — Categories API + public query

**REQ-IDs:** REQ-DASH-05 (admin manages categories), REQ-PROD-02 (categories drive product filters)

**Objective:** The categories endpoints per API_MAP (`GET/PUT /api/admin/categories`, admin-gated) plus a cached public `getCategories` query reused by `FilterBar` and `ProductForm`.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Implement categories per API_MAP "Admin /api/admin/categories", DATABASE.md §3.2, CLAUDE_RULES §5. Typed envelope { data } | { error:{code,message} }.

1. features/catalog/categories.ts — getCategories({ kind }): cached public read (RLS public SELECT) via the server client, wrapped in unstable_cache with tag 'categories' (Decision D5). Returns typed categories (id, parent_id, kind, name_ar, name_en, slug, sort_order) ordered by sort_order. No `any`.
2. GET /api/admin/categories — Admin only (verify role via profiles server-side; 401/403). Returns { data: { categories } }.
3. PUT /api/admin/categories — Admin only. Zod-validated upsert/reorder (create/rename/reparent/sort). Writes via the service-role admin client (categories writes are service-role only per RLS). On success revalidateTag('categories'). Errors 400 VALIDATION, 401, 403 FORBIDDEN.
4. (UI optional this phase) If time allows, a minimal admin CategoryManager using DataTable lives in /dashboard/admin; otherwise mark the admin UI deferred to the admin phase in the matrix (do not silently skip).

Constraints: admin gate server-side (never trust client role); service-role only in the route (server). No `any`. Strings via messages/*.

When done: pnpm typecheck + pnpm lint; report. Do not commit.
```

**Files:**
- `features/catalog/categories.ts`
- `app/api/admin/categories/route.ts`
- `features/catalog/schema.ts` (category Zod — may be shared with products schema)

**Tests / verification (I run):**
- `getCategories({kind:'product'})` returns seeded categories; anon-readable.
- `GET/PUT /api/admin/categories` → 403 for non-admin, 200 for admin; PUT updates + `revalidateTag('categories')`.

**DoD:**
- [ ] `getCategories` cached (tag `categories`), typed, public-readable
- [ ] Admin GET/PUT gated server-side (401/403), writes via service-role, revalidates
- [ ] No `any`; typecheck + lint pass
- [ ] **Matrix:** REQ-DASH-05 → Built (API) or note admin UI deferred to admin phase with reason

**Suggested commit:** `feat(catalog): categories api (admin) + cached public getCategories`

---

## Task 1.6 — Public browsing: products read API + list + detail

**REQ-IDs:** REQ-PROD-01 (catalog), REQ-PROD-02 (filters/sort/pagination), REQ-PROD-03 (detail), REQ-NFR-04 (RSC/caching/next-image)

**Objective:** Read endpoints + public catalog pages. **Reuse flag:** `ProductCard`, `ProductGrid`, `ProductGallery` are reused by rentals/services/planner cards & galleries — build to spec. Quality bar: Zara + Amazon (§9).

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system
   (semantic tokens, 8px spacing, 3 shadows, radii, Lucide, RTL logical props, no emoji).

Build public product browsing per API_MAP Products, COMPONENT_TREE §1/§6/§10, DESIGN_RULES §5/§9/§11, USER_FLOWS §2, and Decisions D1/D2/D5.

Backend (typed envelope { data } | { error:{code,message} }):
1. features/catalog/{schema.ts,queries.ts}: ProductFilters Zod (category, minPrice, maxPrice, sort, page, limit; defaults page=1/limit=20); listProducts(filters) — server query over products WHERE status='active' (+ category/price filters, sort newest|price_asc|price_desc|top_rated), index-backed, returns { items, total, page }; getProductById(id) — active product + its product_variants (+ reviews placeholder []). Wrap reads in unstable_cache with tags 'products' / `product:{id}` (D5). No `any`; use database.types.
2. GET /api/products?category=&minPrice=&maxPrice=&sort=&page=&limit= → { data:{ items, total, page } }. 400 VALIDATION.
3. GET /api/products/:id → { data:{ product, variants, reviews } }. 404 NOT_FOUND when missing/!active.

Frontend (RSC-first):
4. app/[locale]/products/page.tsx (Server Component): reads searchParams (D1) → listProducts; renders FilterBar + ProductGrid(ProductCard) + Pagination. Wrap the grid in Suspense with the ProductCardSkeleton grid (no CLS). Empty state via EmptyState ("no products match"). 2→3→4 cols (DESIGN_RULES §4.3).
5. components/catalog/ProductCard.tsx: media (next/image, fixed aspect-ratio, blur, sizes) → title (h3) → meta → PriceTag → action; bg-card, border-border, radius lg, shadow-soft; hover shadow-raised + -translate-y-0.5 + image scale-105 (§5). RTL. Links to /products/[id].
6. components/catalog/ProductGrid.tsx (layout), components/catalog/ProductGallery.tsx (detail gallery: main image + thumbnails, next/image, keyboard + a11y; reused by services/planner), components/catalog/VariantSelector.tsx (size/color from product_variants; pure display + selection state — Add-to-cart is Phase 2, render a disabled/placeholder AddToCart button).
7. app/[locale]/products/[id]/page.tsx (Server Component): getProductById → ProductGallery + ProductInfo (title, serif price via PriceTag, description, StatusBadge if needed) + VariantSelector + ReviewsSection placeholder. generateMetadata (title/description/OG) per REQ-NFR-07. 404 via not-found.

Constraints: RSC for all reads (no client waterfalls); next/image for ALL images with aspect-ratio (zero CLS, §11); server-side pagination (D2); index-backed queries; cache tags (D5); messages-only strings; RTL; no `any`. Reuse Money/PriceTag/FilterBar/Pagination/skeletons/EmptyState from 1.3/1.4 + Phase 0.

When done: pnpm typecheck + pnpm lint; tell me exactly what to check in the browser (/products with filters/sort/pagination, /products/[id]) and note the E2E I'll extend in 1.8. Do not claim it renders. Do not commit.
```

**Files:**
- `features/catalog/{schema.ts,queries.ts}`
- `app/api/products/route.ts`, `app/api/products/[id]/route.ts`
- `app/[locale]/products/page.tsx`, `app/[locale]/products/[id]/page.tsx`
- `components/catalog/{ProductCard.tsx,ProductGrid.tsx,ProductGallery.tsx,VariantSelector.tsx}`
- `messages/{ar,en}.json` (catalog strings)

**Tests / verification (I run, `pnpm dev`):**
- `/products` lists only `active` products; category/price filters + 4 sorts work; pagination changes pages via URL; empty state shows for no matches.
- `/products/[id]` shows gallery + info + variants; a `draft`/missing id → 404.
- Lighthouse: no CLS from images; skeletons match cards.

**DoD:**
- [ ] `GET /api/products` (filters/sort/pagination, `{items,total,page}`) + `GET /api/products/:id` ({product,variants,reviews}); error codes per API_MAP
- [ ] RSC reads, `unstable_cache` tags `products`/`product:{id}` (D5), index-backed, server-side pagination (D2)
- [ ] ProductCard/Grid/Gallery/VariantSelector to DESIGN_RULES §5/§9; next/image zero-CLS; 2→3→4 grid; RTL; messages-only
- [ ] `generateMetadata` on detail (REQ-NFR-07); 404 handled
- [ ] No `any`; typecheck + lint pass
- [ ] **Matrix:** REQ-PROD-01/03 → Built; REQ-PROD-02 → Built; REQ-NFR-04 → In progress (catalog caching/CLS)

**Suggested commit:** `feat(catalog): products read api + public list/detail (card, grid, gallery, variants)`

---

## Task 1.7 — Seller product CRUD + ProductManager

**REQ-IDs:** REQ-PROD-05 (seller CRUD, RLS owner-only), REQ-PROD-04 (variants), REQ-PROD-06 (images persisted), REQ-NFR-03 (seller sees only own — RBAC)

**Objective:** Seller write endpoints + the dashboard ProductManager (DataTable + ProductForm + ImageUploader + variants editor). **P0 integrity:** owner-only via RLS + server ownership re-check; a seller can never read/write another seller's product.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Implement seller product management per API_MAP Products (POST/PUT/DELETE), COMPONENT_TREE (ProductManager/ProductForm), USER_FLOWS §11, DATABASE.md §3.3/§3.4, CLAUDE_RULES §5 (RLS-first). Typed envelope.

Backend:
1. features/catalog/{schema.ts (extend),mutations.ts}: ProductSchema (Zod) — title, description, category_id, price (>=0), currency, is_rentable (+ rental_daily_price/security_deposit required when rentable), images [{url,alt,sort}], stock, status, variants[] (size/color/stock/sku). createProduct/updateProduct/deleteProduct + variant upserts, RLS-scoped via the user-session server client (seller_id = auth.uid()); revalidateTag('products') + `product:{id}` on every write (D5).
2. POST /api/products — Seller only (role seller AND status active — pending sellers cannot list, REQ-AUTH-05). 401/403 FORBIDDEN/400 VALIDATION. Sets seller_id from the session (NEVER from the body).
3. PUT /api/products/:id — Owner only (RLS + server re-check seller_id===auth.uid()). 401/403/404. Partial.
4. DELETE /api/products/:id — Owner only. 401/403/404 → { ok }.
   Seller's own list: getMyProducts() (seller_id = auth.uid(), all statuses incl. draft).

Frontend (app/[locale]/dashboard/seller):
5. ProductManager — DataTable<Product> of the seller's OWN products (image thumb, title, PriceTag, stock, StatusBadge, actions); "Add product" primary CTA; row actions edit/delete (delete via ConfirmDialog). Pending sellers see the PendingApprovalBanner with actions disabled (REQ-AUTH-05).
6. ProductForm — shadcn Form + react-hook-form + Zod (shared ProductSchema): fields above + category Select (getCategories) + ImageUploader (Task 1.2) + a variants editor (add/remove size/color/stock/sku rows). Save → create/update; toast; optimistic-safe. All strings messages/*.

Constraints: ownership enforced by RLS AND a server-side re-check; seller_id/status never trusted from the client; pending sellers blocked from create (REQ-AUTH-05); reuse DataTable/ImageUploader/Money/StatusBadge/ConfirmDialog; no `any`; messages-only; RTL.

When done: pnpm typecheck + pnpm lint; add the seller-CRUD integration test stub + tell me the browser steps. Do not claim it renders. Do not commit.
```

**Files:**
- `features/catalog/{schema.ts,mutations.ts,queries.ts}` (extend)
- `app/api/products/route.ts` (POST), `app/api/products/[id]/route.ts` (PUT/DELETE)
- `app/[locale]/dashboard/seller/page.tsx` (ProductManager)
- `components/catalog/{ProductManager.tsx,ProductForm.tsx,VariantsEditor.tsx}` (or under `features/catalog`)
- `components/shared/ConfirmDialog.tsx` (if not present)
- `messages/{ar,en}.json`

**Tests / verification (I run):**
- Seller A creates a product with images → appears in A's ProductManager and (when `active`) on `/products`.
- Seller A cannot read/update/delete Seller B's product (RLS + server re-check) → 403/404.
- A `pending` seller cannot create (blocked + banner).
- Images persist onto `products.images`; delete removes the row.

**DoD:**
- [ ] POST/PUT/DELETE `/api/products` owner-only (RLS + server re-check); `seller_id` from session only; error codes per API_MAP
- [ ] Pending seller cannot list (REQ-AUTH-05)
- [ ] ProductManager (DataTable) shows only own products; ProductForm + ImageUploader + variants editor work; ConfirmDialog on delete
- [ ] revalidateTag on every write (D5); images persist (REQ-PROD-06)
- [ ] No `any`; messages-only; RTL; typecheck + lint pass
- [ ] **Matrix:** REQ-PROD-05 → Built; REQ-PROD-04 → Built; REQ-PROD-06 → Built; REQ-NFR-03 → progressed (seller isolation verified)

**Suggested commit:** `feat(catalog): seller product crud (owner-rls) + ProductManager/ProductForm/variants`

---

## Task 1.8 — Phase DoD gate: tests, E2E, preview, matrix reconcile

**REQ-IDs:** Phase 1 DoD; REQ-NFR-05 (RLS verified), REQ-NFR-10 (catalog E2E), REQ-NFR-11 (preview deploy)

**Objective:** Close Phase 1: clean gates, an extended Playwright catalog flow, RLS owner-only integration tests, a green Vercel **preview**, applied migrations + current types, reconciled matrix, acceptance doc.

**Prompt:**
```
MANDATORY FIRST STEPS (do before writing any code):
1. Read docs/CLAUDE_RULES.md (engineering standards).
2. Read docs/DESIGN_RULES.md (single source of truth for all UI/UX).
3. Follow BOTH documents fully before writing any code.
4. Never violate any rule in either document (see DESIGN_RULES.md §17 Forbidden).
5. Keep the entire application visually consistent with the established design system.

Close Phase 1 to its DoD per IMPLEMENTATION_PLAN Phase 1 and CLAUDE_RULES §0/§11/§12. Environment reality: you WRITE; I run db push / db:types / dev / test:e2e / deploy and paste results — do not claim live steps pass.

1. Ensure pnpm typecheck + pnpm lint are clean across the project; fix anything outstanding.
2. Extend Playwright E2E (tests/e2e/) with a CATALOG flow so I keep one-command verification (reuse the Phase-0 harness, ar+en projects, opt-in/teardown patterns):
   - public: browse /products → apply a category + price filter + a sort → open a product detail.
   - seller: log in as a seller → add a product with an image → it appears in ProductManager and on /products.
   - assert RTL on /ar, no console errors, data-testids on FilterBar/ProductCard/ProductForm/ImageUploader.
   Document the run command (pnpm test:e2e) and what green looks like. Note any created test products + teardown SQL (I run it).
3. RLS owner-only integration test (tests/integration, opt-in like rls.test.ts): seller A cannot select/update/delete seller B's product; anon cannot read a draft; public reads active only. Provide runnable test code AND a Supabase SQL-editor block with expected results.
4. Confirm migrations 0003 (+0003b storage) apply and lib/database.types.ts reflects categories/products/product_variants (committed in the phase commit).
5. Vercel PREVIEW: list any new env (none expected beyond Phase 0); confirm the products bucket exists in the linked project; preview acceptance checklist: /ar RTL + /en, /products lists active products with working filters/sort/pagination, /products/[id] renders, seller can add a product with image, seller sees only own. PREVIEW ONLY (CLAUDE_RULES §12).
6. Update REQUIREMENTS_MATRIX.md: REQ-PROD-01..06 → Built (or explicitly deferred with reason); REQ-NFR-12 → Built; REQ-NFR-04 → In progress (catalog caching/CLS done; broader perf later); REQ-DASH-05 (admin UI deferred if not built); add a changelog line. Produce docs/PHASE_1_ACCEPTANCE.md (passes / deferred-with-reason / surfaced conflicts / carry-forwards).

Constraints: PREVIEW only; no production, no real payments/emails. No `any`. Report typecheck/lint/test results, E2E + deploy commands with expected green, env list, matrix diff. Commit only on my explicit confirm.
```

**Files:**
- `tests/e2e/catalog.spec.ts` (+ fixtures reuse), `tests/integration/products-rls.test.ts`
- `REQUIREMENTS_MATRIX.md` (status updates + changelog)
- `docs/PHASE_1_ACCEPTANCE.md`

**Tests / verification (I run):**
- `pnpm typecheck` + `pnpm lint` clean; `pnpm test` (unit + opt-in integration) green.
- `pnpm test:e2e` → catalog flow + Phase-0 auth flow all pass (ar+en).
- Vercel **preview** green; acceptance checklist passes.

**DoD (Phase gate):**
- [ ] typecheck + lint + unit + (opt-in) integration green
- [ ] Catalog E2E (browse→filter→detail; seller add-with-image) green, ar+en
- [ ] RLS owner-only proven (seller A ⊥ seller B; anon ⊥ draft) by test + SQL block
- [ ] Migrations applied; `database.types.ts` current; `products` bucket live
- [ ] Vercel **preview** green; acceptance checklist passes
- [ ] Matrix reconciled (REQ-PROD-01..06, REQ-NFR-12/04, REQ-DASH-05); `PHASE_1_ACCEPTANCE.md` written
- [ ] Phase commit only on explicit confirm

**Suggested commit (whole phase, only on confirmation):**
`feat(catalog): products, variants, categories, storage, seller crud`

---

## Phase 1 → Phase 2 handoff checklist

Before starting Phase 2 (Cart, Orders, Hybrid Payments & COD), confirm:

- [ ] `categories` / `products` / `product_variants` live; RLS = public read `active` / owner CRUD verified (seller A ⊥ seller B)
- [ ] `products` Storage bucket + ownership RLS; `/api/upload` validated; images persist on `products.images`
- [ ] Reuse primitives ready & in use: **Money/`lib/money.ts`**, **PriceTag**, **StatusBadge**, **Pagination**, **useFilters/FilterBar**, **DataTable<T>**, **ImageUploader/useUpload**, **ProductGallery** — Phase 2 reuses Money/DataTable/StatusBadge for cart/orders/settlements
- [ ] Public catalog: list (filters/sort/pagination) + detail render; RSC + cache tags (`products`/`product:{id}`); zero-CLS images
- [ ] Seller ProductManager CRUD working; pending sellers blocked (REQ-AUTH-05 upheld)
- [ ] Catalog E2E green (ar+en); RLS owner-only tests green
- [ ] `database.types.ts` regenerated and committed; migration order intact (`0003` applied; `0004_*` is Phase 2)
- [ ] `REQUIREMENTS_MATRIX.md` reconciled; `PHASE_1_ACCEPTANCE.md` written
- [ ] Carry-forwards noted for their phases: admin CategoryManager UI (admin phase), compare-at price (later), cursor pagination (Phase 6+ scale), Tap webhook-secret confirmation (Phase 2)
```
