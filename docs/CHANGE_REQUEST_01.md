# CHANGE_REQUEST_01.md — Markets, Multi-Market Pricing, Vendor Verification & Richer Products

> **Status:** PROPOSAL for review — **v2 (open questions resolved + escrow flow added).** **No schema, migration, or code has been written.** Nothing here is applied until you approve. It does **not** modify any other doc — on approval, the reconciled edits land in `REQUIREMENTS_MATRIX.md` (the law), `DATABASE.md`, `API_MAP.md`, `USER_FLOWS.md`, `IMPLEMENTATION_PLAN.md`, and `SYSTEM_ARCHITECTURE.md`.
> **Scope:** six new/clarified requirements (A–F) + optional G (now **promoted**, see decisions) + a major new **payment-escrow / delivery-OTP / disputes** flow (§H), reconciled against the current build (Phase 0 COMPLETE, Phase 1 catalog Built — `REQUIREMENTS_MATRIX.md §B`, `§A`).
> **Author note:** I cite exact doc sections throughout. Where a closed-phase table (`0003_catalog.sql` → `products`/`product_variants`, `DATABASE.md §3.3/§3.4`; `0001_foundation.sql` → `profiles`) must change, it is flagged as a **follow-up migration to a closed phase**.

---

## Decisions incorporated (resolved 2026-06-30) — supersede the v1 open questions

| # | Decision | Design impact (detailed in the sections) |
|---|----------|-------------------------------------------|
| **Q-B1** | **Per-market stock** — each market is a local branch with its own inventory. | Stock is market-scoped on BOTH paths: `product_prices.stock` (no-variant) and a new **`product_variant_stock(variant_id, market)`** table; `product_variants.stock` is **dropped** (§B.1). |
| **Q-A** | **First-visit market chooser**; geo is only a hint/default the visitor can override; market in cookie → `profiles.market`. Market stays separate from locale. | Add a **MarketChooser** gate; middleware never silently trusts geo (§A.1/§A.4, REQ-MKT-02). |
| **Q-C1** | **A user can be BOTH seller and provider.** | `vendor_applications` keyed **`unique(applicant_id, role)`** (not one row per user); capability derived per approved application; `profiles.role` becomes "primary/display", real authorization reads approved applications (§C.1, new REQ-VEND-05 + reconcile REQ-AUTH-03). |
| **Q-G1** | **Filterable attributes** — typed tables with a controlled vocabulary; sellers pick from defined options so facets work. | `attribute_definitions` + `attribute_options` + `product_attributes` (EAV w/ controlled values); REQ-PROD-09 promoted **P2→P1**; REQ-PROD-02 filters extend to facets (§G). |
| **Q-F1** | **Remove `event_planners.is_verified`** — unify on `vendor_verification` + `profiles.is_verified`. | `event_planners` public-read gate joins `profiles.is_verified`; `PUT /api/event-planners/:id/verify` becomes the unified KYC review (§F.1). |
| **Escrow** | **Funds are HELD, not paid on purchase** — capture/place → `held` → delivery confirmed via courier **OTP** → acceptance window (configurable) → **HELD→AVAILABLE** on customer "received & satisfied" OR auto-release on expiry; **dispute** during window keeps funds held for admin resolution. | New §H — folds into **Phase 2 commerce**; extends `settle_status`, `settlements`, `orders`; adds OTP, disputes, auto-release job, configurable window. |
| **Payout (H-Q1)** | **System-of-record escrow + MANUAL pluggable payout for launch.** The system computes per-order commission/net, per-vendor **HELD→AVAILABLE→PAID** buckets, COD-commission debt, and **net-payable netting**. Admin only views the computed NET, transfers via bank **outside the system**, and clicks **"Mark as paid"** (audited). Single Tap merchant for collection (NOT Marketplace); payout step is a pluggable `PayoutProvider` (manual now → Tap Marketplace later) with **no change to ledger math**. | New §H.1b + §H.8; new `payouts` table + `vendor_balances` view + `settlement_entry`/`payout_method` enums; new REQ-PAY-12/13. **Flags:** legal/compliance (holding third-party funds in EG/SA), admin-only audited payout, ledger = single source of truth. |

---

## 0. Executive summary & recommended execution order

The requirements split into **three work packages** (two inserted between Phase 1 and Phase 2; escrow folds into Phase 2):

| Pkg | Requirements | Touches | Proposed phase | Why now / later |
|-----|-------------|---------|----------------|-----------------|
| **CR-1A · Markets, Pricing & Attributes** | A, B, E (minimal), G | `products` + `product_variants` (alter), new `product_prices`, `product_variant_stock`, `vendor_markets`, `attribute_definitions/_options`, `product_attributes`; market resolution + MarketChooser in `middleware.ts`; catalog query/filters/`ProductCard`/`ProductForm`/seed | **New Phase 1.5 (now)** | Catalog is Built (`§B` all `Built`). A/B/G **alter the live `products`/`product_variants` tables** — cheapest to do now, before Phase 2 commerce reads price/currency/stock. |
| **CR-1B · Vendor Onboarding & Verification** | C, D, E (full), F (schema) | new `vendor_applications`, `vendor_verification`, private `verification-docs` bucket, admin review flow; generalize to providers/planners; multi-role capability | **New Phase 1.6 (before Phase 2)** | Gates listing (`REQ-AUTH-05`). Schema + seller flow now; provider/planner **UI** rides Phase 4/5. |
| **CR-2 · Escrow, Delivery-OTP & Disputes** | §H (REQ-PAY-08..11) | `orders`, `settlements`, `payments`, `platform_settings` (alter); new `disputes`, `order_deliveries`; `settle_status`+`dispute_status` enums; auto-release cron edge fn | **Folded into Phase 2 (commerce)** | Payments/settlements/COD live in Phase 2 (`DATABASE.md §3.6–3.9`, `IMPLEMENTATION_PLAN Phase 2`). Escrow IS the settlement design — build it with Phase 2, not after. |

**Recommended order:**
1. **Approve this v2 doc** → reconcile the 6 planning docs (matrix REQ-IDs, DATABASE tables/enums/RLS, API_MAP, USER_FLOWS, IMPLEMENTATION_PLAN Phases 1.5/1.6 + expanded Phase 2, SYSTEM_ARCHITECTURE private bucket/market middleware/cron).
2. **CR-1A migration** (`0008_markets_pricing.sql`): `market` enum; new `product_prices`, `product_variant_stock`, `vendor_markets`, `attribute_definitions/_options`, `product_attributes`; alter `products` (drop money/stock cols) + `product_variants` (drop `stock`) + `profiles` (add `market`); regen types; rewrite catalog query/filters/`ProductCard`/`ProductForm`/seed + market middleware/MarketChooser. Re-gate Phase 1 e2e (market-aware + facet filters).
3. **CR-1B migration** (`0009_vendor_verification.sql`): `verification_status` enum; `vendor_applications` (multi-role) + `vendor_verification` + private bucket + RLS + `profiles.is_verified`; admin review endpoints + onboarding flow change. Tables generalized to all vendor roles.
4. **CR-2** lands as part of **Phase 2** (`0004_commerce.sql` extended, or a paired `0004b`): escrow hold/release, OTP, disputes, auto-release. Phase 2 consumes the active market's currency throughout.

**Hard dependencies:** B before A's catalog filter (filter keys off `product_prices.market`) — one migration. CR-2 depends on the Phase-2 `orders`/`payments`/`settlements` tables, so it is authored **with** Phase 2, not before.

---

## A) REGIONAL CURRENCY ISOLATION (independent markets)

**Intent (your spec):** Egypt (EGP) and Saudi (SAR) are self-contained. A visitor sees ONLY products priced for their market, in that currency, pays local COD, local shipping. No FX, no cross-border. A product not priced for the visitor's market is invisible to them. Market is resolved by geo/IP or profile/selection; **market is separate from locale** (`ar`/`en`).

### A.1 Tables / columns / enums
- **New enum `market` `('EG','SA')`** (created in the CR-1A migration). Conceptually distinct from `currency_code` (`DATABASE.md §2`, already `SAR`/`EGP`) even though 1:1 today — market governs *visibility, shipping, COD, fulfillment*; currency is the money unit. Keep both; derive currency from market via a fixed map (`EG→EGP`, `SA→SAR`) in `lib/markets.ts` (new), never entered twice.
- **`profiles` (`§3.1`) + column `market market null`** — the buyer's chosen market (nullable until chosen). Optional companion `country text null` to retain the raw geo hint. *Non-breaking add.*
- Market→currency is **not** stored redundantly on the buyer; it's derived.
- **Decision Q-A — explicit chooser, geo is only a hint.** Resolution order: **cookie `market`** → `profiles.market` → (first visit) **show a MarketChooser**, pre-highlighting the geo guess (Vercel `request.geo.country`) but never auto-committing it. The chosen value is written to the cookie and (if logged in) `profiles.market`. The visitor can switch any time via the **MarketSwitcher**.

### A.2 RLS affected
- **`products` public read becomes market-scoped** (see B.2 — the real filter lives on `product_prices`). The current policy `products_select_active` (`§3.3`, `using status='active'`) stays, but **public catalog visibility is gated by EXISTS a `product_prices` row for the active market**. Because RLS can't read a request cookie, the **market filter is applied in the query layer** (`features/catalog/queries.ts`), not RLS — RLS still enforces `status='active'`; the query adds `inner join product_prices on market = :activeMarket`. (Document this split clearly: RLS = "is it public?", query = "is it in *your* market?".)

### A.3 API_MAP endpoints
- `GET /api/products` (`API_MAP.md §Products`) gains an implicit **market context** (from cookie/geo, server-resolved) — not a client-trusted query param. Optionally accept `?market=` only for admin/testing. Response prices are the market's `product_prices` row.
- `GET /api/products/:id` returns the product **only if it has a price in the active market**, else `404 NOT_FOUND` (consistent with "invisible"). 
- **New** `GET /api/market` / `POST /api/market` (or a cookie set via Server Action) to read/set the explicit selector.

### A.4 USER_FLOWS / state machines
- `USER_FLOWS.md §2` (Browse & Buy) gains a step 0: **market resolved or chosen** — first visit shows the **MarketChooser** (geo-hinted, not auto-set, per Q-A); thereafter cookie/`profiles.market`. A **MarketSwitcher** (sibling to `LocaleSwitcher`, `SYSTEM_ARCHITECTURE.md §4`) lets the visitor change it; changing market re-filters the catalog and re-prices everything.
- No state-machine change (markets are a filter/context, not a status).
- **Locale × market matrix** to document: `{ar,en} × {EG,SA}` = 4 combos (e.g. an Egyptian shopping in English = `en` + `EG`/`EGP`). `middleware.ts` (`§5/§6`) already resolves locale; it gains parallel market resolution.

### A.5 REQUIREMENTS_MATRIX REQ-IDs (new section **M. Markets**)
- **REQ-MKT-01** (P0) — Regional market isolation: each market self-contained (local currency, shipping, COD; no FX/cross-border). *Reconciles conflict `C10` (`§Conflict register`) which currently says only "per-region currency on every monetary row" — this hardens it into full visibility/fulfillment isolation.*
- **REQ-MKT-02** (P0) — Market resolution via **explicit first-visit chooser** (geo only a default hint), persisted cookie→`profiles.market`; separate from locale.
- **REQ-MKT-03** (P0) — Market-filtered catalog visibility: products without a price in the active market are not shown.

### A.6 Phase
- **CR-1A (now).** Market resolution middleware + MarketSwitcher + query filter. Pairs with B (the price rows it filters on).

---

## B) SELLER MARKET + MULTI-MARKET PRICING

**Intent:** A seller declares market(s) (EG, SA, or both); covering a market **requires a verified local presence/branch** (local fulfillment + COD). Single-market → one price; both-markets → **two explicit prices** (one EGP, one SAR), no auto-conversion. Today `products` has a single `price`+`currency` (`DATABASE.md §3.3`) — this must change.

### B.1 Tables / columns / enums — **RECOMMENDATION: a `product_prices` child table** (not per-market columns)

**Recommended: new `product_prices` (Phase 1.5).**

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| product_id | uuid | not null FK→`products(id)` on delete cascade | |
| market | market | not null | EG or SA |
| currency | currency_code | not null | derived from market, stored for money-row consistency (matches every other monetary table) |
| price | numeric(10,2) | not null check (>=0) | |
| rental_daily_price | numeric(10,2) | null check (>=0) | required if `products.is_rentable` |
| security_deposit | numeric(10,2) | null check (>=0) | |
| stock | int | not null default 0 check (>=0) | **per-market base stock** for products WITHOUT variants (local branch inventory) |
| is_available | boolean | not null default true | market-level toggle without deleting the price |
| created_at/updated_at | timestamptz | default now() | |

- **Constraints:** unique `(product_id, market)`; check `currency` matches market map (or enforce in app + trigger).
- **Indexes:** `(product_id)`, `(market, is_available)`, `(market, price)` (market-scoped sort/filter), `(product_id, market)`.

**Per-market variant stock (Decision Q-B1) — new `product_variant_stock`.** Each market is a local branch with its own inventory, so variant stock is market-scoped:

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| variant_id | uuid | not null FK→`product_variants(id)` on delete cascade | |
| market | market | not null | |
| stock | int | not null default 0 check (>=0) | this variant's stock in this market |

- **Constraints:** unique `(variant_id, market)`.
- **Indexes:** `(variant_id)`, `(market)`.
- **Resolved stock rule:** a product with variants → stock = `product_variant_stock` for the active market; without variants → `product_prices.stock` for the active market. (Same "base vs variant" split as today, now market-scoped.)

**Alter `products` (`§3.3`) — follow-up migration to closed Phase 1:**
- **DROP** `price`, `currency`, `rental_daily_price`, `security_deposit`, `stock` (these move to `product_prices`). *(Or, lower-risk transitional: keep them nullable + deprecated for one release; recommend a clean cut since the only data is dummy seed.)*
- **KEEP** market-agnostic fields: `title`, `description`, `category_id`, `is_rentable`, `images`, `status`, `avg_rating`, `total_reviews`.
- **Alter `product_variants` (`§3.4`) — follow-up migration to closed Phase 1:** **DROP** `stock` (moves to `product_variant_stock`, per Q-B1). KEEP `size`, `color`, `sku` (market-agnostic identity); the unique `(product_id, size, color)` stays.

**Why a child table over per-market columns (`price_eg`/`price_sa`/…):**
- Extensible to a 3rd market with **zero schema change** (add an enum value + rows).
- Avoids a sparse wide table of nullable `*_eg`/`*_sa` columns (currency rules say one money value + one currency per row — `DATABASE.md §0`; per-market columns would duplicate that pattern N times).
- Clean RLS + clean market filter (`inner join … where market = :active`).
- Trade-off: every catalog read joins one table (cheap, indexed). Accept.

**Seller market declaration — new `seller_markets`** (generalize to **`vendor_markets`** for F):

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| vendor_id | uuid | not null FK→`profiles(id)` on delete cascade | seller or provider |
| market | market | not null | |
| branch_name | text | null | local presence (REQ basis) |
| branch_address | jsonb | null | local fulfillment |
| is_approved | boolean | not null default false | admin confirms local presence (ties to D/KYC) |
| created_at/updated_at | timestamptz | default now() | |

- **Constraints:** unique `(vendor_id, market)`.
- **Rule:** a seller may only create a `product_prices` row for a market where they have an **approved** `vendor_markets` row → enforced by **RLS policy + app guard + trigger** (cannot conditionally FK — same pattern as `center_offers` provider_type, `DATABASE.md §3.14`).

### B.2 RLS affected
- **`product_prices`:** public `SELECT where is_available and EXISTS(active parent product)`; owner (`product.seller_id = auth.uid()`) full CRUD **restricted to approved markets** (join `vendor_markets.is_approved`); admin service-role. (Mirrors `product_variants` inheriting product ownership, `§3.4`.)
- **`seller_markets`/`vendor_markets`:** owner reads/writes own (but **`is_approved` not self-settable** — same no-escalation pattern as `profiles.role/status`, `§5 Privilege guard`); admin service-role sets `is_approved`; public read of `(vendor_id, market)` for the public seller block (E).
- `products` RLS unchanged except it no longer carries price (visibility still `status='active'`).

### B.3 API_MAP endpoints
- `POST /api/products` / `PUT /api/products/:id` (`API_MAP.md §Products`): `ProductSchema` changes — instead of `price`/`currency`, it carries a **`prices[]`** array (`[{market, price, rental_daily_price?, security_deposit?, stock, is_available}]`), validated so every `market` is one the seller is approved for. `createProduct`/`updateProduct` (`features/catalog/mutations.ts`, REQ-PROD-05) write `product_prices` rows (full-replace per market, like the existing variant replace).
- `GET /api/products` / `:id` return the **active-market price block** only.
- **New** `GET/POST /api/seller/markets` (or `/api/vendor/markets`) — declare markets (creates pending `vendor_markets`); admin approves via the approvals flow (C/D).
- Admin `GET/PUT /api/admin/approvals*` (`§Admin`) extends to approve `vendor_markets` presence.

### B.4 USER_FLOWS
- `USER_FLOWS.md §11 (Seller flow)` + `§10 (Provider onboarding)`: ProductManager (`§11`) — when the seller covers both markets, `ProductForm` shows **two price sets** (EGP + SAR), entered explicitly. Single-market sellers see one. `COMPONENT_TREE` `ProductForm`/`PriceTag` impact noted.
- No new state machine.

### B.5 REQUIREMENTS_MATRIX REQ-IDs
- **REQ-PROD-07** (P0, Phase 1.5) — Multi-market pricing via `product_prices` (per-market price/stock/availability; no auto-conversion).
- **REQ-PROD-08** (P0, Phase 1.5) — Seller market declaration + **local-presence requirement** to cover a market (`vendor_markets.is_approved`).
- **MODIFY REQ-PROD-01/02/03/05/06** (`§B`, currently all `Built`): add a note "market-aware as of CR-01; price/currency moved to `product_prices`" and set Status back to **In progress (CR-1A re-work)** for the touched rows, with a changelog line (never silent — `CLAUDE_RULES §0/§12`).
- **MODIFY conflict `C10`** resolution text.

### B.6 Phase + closed-phase flag
- **CR-1A (now).** ⚠️ **Alters the closed Phase-1 `products` table** (`0003_catalog.sql`, `DATABASE.md §1` migration table). Requires a new migration `0008_markets_pricing.sql` + `pnpm db:types` regen + **re-running the dummy seed** (the seed currently writes `products.price/currency` directly — `scripts/seed-dummy.ts` — and must be rewritten to write `product_prices` + `seller_markets`). Existing seeded data is disposable (dev only), so a clean cut is safe.

---

## C) SELLER ONBOARDING — profile/business data + sample images at application time

**Intent:** On applying, the seller submits full personal/business data + sample product images so the admin reviews against real info before approving (`REQ-AUTH-05` gains a *basis* — today the trigger just sets `pending` with nothing to review, `DATABASE.md §5 handle_new_user`).

### C.1 Tables / columns / enums — **new `vendor_applications`** (generalized for F)

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| applicant_id | uuid | not null FK→`profiles(id)` on delete cascade | **one row per (user, role)** — Q-C1 |
| role | user_role | not null | `seller` or `provider` |
| business_name | text | not null | |
| business_type | text | null | freelancer/center/store |
| contact_phone | text | not null | |
| business_address | jsonb | null | |
| markets | market[] | not null | markets requested (feeds `vendor_markets`) |
| sample_images | jsonb | not null default `'[]'` | `[{url,alt,sort}]` Supabase Storage (public `products`/`services` bucket) |
| status | profile_status | not null default `'pending'` | reuse existing enum (`pending/active/suspended/rejected`, `§2`) |
| review_notes | text | null | admin feedback on reject |
| reviewed_by | uuid | null FK→`profiles(id)` | admin |
| reviewed_at | timestamptz | null | |
| created_at/updated_at | timestamptz | default now() | |

- **Indexes:** unique `(applicant_id, role)`, `(status)`, `(role, status)`.

**Decision Q-C1 — a user can be BOTH seller and provider.** Today `profiles.role` is a single enum (`§3.1`, `REQ-AUTH-03`). Reconciliation:
- `profiles.role` becomes the **primary/display role** (signup choice); it no longer gates capability.
- **Capability is derived from approved applications:** "can sell" = an `active` `vendor_applications` row with `role='seller'`; "can offer services" = one with `role='provider'`. Product RLS/guards check the seller capability; service RLS/guards check the provider capability (not `profiles.role`).
- A both-role user reaches **both** the seller and provider dashboards. `middleware.ts` (`SYSTEM_ARCHITECTURE §5/§7`) + `lib/rbac.ts` change from "role ==" to "has capability". New **REQ-VEND-05** captures this; **REQ-AUTH-03** gets a reconciliation note (role → primary + capabilities).

### C.2 RLS
- Owner (`applicant_id = auth.uid()`) inserts + reads + updates own **while `status='pending'`**; **cannot set `status`/`reviewed_*`** (no-escalation, `§5`). Admin service-role reads all + approves/rejects. No public read.

### C.3 API_MAP
- **New** `POST /api/vendor/applications` (submit), `GET /api/vendor/applications/me` (own status), `GET /api/admin/applications` + `PUT /api/admin/applications/:id` (admin review). The existing `GET/PUT /api/admin/approvals*` (`§Admin`) is **superseded/extended** to read applications (+ KYC, D) as the approval basis.

### C.4 USER_FLOWS
- `USER_FLOWS.md §1 (Auth)` + `§10 (Provider onboarding)` + `§13 (Admin → ApprovalsPanel)`: register → **submit application (data + sample images + KYC docs)** → `pending` → admin reviews the real submission → approve (`status='active'`, markets approved) | reject (`review_notes`). Today's `§10` "admin reviews → approve" gains a concrete review payload.

### C.5 REQUIREMENTS_MATRIX
- **REQ-VEND-01** (P0, new Phase 1.6) — Vendor onboarding application (business data + sample images), the approval basis.
- **MODIFY REQ-AUTH-05** (`§A`, `Built`): note "approval now requires a submitted `vendor_applications` row + KYC (REQ-VEND-02) as basis"; status → **In progress (extended by CR-01)** with changelog.

### C.6 Phase
- **CR-1B (new Phase 1.6, before Phase 2).** Schema + seller application UI now; provider/planner reuse in Phase 4/5.

---

## D) IDENTITY VERIFICATION (KYC) — buyer protection

**Intent:** Vendors provide identity verification (ID document upload + data) for buyer-rights protection. Needs a private docs store, status, reviewer, admin-only read.

### D.1 Tables / columns / enums — **new `vendor_verification`** + **new enum `verification_status`**
- **New enum** `verification_status` `('unverified','pending','approved','rejected')` (CR-1B migration).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| vendor_id | uuid | not null unique FK→`profiles(id)` on delete cascade | |
| legal_name | text | not null | as on the ID |
| doc_type | text | not null check in (`'national_id'`,`'passport'`,`'commercial_registration'`) | |
| doc_number | text | null | optional store; consider hashing/PII policy |
| doc_urls | jsonb | not null default `'[]'` | **PRIVATE bucket** paths (front/back) |
| status | verification_status | not null default `'pending'` | |
| reviewed_by | uuid | null FK→`profiles(id)` | admin |
| reviewed_at | timestamptz | null | |
| review_notes | text | null | |
| created_at/updated_at | timestamptz | default now() | |

- Add **`profiles.is_verified boolean not null default false`** (vendor trust badge for E) — set by admin on approval only (no-escalation). *(Distinct from `profile_status`; mirrors `event_planners.is_verified`, `§3.15`, which this CR unifies — see F.)*

### D.2 RLS + Storage (the critical part)
- **New PRIVATE bucket `verification-docs`** (NOT public — contrast with the four public buckets in `SYSTEM_ARCHITECTURE.md §9` / `DATABASE.md §7`). Storage RLS: owner may **write** under `{uid}/…` and **read own**; **no public read**; **admin reads via service-role only**. This is the first private bucket — `lib/storage/buckets.ts` (`STORAGE_BUCKETS`) gains it with a `public: false` flag, and `POST /api/upload` (`API_MAP §Uploads`) must support private uploads (return the storage *path*, not a public URL; serve via short-lived signed URLs to admins only).
- **`vendor_verification` RLS:** owner inserts + reads own (not `status`/`reviewed_*`); admin service-role reads all + sets status; **no public read** of docs/PII. The public only sees the derived `profiles.is_verified` badge (E).

### D.3 API_MAP
- **New** `POST /api/vendor/verification` (submit docs), `GET /api/vendor/verification/me`, admin `GET /api/admin/verifications` + `PUT /api/admin/verifications/:id` (`{status, notes}` → on `approved` sets `profiles.is_verified=true`).
- `POST /api/upload` extended for `bucket='verification-docs'` (private path, owner-scoped, no public URL).

### D.4 USER_FLOWS
- Folds into `§10`/`§13`: application (C) + KYC (D) reviewed together; approve sets `status='active'` **and** `is_verified=true` + approves markets. New admin panel **VerificationPanel** (sibling of ApprovalsPanel, `§13`).

### D.5 REQUIREMENTS_MATRIX
- **REQ-VEND-02** (P0, Phase 1.6) — KYC identity verification (private docs, admin review, `is_verified`).
- Ties to **REQ-NFR-05** (security — private storage, no PII leak) and the Phase-7 KYC note already in `REQUIREMENTS_MATRIX §K REQ-NFR-11` ("live Tap/Marketplace + KYC"). This pulls KYC **earlier** than Phase 7 for marketplace trust.

### D.6 Phase
- **CR-1B (Phase 1.6).** New private-bucket + signed-URL plumbing is net-new infra (flag in `SYSTEM_ARCHITECTURE §9`).

---

## E) SELLER DETAILS ON PRODUCT PAGE

**Intent:** Product detail shows verified seller info (name, market, verification badge, etc.) for buyer trust. Define public vs private fields.

### E.1 Public vs private (exact)
| Field | Source | Visibility |
|-------|--------|-----------|
| display/business name | `vendor_applications.business_name` (or `profiles.full_name`) | **Public** |
| market(s) operated | `vendor_markets.market where is_approved` | **Public** |
| verification badge | `profiles.is_verified` | **Public** |
| city/region | `vendor_markets.branch_address->>'city'` (coarse) | **Public** |
| member since | `profiles.created_at` | **Public** |
| avg rating / reviews | provider rollup (`reviews`, `§3.18`; `review_target='provider'`) | **Public** |
| avatar | `profiles.avatar_url` | **Public** |
| email, phone, exact address | `profiles`, `vendor_*` | **PRIVATE** |
| ID docs, doc number, legal name | `vendor_verification` | **PRIVATE (admin-only)** |

### E.2 RLS
- Implement the public block as a **narrow `public_vendor_profiles` view** (or column-scoped policy) — `DATABASE.md §3.1` already anticipates this ("public may read minimal public fields of `provider`/`seller` profiles … via a narrow view or policy"). The view exposes only the Public rows above. No raw `profiles` public read of contact/PII.

### E.3 API_MAP
- `GET /api/products/:id` (`§Products`) response gains a **`seller`** block (the public fields). Same for `GET /api/services/:id` (`§Services`, already returns `provider` — reconcile its shape to this public block) — F.

### E.4 USER_FLOWS
- `USER_FLOWS.md §2`: product detail renders a **SellerInfoCard** (name, market chips, verified badge, rating). `COMPONENT_TREE` gains `SellerInfoCard` (reused on service/planner detail — F).

### E.5 REQUIREMENTS_MATRIX
- **REQ-VEND-03** (P1) — Public vendor info + verification badge on listing/detail; explicit public/private field set.
- **MODIFY REQ-PROD-03** (`§B`) note: detail page now includes the seller block.

### E.6 Phase
- **Split:** the **minimal** seller block (name + market + badge) ships in **CR-1A** (rides the product-detail change). The full card (rating rollup) completes when `reviews` lands (Phase 5).

---

## F) SAME RULES FOR SERVICE PROVIDERS (and event planners)

**Intent:** B/C/D/E apply equally to providers (services, Phase 4) and event_planners (Phase 5), not just sellers.

### F.1 Reconciliation strategy — **generalize "seller" → "vendor"**
- Name the new tables **`vendor_applications`, `vendor_verification`, `vendor_markets`** (keyed on `profiles.id`, role-agnostic) rather than seller-specific — so providers/planners reuse them with zero new tables.
- **Services (`§3.11`)** currently carry single `price`+`currency` → mirror B with a **`service_prices`** child table `(service_id, market, currency, price, is_available)` when Phase 4 builds services. (Slot/availability stays market-agnostic; price is per-market.)
- **`event_planners.is_verified`** (`§3.15`, `REQ-EVT-07`) — **Decision Q-F1: REMOVE it; single source of truth = `vendor_verification` + `profiles.is_verified`.** When `0007_planners_portfolio_reviews.sql` is authored (Phase 5, not yet built), `event_planners` omits `is_verified`; its public-read RLS gate (`§3.15`: `where is_verified and status='active'`) becomes a **join to `profiles.is_verified`** (planner public iff the owner is KYC-verified and the planner row is active). `PUT /api/event-planners/:id/verify` (`API_MAP §Event Planners`) is folded into the unified admin KYC review (`PUT /api/admin/verifications/:id`); the planner-specific verify endpoint is dropped or aliased. Any code/UI reading `event_planners.is_verified` reads `profiles.is_verified` instead.
- **`event_requests.currency`** (`§3.16`) already per-currency → set from the planner's market.

### F.2 RLS / API / FLOWS
- Same patterns as B/C/D/E, applied to `services`, `event_planners`. Provider onboarding (`USER_FLOWS §10`) and provider/planner dashboards (`§13`, `REQ-DASH-03/04`) gain the application + KYC + markets UI.

### F.3 REQUIREMENTS_MATRIX
- **REQ-VEND-04** (P0) — Vendor onboarding/KYC/markets/public-info applies to providers + planners (not only sellers).
- **MODIFY REQ-SVC-04** (service CRUD → multi-market, Phase 4), **REQ-EVT-07** (planner verify → unified KYC, Phase 5), **REQ-AUTH-04** (provider_type captured in the application).

### F.4 Phase
- **Schema generalized in CR-1B (now)** so it's role-agnostic. **Provider/planner UI + `service_prices`** land in **Phase 4 (services)** and **Phase 5 (planners)** respectively — extend those phases, don't create a separate one.

---

## G) RICHER PRODUCT DETAILS — FILTERABLE ATTRIBUTES (Decision Q-G1)

**Intent (decided):** Attributes must **power faceted filters**, not just display. Sellers pick values from a **defined controlled vocabulary** so filtering is reliable. → A **typed three-table model** (not display-only jsonb).

> **CR-1A launch scope (confirmed 2026-07-01, DC-3):** the launch vocabulary is **`color` + `size`** only (both `multiselect`, global), seeded by `0008`. `material`/`occasion` below are illustrative of the *model*, not the launch set; category-scoped attributes are deferred.

### G.1 Tables / columns / enums — **RECOMMENDED: controlled-vocabulary EAV**
- **New enum `attribute_input` `('select','multiselect')`** (filterable kinds; free-text is intentionally excluded so facets stay clean — open question G-Q2).

**`attribute_definitions`** — the attribute catalog (admin-managed, like `categories`):

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| category_id | uuid | null FK→`categories(id)` | scope to a category (null = global, e.g. "Color") |
| key_ar | text | not null | label (RTL) |
| key_en | text | not null | |
| slug | text | not null unique | facet key in the URL (e.g. `color`, `size`) |
| input | attribute_input | not null default `'select'` | |
| sort_order | int | not null default 0 | |

**`attribute_options`** — allowed values per attribute:

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| attribute_id | uuid | not null FK→`attribute_definitions(id)` on delete cascade | |
| value_ar | text | not null | |
| value_en | text | not null | |
| slug | text | not null | facet value in the URL; unique `(attribute_id, slug)` |
| sort_order | int | not null default 0 | |

**`product_attributes`** — the product's chosen values (the EAV link):

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| product_id | uuid | not null FK→`products(id)` on delete cascade | |
| attribute_id | uuid | not null FK→`attribute_definitions(id)` | |
| option_id | uuid | not null FK→`attribute_options(id)` | controlled value (no free text → facets work) |

- **Constraints:** unique `(product_id, option_id)`; (for single-`select`) at most one option per `(product_id, attribute_id)` enforced in app + a partial constraint.
- **Indexes:** `(product_id)`, `(attribute_id, option_id)` (facet lookups), `(option_id)`.
- **Why this over jsonb:** Q-G1 requires filtering. Controlled options give clean, indexable facet queries (`… join product_attributes pa on pa.option_id = any(:selectedOptionIds)`) and consistent values across sellers — impossible with free-text jsonb. Trade-off: 3 tables + admin vocabulary management (mirrors how `categories` are already admin-managed, `REQ-DASH-05`).
- **Market note:** attributes are **market-agnostic** (a property of the product, not its market price).

### G.2 RLS / API / FLOWS
- **RLS:** `attribute_definitions`/`attribute_options` — public `SELECT`; writes service-role (admin) only (same as `categories`, `§3.2`). `product_attributes` — public `SELECT where parent product active`; owner CRUD via product join; admin service-role.
- **API:** `GET /api/products` (`§Products`) filter set extends with **attribute facets** (`?attr_<slug>=<optionSlug>,<optionSlug>` — multi-valued), reconciled with `REQ-PROD-02`/`useFilters` (URL = single source of truth). **New** admin `GET/PUT /api/admin/attributes` (manage definitions + options). `ProductSchema` gains `attribute_option_ids[]` (validated against the category's allowed options). `FilterBar` gains a **FacetPanel**; `ProductForm` gains attribute-option selects (per the product's category).
- **FLOWS:** `USER_FLOWS §2` filtering step gains facets; `§11/§13` admin manages the attribute vocabulary alongside categories.

### G.3 REQUIREMENTS_MATRIX
- **REQ-PROD-09** (**P1**, Phase 1.5) — **Filterable** product attributes (controlled vocabulary; faceted catalog filters). *Promoted P2→P1 per Q-G1.*
- **MODIFY REQ-PROD-02** (filters) — add attribute facets; **REQ-DASH-05** (category mgmt) — extend admin to manage attribute definitions/options.

### G.4 Phase
- **CR-1A (now).** Adds 3 tables + an enum to the same `0008` migration; non-destructive to `products`. Larger than the v1 jsonb idea — its scope increase is noted in §0 / risks.

---

## H) PAYMENT ESCROW, DELIVERY-OTP, ACCEPTANCE & DISPUTES (folds into Phase 2)

**Intent (your spec):** Funds are **HELD, not paid to the vendor on purchase**. The escrow/reserve logic lives **entirely in our system** ("Amazon's principle, my capabilities"); payouts are **manual by an admin for launch**, but **the system computes everything** — the admin only executes the bank transfer and confirms.
1. Payment captured (online) or order placed (COD) → settlement `held`.
2. Delivery confirmed via a **delivery OTP** (courier confirms hand-off with a code) → order `delivered`.
3. A configurable **acceptance window** opens (propose 48–72h, a `platform_setting`).
4. **Move HELD → AVAILABLE** when EITHER the customer taps "received & satisfied" (immediate) OR the window expires with no action (auto-release = assumed acceptance).
5. If the customer opens a **dispute** during the window, funds stay held until an admin resolves.
6. **Payout (manual now, pluggable later):** the system computes each vendor's **NET payable** (AVAILABLE − outstanding COD-commission debt); an admin makes the bank transfer **outside the system** and clicks **"Mark as paid"** → system moves AVAILABLE → PAID, zeroes the payable, writes `audit_log`.

**Decision H-Q1 — RESOLVED (system-of-record escrow + manual pluggable payout).** For launch, **collection still goes through Tap to the single platform merchant account** (NOT Tap Marketplace). The platform holds funds **logically per-vendor** in our settlement tables; the admin disburses manually with the system computing exact amounts. The "Mark as paid" step is a **pluggable `PayoutProvider`** (manual now → Tap Marketplace payout API later) **without changing the settlement math** — same pattern as the swappable `PaymentProvider` (`lib/payments`, `REQ-PAY-07`).

This is the heart of the Phase-2 settlement design — it must be built **with** `orders`/`payments`/`settlements` (`DATABASE.md §3.6–3.9`), not bolted on. The **`settlements` ledger + `settle_status` are the single source of truth** for what is held / available / paid (launch-implication §H.8).

### H.1 Tables / columns / enums

**Extend `settle_status` (`§2`, today `('pending','paid','held')`):** → `('held','available','paid','refunded','disputed','cancelled')`. *(Bucket names match the spec: HELD → AVAILABLE → PAID.)*
- `held` = in the acceptance/review window (post-capture / post-COD-collection). `available` = window passed or accepted → eligible for payout. `paid` = vendor payout executed (the manual "Mark as paid"). `disputed` = frozen pending admin. `refunded` = returned to buyer. (`pending` retired — map straight to `held` on capture; H-Q5 resolved → retire.)

**New enum `dispute_status` `('open','under_review','resolved_release','resolved_refund','cancelled')`.**
**New enum `settlement_entry` `('sale_payable','cod_commission')`** — distinguishes the two ledger directions (credit the platform owes the vendor vs commission debt the vendor owes — see §H.1b).
**New enum `payout_method` `('manual_bank_transfer','tap_marketplace')`** — `manual_bank_transfer` now; `tap_marketplace` reserved for the automated swap.

**Alter `settlements` (`§3.9`) — Phase-2 table (authored now, so this is a design change, not a closed-phase migration):**
- ADD `entry_type settlement_entry not null default 'sale_payable'` (ledger direction).
- ADD `market market not null` (settlement is per-market, since markets are isolated — A/B).
- ADD `held_at timestamptz null`, `available_at timestamptz null`; `available_reason text null check in ('customer_accepted','auto_release','admin_release')`; `dispute_id uuid null FK→disputes(id)`; `payout_id uuid null FK→payouts(id)` (which disbursement settled it).
- The lifecycle field is the extended `status`. `commission_rate`/`commission_amount`/`net_payout`/`gross_amount` (existing `§3.9`) stay — the system computes them per order.

**Alter `orders` (`§3.6`) — Phase-2 table:**
- ADD `delivered_at timestamptz null`, `accepted_at timestamptz null`, `auto_release_at timestamptz null` (= `delivered_at` + window), `release_state text not null default 'none'` (or derive from settlement). 
- **Reconcile `is_paid`** (`§3.6` GEN `upfront_fee_paid AND cod_collected`): that flag means **buyer-paid**, which is the *trigger* for the hold — keep it. **Vendor release is a separate axis** tracked on `settlements.status` (`held`→`available`→`paid`). Document the two axes explicitly so "paid" (buyer) ≠ "available/paid-out" (vendor).

**New `order_deliveries`** (delivery-OTP, hand-off proof):

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| order_id | uuid | not null unique FK→`orders(id)` on delete cascade | |
| otp_hash | text | not null | **hash** of the code (never store plaintext — `CLAUDE_RULES §5`) |
| otp_expires_at | timestamptz | null | |
| delivered_at | timestamptz | null | set when OTP verified |
| confirmed_by | uuid | null FK→`profiles(id)` | courier/admin who confirmed (C9: admin in v1) |
| attempts | int | not null default 0 | throttle |

**New `disputes`:**

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| order_id | uuid | not null FK→`orders(id)` on delete cascade | |
| raised_by | uuid | not null FK→`profiles(id)` | customer |
| reason | text | not null | |
| description | text | null | |
| evidence | jsonb | not null default `'[]'` | image URLs (Storage) |
| status | dispute_status | not null default `'open'` | |
| resolution | text | null | admin note |
| resolved_by | uuid | null FK→`profiles(id)` | admin |
| resolved_at | timestamptz | null | |
| created_at/updated_at | timestamptz | default now() | |

- **Indexes:** `(order_id)`, `(status)`, `(raised_by)`.

**Alter `platform_settings` (`§3.19`, singleton):**
- ADD `acceptance_window_hours int not null default 72 check (>0)` (configurable hold window — REQ-PAY-10). (Seed default 48–72; you pick — H-Q3.)

### H.1b Vendor settlement ledger, balances & payout (the system computes everything)

**The ledger = `settlements` rows (one per order_item / offering, per vendor, per market).** Two entry types capture the netting model:
- **`sale_payable`** (online orders): the platform captured the buyer's money; on acceptance the **vendor net** (`gross − commission`) becomes a **credit** the platform owes the vendor → `held → available → paid`.
- **`cod_commission`** (COD orders): the **cash was collected at delivery and ends up with the vendor** (COD), so the platform is owed the **commission** → a **debit** against the vendor → `held → available` (becomes due on acceptance) → cleared when netted against payouts.

**Derived balance — new view `vendor_balances` (system-computed, not stored; avoids drift):** per `(vendor_id, market, currency)`:
| Bucket | Definition |
|--------|-----------|
| `held_total` | Σ `net_payout` where `entry_type='sale_payable' and status='held'` |
| `available_total` | Σ `net_payout` where `entry_type='sale_payable' and status='available'` |
| `cod_commission_due` | Σ `commission_amount` where `entry_type='cod_commission' and status in ('held','available')` and not yet cleared |
| `paid_total` | Σ `net_payout` where `status='paid'` |
| **`net_payable`** | `available_total − cod_commission_due` (the number the admin sees; can be **negative** → vendor owes the platform, carried forward — H-Q6/H-Q7) |

**New `payouts`** — records each manual disbursement (the audit-grade record of money leaving the platform):

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| vendor_id | uuid | not null FK→`profiles(id)` | |
| market | market | not null | payouts are per-market (currency-consistent) |
| currency | currency_code | not null | |
| amount | numeric(10,2) | not null check (>=0) | the NET the system computed at disbursement time |
| method | payout_method | not null default `'manual_bank_transfer'` | pluggable (manual now) |
| external_reference | text | null | bank transfer ref the admin enters |
| status | text | not null default `'paid'` check in (`'paid'`,`'failed'`,`'reversed'`) | manual = `paid` on confirm |
| executed_by | uuid | not null FK→`profiles(id)` | the admin (audit) |
| executed_at | timestamptz | not null default now() | |
| notes | text | null | |

- **Marking paid (atomic, server/service-role):** create a `payouts` row for the computed `net_payable`, set the covered `sale_payable` settlements `status='paid'`+`payout_id`, mark the netted `cod_commission` rows cleared, write an `audit_log` (`§3.22`) entry. The vendor's `net_payable` returns to 0.
- **Pluggable payout — `PayoutProvider` abstraction** (`lib/payouts/{PayoutProvider,manual,tapMarketplace,index}.ts`, mirroring `lib/payments`): `execute(vendorId, market, amount)` → `ManualPayoutProvider` just records the admin's out-of-band transfer; `TapMarketplacePayoutProvider` (later) calls the Tap payout API. **Swapping the provider does not change the ledger math** — `settlements`/`vendor_balances` stay the source of truth.

### H.2 RLS
- `order_deliveries`: customer reads own (via order); **write service-role only** (OTP generated/verified server-side; never client-trusted — mirrors `payments` write policy, `§3.8`). 
- `disputes`: customer creates/reads own (via order, **only while within the acceptance window & order delivered**); vendor reads disputes on their order_items; **resolution writes service-role (admin) only**.
- `settlements` (`§3.9`): vendor reads own (existing); all status transitions **service-role only** (existing). No change to the deny-by-default posture.
- `payouts`: vendor reads own; **all writes service-role (admin) only** — disbursement is an admin-only privileged op (launch-implication §H.8). `vendor_balances` view inherits `settlements` read scope (vendor sees own; admin via service-role).

### H.3 API_MAP
- **New** `POST /api/orders/:id/confirm-delivery` (courier/admin submits OTP → verify → `delivered`, `cod_collected=true` for COD, settlement `held`, start window) — Auth: Admin/Agent (C9).
- **New** `POST /api/orders/:id/accept` (customer "received & satisfied" → settlement `held → available`, `available_reason='customer_accepted'`).
- **New** `POST /api/disputes` (customer, within window) + `GET /api/disputes/:id` + admin `GET /api/admin/disputes` + `PUT /api/admin/disputes/:id` (`{resolution: release|refund}` → settlement `available`|`refunded` + Tap refund for online).
- **New** auto-release: a **Supabase scheduled Edge Function / `pg_cron`** sweeps `orders` where `now() >= auto_release_at` and no open dispute → settlement `held → available`, `available_reason='auto_release'` (`SYSTEM_ARCHITECTURE §10/§17` already anticipates edge fns/cron).
- **New (payouts dashboard — the admin's only manual step):** `GET /api/admin/payouts` → vendors with their **system-computed `net_payable`** (from `vendor_balances`, after commission + COD-debt netting), per market/currency. `POST /api/admin/payouts` (`{vendor_id, market}`) → records the disbursement via `PayoutProvider.execute`, moves AVAILABLE→PAID, clears netted COD commission, zeroes `net_payable`, writes `audit_log` ("Mark as paid"). Admin-only, service-role.
- **Reconcile** `POST /api/payments/confirm-cod` (`§Payments`): COD collection now happens **at delivery-OTP** (`confirm-delivery`), so `confirm-cod` merges into `confirm-delivery` (or becomes the admin fallback). The old `POST /api/admin/settlements/:id/pay` (`§Admin`) is **superseded** by `POST /api/admin/payouts` (per-vendor netted disbursement, not per-settlement).

### H.4 USER_FLOWS + state machines
- `USER_FLOWS.md §2` (Buy) and `§14` (Payments) gain the escrow lifecycle; `§13` (Admin) gains a **DisputesPanel** + a **PayoutsPanel** (the manual "Mark as paid" dashboard, replacing the per-settlement `SettlementsPanel` action); customer dashboard (`§12`) gains "Confirm receipt" + "Open dispute" on delivered orders.
- **Admin payout flow (`§13`):** PayoutsPanel lists vendors + **system-computed NET payable** → admin transfers via bank (outside the system) → "Mark as paid" → AVAILABLE→PAID + audit. The admin never computes money; the system does.
- **New/changed state machines (`USER_FLOWS §State machines`):**
  - **Settlement:** `held → available → paid` ; `held → disputed → (resolved_release → available → paid | resolved_refund → refunded)`.
  - **Dispute:** `open → under_review → resolved_release | resolved_refund | cancelled`.
  - **Order (extend):** `… → delivered → completed` where `delivered → completed` now means *available* (accepted or auto). Invalid transitions → `409 INVALID_TRANSITION` (existing convention).

### H.5 REQUIREMENTS_MATRIX REQ-IDs
- **REQ-PAY-08** (P0, Phase 2) — **Escrow hold/release**: funds held until acceptance; release on customer accept OR auto-release; nothing pays out before release.
- **REQ-PAY-09** (P0, Phase 2) — **Delivery OTP** hand-off confirmation (hashed, server-verified).
- **REQ-PAY-10** (P0, Phase 2) — **Configurable acceptance window** (`platform_settings.acceptance_window_hours`) + **auto-release** job (assumed acceptance on expiry).
- **REQ-PAY-11** (P0, Phase 2) — **Disputes**: customer raises within window → funds frozen → admin resolves (release/refund).
- **REQ-PAY-12** (P0, Phase 2) — **Vendor settlement ledger & balances**: system computes per-order commission/net + per-vendor `held/available/paid` buckets + COD-commission debt + **net-payable netting** (`settlements` + `vendor_balances` = single source of truth).
- **REQ-PAY-13** (P0, Phase 2) — **Pluggable manual payout**: admin-only "Mark as paid" via `PayoutProvider` (manual bank transfer now → Tap Marketplace later), `payouts` table + strong `audit_log`.
- **MODIFY REQ-PAY-04** (`§D`, the COD "paid" rule): clarify buyer-`is_paid` vs vendor-`available`/`paid`; `is_paid` stays the *entry* condition to `held`, not "vendor paid". **MODIFY REQ-PAY-05** (settlement → payout): payout only from `available`, netted, **manual admin disbursement** (was implied auto). **MODIFY REQ-PAY-03** (confirm-COD): collection moves to delivery-OTP. **MODIFY REQ-ORD-04** (order lifecycle): add delivered→accepted/auto-released. **MODIFY REQ-PAY-06** (admin settings): add the window setting.

### H.6 COD vs online nuances (must be modeled distinctly)
Per the H-Q1 decision, launch escrow is **platform-balance / logical** (single Tap merchant, no Marketplace payout). The two paths differ in *who already holds the cash*:
- **Online (Tap):** Tap captures the buyer's funds to the **platform merchant account** up front → settlement `entry_type='sale_payable'`, `held` → on acceptance `available` → admin's manual payout → `paid`. The platform genuinely holds the money; payout is a real outbound transfer. Dispute refund = Tap refund API to the buyer.
- **COD:** the courier collects **cash** at delivery and it ends up with the **vendor**; the platform never touched the buyer's money but is **owed its commission** → settlement `entry_type='cod_commission'`, the **commission is a debit** against the vendor (`held → available` on acceptance). *(This reframes the v1 H.6 "platform owes vendor" wording — under the netting model, COD = vendor owes platform the commission.)*
- **Netting (the whole point):** a vendor with both online and COD sales → **NET payable = online `available` net − outstanding COD-commission debt** (`vendor_balances`, §H.1b). If COD debt exceeds online credit, `net_payable` is **negative** → vendor owes the platform → carried forward / collected separately (H-Q6/H-Q7 detail the refund-commission and COD-custody edge cases).
- **⚠ Tap (now de-risked for launch):** because payout is manual and collection is single-merchant, **Tap Marketplace is NOT required for launch** — this removes the load-bearing blocker the v1 doc flagged. `REQUIREMENTS_MATRIX REQ-PAY-01` + `docs/SPIKE_NOTES.md` Marketplace work becomes a **later automation** (swap `ManualPayoutProvider`→`TapMarketplacePayoutProvider`, `REQ-PAY-13`), not a launch gate. Tap **refunds** (for dispute resolution on online orders) are still needed in Phase 2 — confirm the Tap refund API (smaller scope than Marketplace).

### H.7 Phase
- **CR-2, folded into Phase 2.** Extends `0004_commerce.sql` (or a paired `0004b_escrow.sql`): adds `payouts`, `disputes`, `order_deliveries`, the `settlements` ledger extensions, the `vendor_balances` view, `lib/payouts/*`. Adds the **first scheduled job** (auto-release) to the stack (`SYSTEM_ARCHITECTURE §10/§17`). Phase-2 testing (`IMPLEMENTATION_PLAN Phase 2` DoD — "✦ COD rule … webhook idempotency") expands to cover hold→available→paid, the **netting math** (online credit vs COD debt), auto-release timing, dispute freeze, and the manual-payout audit trail.

### H.8 Launch-time implications to flag (for the client)
1. **⚖ Legal/compliance — platform holds third-party funds.** For launch, online payments land in the **platform's own Tap merchant account** and the platform holds vendors' money there until manual payout. **Holding/transmitting third-party funds can carry regulatory/licensing implications in Egypt and Saudi Arabia** (e-money / payment-intermediary / escrow rules). *I am not a lawyer — the client must verify the EG/SA regulatory position* (and whether terms-of-service + vendor agreements must disclose the hold-and-release model). This becomes a Phase-7 / go-live checklist item alongside the existing KYC/legal-entity note (`REQUIREMENTS_MATRIX REQ-NFR-11`).
2. **🔒 Manual payout is an admin-only, audit-heavy action.** Every "Mark as paid" must: be **service-role / admin-gated** (RLS, `REQ-NFR-03/05`), capture **who/when/how-much/reference** in `payouts`, and write an immutable `audit_log` (`§3.22`) row. No vendor-writable path to payout state; no self-payout.
3. **📒 The ledger is the single source of truth.** `settlements` + `settle_status` + `vendor_balances` define what is held/available/paid — never a recomputation in the UI or a spreadsheet. The admin dashboard *displays* system-computed numbers; the admin's only inputs are the bank reference + the confirmation click.

---

## Consolidated change tables

### New/changed enums (`DATABASE.md §2`)
| Enum | Change | Migration |
|------|--------|-----------|
| `market` | **new** `('EG','SA')` | 0008 (CR-1A) |
| `attribute_input` | **new** `('select','multiselect')` | 0008 (CR-1A) |
| `verification_status` | **new** `('unverified','pending','approved','rejected')` | 0009 (CR-1B) |
| `settle_status` | **extend** → `('held','available','paid','refunded','disputed','cancelled')` (from `('pending','paid','held')`; `pending` retired) | Phase 2 (0004) |
| `dispute_status` | **new** `('open','under_review','resolved_release','resolved_refund','cancelled')` | Phase 2 (0004) |
| `settlement_entry` | **new** `('sale_payable','cod_commission')` (ledger direction / netting) | Phase 2 (0004) |
| `payout_method` | **new** `('manual_bank_transfer','tap_marketplace')` (pluggable payout) | Phase 2 (0004) |
| `currency_code` | unchanged (already SAR/EGP) | — |

### New tables
| Table | Pkg | Backs |
|-------|-----|-------|
| `product_prices` | CR-1A | REQ-PROD-07, REQ-MKT-03 |
| `product_variant_stock` | CR-1A | REQ-PROD-07 (Q-B1 per-market stock) |
| `vendor_markets` (was `seller_markets`) | CR-1A/1B | REQ-PROD-08, REQ-VEND-04 |
| `attribute_definitions` | CR-1A | REQ-PROD-09 (Q-G1) |
| `attribute_options` | CR-1A | REQ-PROD-09 |
| `product_attributes` | CR-1A | REQ-PROD-09 |
| `public_vendor_profiles` (view) | CR-1A | REQ-VEND-03 |
| `vendor_applications` | CR-1B | REQ-VEND-01 (multi-role, Q-C1) |
| `vendor_verification` | CR-1B | REQ-VEND-02 |
| `order_deliveries` | CR-2 (Phase 2) | REQ-PAY-09 (delivery OTP) |
| `disputes` | CR-2 (Phase 2) | REQ-PAY-11 |
| `payouts` | CR-2 (Phase 2) | REQ-PAY-13 (manual disbursement record) |
| `vendor_balances` (view) | CR-2 (Phase 2) | REQ-PAY-12 (held/available/paid + netting) |
| `service_prices` | Phase 4 | REQ-VEND-04 (F) |

### Altered existing tables (⚠ closed-phase follow-ups flagged)
| Table | Change | Phase status | Migration |
|-------|--------|--------------|-----------|
| `products` (`§3.3`) | **DROP** price/currency/rental_daily_price/security_deposit/stock (→`product_prices`); attributes handled via `product_attributes` (not a column) | ⚠ **closed** (Phase 1 `0003`) | 0008 |
| `product_variants` (`§3.4`) | **DROP** `stock` (→`product_variant_stock`, Q-B1) | ⚠ **closed** (Phase 1 `0003`) | 0008 |
| `profiles` (`§3.1`) | **ADD** `market` (buyer), `country`?, `is_verified`; `role` → primary/display (capability from applications, Q-C1) | ⚠ **closed** (Phase 0 `0001`) | 0008/0009 |
| `platform_settings` (`§3.19`) | **ADD** `acceptance_window_hours` (REQ-PAY-10) | Phase 2 (not yet built) | 0004 |
| `settlements` (`§3.9`) | **ADD** `entry_type`/`market`/`held_at`/`available_at`/`available_reason`/`dispute_id`/`payout_id`; extended `status` | Phase 2 (not yet built) | 0004 |
| `orders` (`§3.6`) | **ADD** `delivered_at`/`accepted_at`/`auto_release_at`; reconcile `is_paid` (buyer) vs available/paid (vendor) | Phase 2 (not yet built) | 0004 |
| `event_planners` (`§3.15`) | **DROP** `is_verified` → read `profiles.is_verified` (Q-F1) | Phase 5 (not yet built) | when 0007 lands |
| `services` (`§3.11`) | price/currency → `service_prices` | Phase 4 (not yet built) | when 0006 lands |

### New REQ-IDs (propose section **M. Markets & Vendor Verification**)
| REQ-ID | Pri | Phase | Summary |
|--------|-----|-------|---------|
| REQ-MKT-01 | P0 | 1.5 | Regional market isolation (currency/shipping/COD self-contained) |
| REQ-MKT-02 | P0 | 1.5 | Market resolution (geo/profile/selector), separate from locale |
| REQ-MKT-03 | P0 | 1.5 | Market-filtered catalog visibility |
| REQ-PROD-07 | P0 | 1.5 | Multi-market pricing (`product_prices`) + per-market stock (`product_variant_stock`) |
| REQ-PROD-08 | P0 | 1.5 | Seller market declaration + local-presence requirement |
| REQ-PROD-09 | **P1** | 1.5 | **Filterable** product attributes (controlled vocabulary; facets) |
| REQ-VEND-01 | P0 | 1.6 | Vendor onboarding application (data + sample images) |
| REQ-VEND-02 | P0 | 1.6 | KYC identity verification (private docs) |
| REQ-VEND-03 | P1 | 1.5/5 | Public vendor info + verification badge on detail |
| REQ-VEND-04 | P0 | 1.6/4/5 | Same rules for providers + planners |
| REQ-VEND-05 | P0 | 1.6 | Multi-role capability (one user = seller AND provider; Q-C1) |
| REQ-PAY-08 | P0 | 2 | Escrow hold/release (no payout before acceptance) |
| REQ-PAY-09 | P0 | 2 | Delivery-OTP hand-off confirmation |
| REQ-PAY-10 | P0 | 2 | Configurable acceptance window + auto-release job |
| REQ-PAY-11 | P0 | 2 | Disputes (freeze funds → admin resolve) |
| REQ-PAY-12 | P0 | 2 | Vendor settlement ledger & balances (held/available/paid + COD-debt netting) |
| REQ-PAY-13 | P0 | 2 | Pluggable manual payout ("Mark as paid", `PayoutProvider`, audit) |

### Modified REQ-IDs
`REQ-AUTH-05` (approval needs application+KYC basis), `REQ-AUTH-03` (role → primary + derived capabilities, Q-C1), `REQ-AUTH-04` (provider_type via application), `REQ-PROD-01/02/03/05/06` (market-aware; price/stock moved; facets), `REQ-SVC-04` (service multi-market), `REQ-EVT-07` (planner verify → unified KYC; `event_planners.is_verified` removed), `REQ-PAY-03` (COD collection → delivery-OTP), `REQ-PAY-04` (clarify buyer-`is_paid` vs vendor-`available`/`paid`), `REQ-PAY-05` (payout only from `available`, netted, manual), `REQ-PAY-06` (add acceptance-window setting), `REQ-ORD-04` (order lifecycle adds delivered→accepted/auto-released), `REQ-DASH-04` (admin gains applications/KYC/disputes/payouts panels), conflict `C9` (delivery agent now needed for OTP — see H-Q2), conflict `C10` (hardened to full market isolation). Each gets a changelog line (`CLAUDE_RULES §0/§12` — never silent).

### API_MAP deltas
- **Changed:** `GET /api/products` (market context + attribute facets), `GET /api/products/:id` (+seller block, 404 if not in market), `POST/PUT /api/products` (`prices[]` + `attribute_option_ids[]`), `GET/PUT /api/admin/approvals*` (review applications+KYC), `POST /api/upload` (private bucket), `POST /api/payments/confirm-cod` (→ delivery-OTP), `GET /api/services/:id`, `PUT /api/event-planners/:id/verify` (→ unified KYC). *(`POST /api/admin/settlements/:id/pay` is superseded — see CR-2 below.)*
- **New (CR-1A/1B):** `GET/POST /api/market`, `GET/POST /api/vendor/markets`, `GET/PUT /api/admin/attributes`, `POST /api/vendor/applications` + `GET …/me`, `GET/PUT /api/admin/applications*`, `POST /api/vendor/verification` + `GET …/me`, `GET/PUT /api/admin/verifications*`.
- **New (CR-2 / Phase 2):** `POST /api/orders/:id/confirm-delivery` (OTP), `POST /api/orders/:id/accept`, `POST /api/disputes` + `GET /api/disputes/:id`, `GET/PUT /api/admin/disputes*`, **`GET /api/admin/payouts`** (vendors + system-computed NET payable) + **`POST /api/admin/payouts`** ("Mark as paid"); auto-release scheduled edge function. **Supersedes** `POST /api/admin/settlements/:id/pay`.

---

## 7. Risks, conflicts & open questions

**Risks / conflicts**
- **R1 — Closed-phase migration on `products`.** A/B rewrite a Built table (`REQUIREMENTS_MATRIX §B` all `Built`; `0003_catalog.sql`). Phase 2 (`orders`/`order_items`/`payments`, `DATABASE.md §3.6–3.8`) reads `products.price`/`currency` per `USER_FLOWS §2` — doing this **before** Phase 2 avoids a second rewrite. **Mitigation:** clean cut now; only dummy data exists.
- **R2 — Seed must be regenerated.** `scripts/seed-dummy.ts` writes `products.price/currency/stock` directly and creates active sellers; it must move pricing into `product_prices`, stock into `product_variant_stock`, plus create `vendor_markets` + `vendor_applications` + `vendor_verification` rows and `product_attributes` (so facet filters have data). The catalog e2e + the market filter need the seed to span **both markets** (EG and SA each show products) and assign attribute options. Re-run `pnpm seed:reset`.
- **R3 — RLS cannot read the request market.** The market filter lives in the query layer, not RLS (A.2). Risk of a query path that forgets the filter and leaks cross-market products. **Mitigation:** centralize in `features/catalog/queries.ts` + an integration test asserting market isolation (like `products-rls.test.ts`).
- **R4 — Private KYC bucket is net-new infra.** First non-public bucket; signed-URL admin access + `POST /api/upload` private path are new (`SYSTEM_ARCHITECTURE §9`). PII handling (doc numbers) needs a retention/secrecy policy (`REQ-NFR-05`).
- **R5 — i18n/market combinatorics.** 4 locale×market combos; `next-intl` middleware + new market middleware must compose cleanly (`SYSTEM_ARCHITECTURE §5/§6`). MarketSwitcher must not clobber locale and vice-versa.
- **R6 — Timeline.** The plan is 5+2 days (`IMPLEMENTATION_PLAN`); CR-1A + CR-1B insert ~1–1.5 days between Phase 1 and Phase 2. Recommend formally inserting **Phase 1.5 / 1.6** rather than absorbing silently.

**v1 open questions — RESOLVED** (decisions in the banner at top): Q-B1 (per-market stock), Q-A (explicit chooser), Q-C1 (multi-role), Q-G1 (filterable typed attributes), Q-F1 (remove `event_planners.is_verified`). Two minor v1 questions remain low-stakes and I've taken the recommended default unless you object: **Q-B2** (store `currency` on `product_prices`, enforced by a market↔currency trigger — *taken*); **Q-B3** (local-presence proof = commercial-registration doc per market via the KYC table + admin approval of `vendor_markets.is_approved` — *proposed; confirm the doc type*).

**Escrow open questions:**
- **H-Q1 (payout mechanism) — RESOLVED.** System-of-record escrow (our tables) + **manual, pluggable payout** for launch: single Tap merchant for collection (NOT Marketplace), logical per-vendor holds in `settlements`, admin "Mark as paid" via `PayoutProvider` (manual now → Tap Marketplace later) with no change to the ledger math. Removes the Marketplace launch blocker (§H.1/§H.6); see launch flags §H.8. *(Still open below: H-Q3..H-Q8.)*
- **H-Q2 (who confirms the delivery OTP?)** Conflict `C9` deferred a `delivery_agent` role ("admin confirms COD v1"). The OTP hand-off implies a courier. v1 options: (a) **admin enters OTP** on the courier's behalf (no new role — fits C9 v1); (b) add a **`delivery_agent` role + minimal courier view** now. *(Recommend (a) for v1; (b) when logistics is built.)*
- **H-Q3 (window length + per-category?)** Default `acceptance_window_hours` = 48 or 72? Single global value, or per-category/market override later? *(Recommend 72 global now.)*
- **H-Q4 (dispute outcomes granularity)** Admin resolutions = full **release** vs full **refund** only, or also **partial refund** / **replacement**? Partial needs amount fields on `disputes`/`settlements`. *(Recommend release/refund only for v1.)*
- **H-Q5 (`settle_status` `pending`)** — *taken as resolved per the decision:* retire `pending`, map straight to `held` on capture. Confirm if you'd rather keep a pre-hold state.
- **H-Q6 (commission on refund)** On `resolved_refund` of an **online** order, does commission fully reverse (vendor `sale_payable` voided, buyer refunded in full incl. the platform's cut) or does the platform retain the non-refundable upfront fee (C8)? For a **COD** refund, the corresponding `cod_commission` debt must also void. Drives the void/reversal entries on the ledger.
- **H-Q7 (COD custody under the netting model)** Confirmed direction: COD cash ends with the **vendor**, platform is owed commission (a debit). Open detail: when a COD order is **refunded**, the buyer's cash sits with the vendor — does the platform (a) void the COD-commission debt and leave buyer↔vendor to settle the cash, or (b) claw it back via the next payout netting? *(Recommend (a) + ops policy.)*
- **H-Q8 (auto-release infra)** Confirm the auto-release job runs as a **Supabase scheduled Edge Function / `pg_cron`** (first scheduled job in the stack) vs a Vercel cron hitting an admin endpoint. *(Recommend `pg_cron`/Edge.)*
- **H-Q9 (NEW — negative net payable)** When a vendor's `net_payable` is **negative** (COD debt > online credit), what's the policy — carry forward indefinitely, dunning, or block new COD listings past a threshold? Affects whether `payouts`/`vendor_balances` need a debt-carry field.

**Cross-cutting risk added by the decisions:**
- **R7 — Multi-role authorization rewrite (Q-C1).** Moving from `profiles.role ==` checks to capability-from-approved-applications touches `middleware.ts`, `lib/rbac.ts`, dashboard routing, and every owner guard. Contained but pervasive — do it in CR-1B with focused RLS/guard tests.
- **R8 — Attribute scope (Q-G1).** Filterable attributes add 3 tables + an admin vocabulary UI + facet querying to CR-1A (bigger than the v1 jsonb idea). May warrant its own sub-task within Phase 1.5.
- **R9 — Escrow is the Phase-2 critical path.** It compounds the already-highest-risk phase (`IMPLEMENTATION_PLAN Phase 2`, 10h buffer). H-Q1 is now resolved (manual pluggable payout), which **de-risks** the Tap dependency for launch — but the ledger/netting math + manual-payout audit are themselves substantial Phase-2 scope, and the **legal/compliance question on holding third-party funds (§H.8.1) should be raised with the client early**, not at go-live.

---

## 8. Revised phasing (summary)

| Phase | Contains | Migration(s) | Closed-phase alters |
|-------|----------|--------------|---------------------|
| **1.5 (new)** | A (markets + chooser), B (multi-market price + per-market stock), G (filterable attributes), E-minimal (seller block) | `0008_markets_pricing.sql` | ⚠ `products`, `product_variants` (Phase 1); `profiles` (Phase 0) |
| **1.6 (new)** | C (onboarding application), D (KYC + private bucket), E-full, F (vendor generalization + multi-role) | `0009_vendor_verification.sql` | ⚠ `profiles` (Phase 0) |
| **2 (expanded)** | existing commerce **+ §H escrow/OTP/disputes/auto-release** | `0004_commerce.sql` (+ `0004b_escrow.sql`) | none yet (Phase 2 is unbuilt) |
| **4 / 5** | F for services (`service_prices`) / planners (drop `event_planners.is_verified`) | `0006` / `0007` (when authored) | n/a (not yet built) |

## 9. What I will do on approval (no work until you say go)
1. Reconcile the 6 planning docs with the approved REQ-IDs + schema deltas (matrix rows + changelog, DATABASE tables/enums/RLS, API_MAP endpoints, USER_FLOWS steps + state machines, IMPLEMENTATION_PLAN Phases 1.5/1.6 + expanded Phase 2, SYSTEM_ARCHITECTURE private bucket + market middleware + auto-release cron).
2. Author `0008_markets_pricing.sql` (CR-1A) + `0009_vendor_verification.sql` (CR-1B), and the Phase-2 escrow/settlement design (`0004b_escrow.sql`: `payouts`/`disputes`/`order_deliveries` + `settlements` ledger extensions + `vendor_balances` view + `lib/payouts/*` `PayoutProvider`) as **proposals you apply** (environment split — you run `db push`/`db:types`).
3. Rework catalog query/filters/`ProductCard`/`ProductForm`/seed for markets + attributes + regenerate dummy data; extend e2e for market isolation, facet filters, the seller application/KYC flow, and (Phase 2) the escrow ledger/netting + manual-payout audit.

**Nothing above is implemented.** H-Q1 (payout mechanism) is now resolved — escrow is **system-of-record + manual pluggable payout**, which removes the Tap Marketplace launch blocker. **Awaiting (a) your confirmation of this updated doc, and (b) answers to the remaining escrow questions H-Q2, H-Q3, H-Q4, H-Q6, H-Q7, H-Q8, H-Q9** (H-Q5 taken as resolved). I also recommend **raising the §H.8.1 legal/compliance note (platform holding third-party funds in EG/SA) with the client now**, since it can affect launch. On your go, I reconcile the six docs and author the migrations.
