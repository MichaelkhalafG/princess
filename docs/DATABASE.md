# DATABASE.md

> **Project:** Princess — All-in-One Women's Marketplace
> **Engine:** PostgreSQL on **Supabase**. SQL migrations in `supabase/migrations` are the **source of truth** (no Prisma — C1). Generated types → `lib/database.types.ts`.
> **Companion docs:** `REQUIREMENTS_MATRIX.md` (the law), `API_MAP.md` (endpoints), `USER_FLOWS.md` (status machines), `SYSTEM_ARCHITECTURE.md` (RLS/storage), `CLAUDE_RULES.md` §5/§6 (security/money).
> **This file supersedes the previous DATABASE.md.** See the reconciliation note at the bottom for renamed enums/columns.

---

## 0. Conventions

- **Money:** stored as `numeric(10,2)` + a sibling `currency currency_code`. **All arithmetic in logic uses integer minor units** (÷100; halalas/piastres) via `lib/money.ts` — never floats (CLAUDE_RULES §6). Commission/fees are **never hardcoded** — read from `platform_settings` / `platform_upfront_fees`.
- **IDs:** `uuid primary key default gen_random_uuid()` except `profiles.id` (= `auth.users.id`).
- **Timestamps:** `created_at`/`updated_at timestamptz not null default now()`; `updated_at` maintained by trigger.
- **RLS:** enabled on **every** table, **deny-by-default** (REQ-NFR-05). Admin privileged ops use the **service-role** client (server only) — no broad public admin policy.
- **Storage:** image URLs are **Supabase Storage** public URLs (C3) — never Cloudinary.
- **Naming (authoritative):** `provider` (role), `profile_status`, `portfolio_items`, `cod_amount`, `upfront_fee_paid`, `cod_collected`, `remaining_collected`, `idempotency_key`, `is_paid`.

---

## 1. Migration order (matches IMPLEMENTATION_PLAN phases)

| File | Phase | Creates |
|------|-------|---------|
| `0001_foundation.sql` | 0 | extensions (`pgcrypto`, `btree_gist`); enums `user_role, provider_type, profile_status, currency_code`; `profiles`; `handle_new_user()` + signup trigger; `set_updated_at()` trigger; enable RLS on `profiles` |
| `0002_rls_and_settings.sql` | 0 | `profiles` RLS policies; `platform_settings` (singleton) + `platform_upfront_fees` child + seed (BR-4, C7/C10); RLS |
| `0003_catalog.sql` | 1 | enum `listing_status`; `categories`, `products`, `product_variants`; indexes; RLS |
| `0004_commerce.sql` | 2 | enums `order_status, payment_type, payment_status, settle_status`; `cart_items`, `orders`, `order_items`, `payments`, `settlements`; generated `is_paid`; indexes; RLS |
| `0005_rentals.sql` | 3 | enum `rental_status`; `rentals` (+ exclusion constraint); indexes; RLS |
| `0006_services.sql` | 4 | enum `booking_status`; `services`, `availability`, `bookings` (+ exclusion), `center_offers`; indexes; RLS |
| `0007_planners_portfolio_reviews.sql` | 5 | enums `request_status, review_target`; `event_planners`, `event_requests`, `portfolio_items`, `reviews` (+ rating-aggregation triggers); `notifications`, `audit_log`; indexes; RLS |
| `0008_markets_pricing.sql` | 1.5 (CR-01) | enums `market`, `attribute_input`; `product_prices`, `product_variant_stock`, `vendor_markets`, `attribute_definitions`, `attribute_options`, `product_attributes`, `public_vendor_profiles` (view); alter `products` (drop money/stock cols), `product_variants` (drop `stock`), `profiles` (add `market`, `country`, `is_verified`); indexes; RLS. ⚠ closed-phase follow-up (0003 `products`/`product_variants`, 0001 `profiles`) |
| `0009_vendor_verification.sql` | 1.6 (CR-01) | enum `verification_status`; `vendor_applications` (multi-role), `vendor_verification`; private `verification-docs` bucket; `profiles` multi-role capability model; indexes; RLS. ⚠ closed-phase follow-up (0001 `profiles`) |

> Enums are created in the migration of their first use. `currency_code` lives in `0001` because `platform_upfront_fees` (0002) and `products` (0003) depend on it.
> **CR-01 (Phase 2 escrow):** the escrow/OTP/disputes/payout schema extends `0004_commerce.sql` (or a paired `0004b_escrow.sql`) — see §2 (`settle_status` extension, `dispute_status`/`settlement_entry`/`payout_method`) and §§3.32–3.35. Authored **with** Phase 2, not as a closed-phase follow-up.

---

## 2. Enums

```sql
-- 0001
create type user_role      as enum ('customer','seller','provider','admin');      -- C-fix: 'provider' (was service_provider)
create type provider_type  as enum ('freelancer','center');
create type profile_status as enum ('pending','active','suspended','rejected');   -- C-fix: profile_status (was account_status)
create type currency_code  as enum ('SAR','EGP');                                  -- C10 per-region
-- 0003
create type listing_status as enum ('draft','active','inactive','rejected');
-- 0004
create type order_status   as enum ('pending','confirmed','out_for_delivery','delivered','completed','cancelled');
create type payment_type   as enum ('upfront_fee','cod','deposit','refund');
create type payment_status as enum ('initiated','captured','failed','refunded','cod_pending','cod_collected');
-- CR-01 (Phase 2, 0004): settle_status EXTENDED (was ('pending','paid','held')); 'pending' retired → maps to 'held' on capture (H-Q5)
create type settle_status  as enum ('held','available','paid','refunded','disputed','cancelled');
-- CR-01 (Phase 2, 0004): escrow ledger direction + pluggable payout
create type dispute_status    as enum ('open','under_review','resolved_release','resolved_refund','cancelled');
create type settlement_entry  as enum ('sale_payable','cod_commission');   -- netting direction (§3.9, §3.35)
create type payout_method     as enum ('manual_bank_transfer','tap_marketplace'); -- manual now; tap reserved for auto-swap
-- 0005
create type rental_status  as enum ('pending','active','returned','cancelled');
-- 0006
create type booking_status as enum ('pending','confirmed','completed','cancelled','no_show');
-- 0007
create type request_status as enum ('pending','accepted','declined','completed','cancelled');
create type review_target  as enum ('product','service','provider','planner');
-- 0008 (CR-01, Phase 1.5)
create type market          as enum ('EG','SA');                            -- market ≠ locale; governs visibility/shipping/COD (§A). currency derived: EG→EGP, SA→SAR
create type attribute_input as enum ('select','multiselect');               -- filterable kinds only; free-text excluded (§G)
-- 0009 (CR-01, Phase 1.6)
create type verification_status as enum ('unverified','pending','approved','rejected'); -- KYC (§D)
```

> **CR-01 enum note:** `currency_code` is **unchanged** (already `SAR`/`EGP`). `market` is conceptually distinct from `currency_code` — 1:1 today but kept separate; currency is derived from market via a fixed map (`lib/markets.ts`), never entered twice (CR §A.1).

State machines mirror USER_FLOWS §"State machines". Invalid transitions are rejected in `features/*` and surfaced as `409 INVALID_TRANSITION` (API_MAP).

---

## 3. Tables

Legend: **PK** primary key · **FK** foreign key · **GEN** generated · **EXCL** exclusion constraint.

### 3.1 `profiles` — Phase 0
Backs: REQ-AUTH-01..06, REQ-NFR-03. Endpoints: `/api/auth/*`, `/api/admin/approvals*`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK, FK→`auth.users(id)` on delete cascade | = auth user id |
| email | text | not null | mirror of auth email |
| full_name | text | null | |
| phone | text | null | |
| role | user_role | not null default `'customer'` | set from signup metadata |
| provider_type | provider_type | null | only for role `provider` |
| status | profile_status | not null | `active` if customer else `pending` (REQ-AUTH-05) |
| avatar_url | text | null | Supabase Storage |
| locale | text | not null default `'ar'` | |
| created_at / updated_at | timestamptz | not null default now() | |

**Indexes:** `(role, status)`, `(status)`.
**RLS:** self `SELECT`/`UPDATE` (`auth.uid() = id`); **role/status not self-updatable** (restrict updatable cols to full_name, phone, avatar_url, locale via column policy/trigger — no privilege escalation); public may read minimal public fields of `provider`/`seller` profiles (for listings) via a narrow view or policy; admin via service-role.
**Triggers:** created by `handle_new_user()` (see §5); `set_updated_at`.

> **CR-01 change (0008 + 0009):** ADD (0008) `market market null` (buyer's chosen market, nullable until chosen — §A.1), `country text null` (raw geo hint), `is_verified boolean not null default false` (vendor trust badge, admin-set on KYC approval only — §D.1, feeds the public seller block §E). ADD (0009, Q-C1) the **multi-role capability model**: `role` becomes the **primary/display** role (signup choice) and **no longer gates capability** — real authorization derives from **approved `vendor_applications`** rows (§3.30): "can sell" = an approved `role='seller'` application, "can offer services" = an approved `role='provider'` application; `middleware.ts`/`lib/rbac.ts` move from `role ==` to `has-capability` (new REQ-VEND-05; reconcile REQ-AUTH-03). RLS: `market`/`country` are **self-settable**; `is_verified` is **admin-only** (no-escalation, extends the §5 privilege guard alongside `role`/`status`). ⚠ closed-phase follow-up (Phase 0 `0001`).

### 3.2 `categories` — Phase 1
Backs: REQ-DASH-05, REQ-PROD-02, REQ-SVC-02. Endpoints: `/api/admin/categories`, used by `/api/products`, `/api/services`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| parent_id | uuid | null, FK→`categories(id)` |
| kind | text | not null check in (`'product'`,`'service'`) |
| name_ar | text | not null |
| name_en | text | not null |
| slug | text | not null unique |
| sort_order | int | not null default 0 |

**Indexes:** `(kind)`, `(parent_id)`, unique `(slug)`.
**RLS:** public `SELECT`; writes service-role (admin) only.

### 3.3 `products` — Phase 1
Backs: REQ-PROD-01..06, REQ-RENT-01 (rentable flag). Endpoints: `/api/products`, `/api/products/:id`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| seller_id | uuid | not null FK→`profiles(id)` on delete cascade | |
| category_id | uuid | null FK→`categories(id)` | |
| title | text | not null | |
| description | text | null | |
| price | numeric(10,2) | not null check (>=0) | |
| currency | currency_code | not null default `'SAR'` | |
| is_rentable | boolean | not null default false | enables rentals (REQ-RENT) |
| rental_daily_price | numeric(10,2) | null check (>=0) | required if rentable |
| security_deposit | numeric(10,2) | null check (>=0) | refundable (C8) |
| images | jsonb | not null default `'[]'` | `[{url,alt,sort}]` Supabase Storage |
| stock | int | not null default 0 check (>=0) | base stock if no variants |
| status | listing_status | not null default `'draft'` | public when `active` |
| avg_rating | numeric(3,2) | not null default 0 | trigger-maintained |
| total_reviews | int | not null default 0 | trigger-maintained |
| created_at / updated_at | timestamptz | not null default now() | |

**Indexes:** `(category_id, status)`, `(seller_id)`, `(price)`, `(status)`, `(is_rentable)`.
**RLS:** public `SELECT where status='active'`; owner (`seller_id = auth.uid()`) full CRUD; admin service-role.

> **CR-01 change (0008) — ⚠ closed-phase follow-up (Phase 1 `0003`):** `price`, `currency`, `rental_daily_price`, `security_deposit`, `stock` are **DROPPED** — they MOVE to the per-market `product_prices` child table (§3.23; CR §B.1). KEEP market-agnostic fields (`title`, `description`, `category_id`, `is_rentable`, `images`, `status`, `avg_rating`, `total_reviews`). Filterable attributes are handled via `product_attributes` (§3.28), **not** a column. RLS unchanged (visibility still `status='active'`; the market filter lives in the query layer, not RLS — §A.2). The `(price)` index moves to `product_prices(market, price)`.

### 3.4 `product_variants` — Phase 1
Backs: REQ-PROD-04.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| product_id | uuid | not null FK→`products(id)` on delete cascade |
| size | text | null |
| color | text | null |
| stock | int | not null default 0 check (>=0) |
| sku | text | null |

**Indexes:** `(product_id)`, unique `(product_id, size, color)`.
**RLS:** inherits product ownership (policy joins to `products.seller_id`); public read where parent active.

> **CR-01 change (0008) — ⚠ closed-phase follow-up (Phase 1 `0003`):** `stock` is **DROPPED** — per-market variant stock moves to `product_variant_stock` (§3.24; Q-B1, each market is a local branch with its own inventory). KEEP `size`, `color`, `sku` (market-agnostic identity) and the unique `(product_id, size, color)`. Resolved stock rule: product with variants → `product_variant_stock` for the active market; without variants → `product_prices.stock` (§3.23).

### 3.5 `cart_items` — Phase 2
Backs: REQ-CART-01. Endpoints: `/api/cart`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| customer_id | uuid | not null FK→`profiles(id)` on delete cascade |
| product_id | uuid | null FK→`products(id)` |
| variant_id | uuid | null FK→`product_variants(id)` |
| quantity | int | not null default 1 check (>0) |
| created_at | timestamptz | not null default now() |

**Constraints:** unique `(customer_id, product_id, variant_id)`.
**Indexes:** `(customer_id)`.
**RLS:** owner-only (`customer_id = auth.uid()`).

### 3.6 `orders` — Phase 2
Backs: REQ-ORD-01..04, REQ-PAY-03/04. Endpoints: `/api/orders`, `/api/orders/my-orders`, `/api/orders/:id/status`, `/api/payments/confirm-cod`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| customer_id | uuid | not null FK→`profiles(id)` on delete restrict | |
| subtotal | numeric(10,2) | not null check (>=0) | |
| upfront_fee_amount | numeric(10,2) | not null default 0 check (>=0) | online fee (platform revenue) |
| upfront_fee_paid | boolean | not null default false | set by webhook |
| cod_amount | numeric(10,2) | not null default 0 check (>=0) | **exact cash to prepare** (REQ-ORD-03) |
| cod_collected | boolean | not null default false | set by confirm-cod |
| currency | currency_code | not null default `'SAR'` | |
| status | order_status | not null default `'pending'` | |
| **is_paid** | boolean | **GEN** `always as (upfront_fee_paid and cod_collected) stored` | **REQ-PAY-04** |
| shipping_address | jsonb | null | |
| created_at / updated_at | timestamptz | not null default now() | |

**Indexes:** `(customer_id, status)`, `(status)`, `(is_paid)`.
**RLS:** customer reads/writes own; seller reads orders containing their products (via `order_items` join policy); admin service-role.

> **CR-01 change (Phase 2, 0004) — escrow:** ADD `delivered_at timestamptz null`, `accepted_at timestamptz null`, `auto_release_at timestamptz null` (= `delivered_at` + `platform_settings.acceptance_window_hours`). **Two distinct axes (document explicitly):** buyer-side `is_paid` (GEN `upfront_fee_paid and cod_collected`) is the *entry condition to `held`* — it means **buyer-paid**, NOT vendor-paid; the vendor release axis (`held`→`available`→`paid`) lives on `settlements.status` (§3.9). So "paid" (buyer) ≠ "available/paid-out" (vendor). Lifecycle: `… → delivered` (via OTP, §3.32) → `available` on customer accept OR auto-release → `completed`. CR §H.1.

### 3.7 `order_items` — Phase 2
Backs: REQ-ORD-01, REQ-PAY-05 (settlement basis).

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| order_id | uuid | not null FK→`orders(id)` on delete cascade |
| product_id | uuid | null FK→`products(id)` |
| variant_id | uuid | null FK→`product_variants(id)` |
| seller_id | uuid | not null FK→`profiles(id)` | denormalized for seller RLS/settlement |
| quantity | int | not null check (>0) |
| unit_price | numeric(10,2) | not null check (>=0) |
| currency | currency_code | not null default `'SAR'` |

**Indexes:** `(order_id)`, `(product_id)`, `(seller_id)`.
**RLS:** customer (via order) read; seller reads rows where `seller_id = auth.uid()`; admin service-role.

### 3.8 `payments` — Phase 2
Backs: REQ-PAY-01..04, REQ-PAY-07. Endpoints: `/api/payments/create-intent`, `/api/payments/webhook`, `/api/payments/confirm-cod`, `/api/payments/:id`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| order_id | uuid | null FK→`orders(id)` | |
| booking_id | uuid | null FK→`bookings(id)` | |
| rental_id | uuid | null FK→`rentals(id)` | |
| type | payment_type | not null | |
| status | payment_status | not null default `'initiated'` | |
| amount | numeric(10,2) | not null check (>=0) | |
| currency | currency_code | not null default `'SAR'` | |
| provider | text | not null default `'tap'` | gateway |
| provider_ref | text | null | gateway charge id |
| idempotency_key | text | unique | **webhook replay safety** (REQ-PAY-02) |
| raw_payload | jsonb | null | gateway event (audit) |
| created_at / updated_at | timestamptz | not null default now() | |

**Constraints:** `check (num_nonnulls(order_id, booking_id, rental_id) = 1)` (exactly one parent); unique `(idempotency_key)`.
**Indexes:** `(order_id)`, `(booking_id)`, `(rental_id)`, `(status)`, unique `(idempotency_key)`, `(provider_ref)`.
**RLS:** owner reads payments tied to their order/booking/rental; **writes service-role only** (webhook/confirm run server-side). REQ-NFR-05.

### 3.9 `settlements` — Phase 2
Backs: REQ-PAY-05/06, REQ-DASH-06. Endpoints: `/api/admin/settlements`, `/api/admin/settlements/:id/pay`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| vendor_id | uuid | not null FK→`profiles(id)` |
| order_id | uuid | null FK→`orders(id)` |
| booking_id | uuid | null FK→`bookings(id)` |
| rental_id | uuid | null FK→`rentals(id)` |
| gross_amount | numeric(10,2) | not null check (>=0) |
| commission_rate | numeric(5,2) | not null | snapshot from settings |
| commission_amount | numeric(10,2) | not null check (>=0) |
| net_payout | numeric(10,2) | not null check (>=0) |
| currency | currency_code | not null default `'SAR'` |
| status | settle_status | not null default `'pending'` |
| created_at / updated_at | timestamptz | not null default now() |

**Constraints:** `check (num_nonnulls(order_id, booking_id, rental_id) = 1)`.
**Indexes:** `(vendor_id, status)`, `(order_id)`, `(booking_id)`, `(rental_id)`.
**RLS:** vendor reads own; writes service-role (admin) only.

> **CR-01 change (Phase 2, 0004) — `settlements` becomes the escrow ledger (single source of truth for held/available/paid):** ADD `entry_type settlement_entry not null default 'sale_payable'` (ledger direction — `sale_payable` = platform owes vendor net; `cod_commission` = vendor owes platform commission; drives netting, §3.35); `market market not null` (settlements are per-market since markets are isolated); `held_at timestamptz null`; `available_at timestamptz null`; `available_reason text null check in ('customer_accepted','auto_release','admin_release')`; `dispute_id uuid null FK→disputes(id)` (§3.33); `payout_id uuid null FK→payouts(id)` (§3.34, which disbursement settled it). `status` uses the **extended `settle_status`** (`held→available→paid`; `disputed`/`refunded`/`cancelled`). `commission_rate`/`commission_amount`/`net_payout`/`gross_amount` stay (system-computed per order). RLS unchanged (vendor reads own; all status transitions service-role only). CR §H.1/§H.1b.

### 3.10 `rentals` — Phase 3
Backs: REQ-RENT-01..05, REQ-PAY-03/04. Endpoints: `/api/rentals`, `/api/rentals/availability/:productId`, `/api/rentals/my-rentals`, `/api/rentals/:id/status`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| product_id | uuid | not null FK→`products(id)` on delete restrict | |
| customer_id | uuid | not null FK→`profiles(id)` on delete restrict | |
| start_date | date | not null | |
| end_date | date | not null | |
| total_price | numeric(10,2) | not null check (>=0) | |
| security_deposit | numeric(10,2) | not null default 0 check (>=0) | refundable (C8) |
| upfront_fee_amount | numeric(10,2) | not null default 0 check (>=0) | online booking fee |
| upfront_fee_paid | boolean | not null default false | |
| cod_amount | numeric(10,2) | not null default 0 check (>=0) | cash on pickup/delivery |
| cod_collected | boolean | not null default false | |
| currency | currency_code | not null default `'SAR'` | |
| status | rental_status | not null default `'pending'` | |
| **is_paid** | boolean | **GEN** `always as (upfront_fee_paid and cod_collected) stored` | REQ-PAY-04 |
| created_at / updated_at | timestamptz | not null default now() | |

**Constraints:**
```sql
constraint rentals_dates_valid check (end_date >= start_date),
-- BR-6 / REQ-RENT-02: no overlapping pending/active rental of the same product.
constraint rentals_no_overlap exclude using gist (
  product_id with =,
  daterange(start_date, end_date, '[]') with &&
) where (status in ('pending','active'))
```
**Indexes:** `(product_id, status)`, `(customer_id)`, `(status)`.
**RLS:** customer reads/writes own; seller (product owner) reads rentals of their product; admin service-role.

### 3.11 `services` — Phase 4
Backs: REQ-SVC-01..04, REQ-PORT-03. Endpoints: `/api/services`, `/api/services/:id`, `/api/services/:id/portfolio`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| provider_id | uuid | not null FK→`profiles(id)` on delete cascade | |
| category_id | uuid | null FK→`categories(id)` | |
| title | text | not null | |
| description | text | null | |
| price | numeric(10,2) | not null check (>=0) | |
| currency | currency_code | not null default `'SAR'` | |
| duration_minutes | int | not null default 60 check (>0) | slot length |
| status | listing_status | not null default `'draft'` | |
| avg_rating | numeric(3,2) | not null default 0 | trigger-maintained |
| total_reviews | int | not null default 0 | trigger-maintained |
| created_at / updated_at | timestamptz | not null default now() | |

> **Note (C3, Q2):** the old `services.portfolio_images` jsonb column is **removed** — portfolio lives in `portfolio_items` (3.16). The `PUT /api/services/:id/portfolio` body field `portfolio_images[]` is a **DTO** the handler reconciles into `portfolio_items` rows with `service_id` set.

**Indexes:** `(category_id, status)`, `(provider_id)`, `(avg_rating desc)`, `(status)`, `(price)`.
**RLS:** public `SELECT where status='active'`; owner full CRUD; admin service-role.

> **CR-01 change (Phase 4, when 0006 lands) — F:** mirror `products`/`product_prices` — `price`/`currency` MOVE to a new per-market **`service_prices`** child table `(service_id, market, currency, price, is_available)`; slot/availability stay market-agnostic. Providers reuse the role-agnostic `vendor_markets`/`vendor_applications`/`vendor_verification` tables (§3.25/§3.30/§3.31). Deferred to Phase 4; noted here for design consistency (CR §F.1).

### 3.12 `availability` — Phase 4
Backs: REQ-SVC-05, REQ-BOOK-05. Endpoints: `/api/availability/:providerId`, `/api/availability`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| provider_id | uuid | not null FK→`profiles(id)` on delete cascade |
| slot_start | timestamptz | not null |
| slot_end | timestamptz | not null |
| is_open | boolean | not null default true |
| created_at | timestamptz | not null default now() |

**Constraints:** `check (slot_end > slot_start)`; EXCL `using gist (provider_id with =, tstzrange(slot_start, slot_end) with &&)` (no overlapping offered windows).
**Indexes:** `(provider_id, slot_start)`.
**RLS:** public `SELECT`; owner CRUD; admin service-role.

### 3.13 `bookings` — Phase 4
Backs: REQ-BOOK-01..05, REQ-PAY-03/04. Endpoints: `/api/bookings`, `/api/bookings/my-bookings`, `/api/bookings/provider`, `/api/bookings/:id/status`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| service_id | uuid | not null FK→`services(id)` on delete restrict | |
| provider_id | uuid | not null FK→`profiles(id)` on delete restrict | |
| customer_id | uuid | not null FK→`profiles(id)` on delete restrict | |
| slot_start | timestamptz | not null | |
| slot_end | timestamptz | not null | |
| total_price | numeric(10,2) | not null check (>=0) | |
| upfront_fee_amount | numeric(10,2) | not null default 0 check (>=0) | non-refundable (C8) |
| upfront_fee_paid | boolean | not null default false | |
| remaining_amount | numeric(10,2) | not null default 0 check (>=0) | cash on completion |
| remaining_collected | boolean | not null default false | |
| currency | currency_code | not null default `'SAR'` | |
| status | booking_status | not null default `'pending'` | |
| **is_paid** | boolean | **GEN** `always as (upfront_fee_paid and remaining_collected) stored` | REQ-PAY-04 |
| created_at / updated_at | timestamptz | not null default now() | |

**Constraints:**
```sql
constraint bookings_slot_valid check (slot_end > slot_start),
-- BR-6 / REQ-BOOK-05: no overlapping active booking per provider.
constraint bookings_no_overlap exclude using gist (
  provider_id with =,
  tstzrange(slot_start, slot_end) with &&
) where (status in ('pending','confirmed'))
```
**Indexes:** `(provider_id, slot_start)`, `(customer_id)`, `(service_id)`, `(status)`.
**RLS:** customer reads/writes own; provider reads bookings for their services; admin service-role.

### 3.14 `center_offers` — Phase 4 (REQ-SVC-06 **Deferred**, schema defined now)
Endpoints: `/api/center-offers`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| provider_id | uuid | not null FK→`profiles(id)` on delete cascade |
| title | text | not null |
| description | text | null |
| discount_percent | int | null check (between 0 and 100) |
| valid_from | date | null |
| valid_to | date | null |
| status | listing_status | not null default `'active'` |
| created_at / updated_at | timestamptz | not null default now() |

**Constraints:** `check (valid_to is null or valid_from is null or valid_to >= valid_from)`. Provider must be `provider_type='center'` — enforced via **RLS policy + app guard** (cannot conditionally FK).
**Indexes:** `(provider_id, status)`.
**RLS:** public `SELECT where status='active'`; owner (center) CRUD; admin service-role.

### 3.15 `event_planners` — Phase 5
Backs: REQ-EVT-01..03/07. Endpoints: `/api/event-planners`, `/api/event-planners/:id`, `/api/event-planners/:id/verify`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| user_id | uuid | not null unique FK→`profiles(id)` on delete cascade | one per provider |
| business_name | text | not null | |
| description | text | null | |
| location | text | null | city/region (filter) |
| experience | int | not null default 0 check (>=0) | years |
| specialties | jsonb | not null default `'[]'` | **typed** `string[]` (e.g. ["Weddings"]) |
| packages | jsonb | not null default `'[]'` | **typed** `[{name,price,currency,description}]` (informational) |
| phone | text | null | |
| website | text | null | |
| is_verified | boolean | not null default false | admin verify (REQ-EVT-07) |
| status | profile_status | not null default `'active'` | |
| avg_rating | numeric(3,2) | not null default 0 | trigger-maintained (target=`planner`) |
| total_reviews | int | not null default 0 | trigger-maintained |
| created_at / updated_at | timestamptz | not null default now() | |

**Indexes:** `(location)`, `(avg_rating desc)`, GIN `(specialties)`, `(is_verified, status)`, unique `(user_id)`.
**RLS:** public `SELECT where is_verified and status='active'`; owner reads/updates own (not `is_verified`); admin (verify, list pending) service-role.

> **CR-01 change (Phase 5, when 0007 lands) — Q-F1:** `is_verified` is **REMOVED** — single source of truth becomes `vendor_verification` (§3.31) + `profiles.is_verified` (§3.1). The public-read gate `where is_verified and status='active'` becomes a **join to `profiles.is_verified`** (planner public iff its owner is KYC-verified and the planner row is active); the `(is_verified, status)` index is dropped/reworked. `PUT /api/event-planners/:id/verify` folds into the unified admin KYC review (`PUT /api/admin/verifications/:id`); any code reading `event_planners.is_verified` reads `profiles.is_verified` instead. `event_requests.currency` (§3.16) is set from the planner's market. Deferred to Phase 5 (CR §F.1).

### 3.16 `event_requests` — Phase 5
Backs: REQ-EVT-04/05/06. Endpoints: `/api/event-planners/requests`, `.../requests/my-requests`, `.../requests?provider=true`, `.../requests/:id`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| planner_id | uuid | not null FK→`event_planners(id)` on delete cascade |
| customer_id | uuid | not null FK→`profiles(id)` on delete restrict |
| event_type | text | not null |
| event_date | date | not null |
| guest_count | int | null check (>0) |
| budget | numeric(10,2) | null check (>=0) |
| currency | currency_code | not null default `'SAR'` |
| description | text | null |
| status | request_status | not null default `'pending'` |
| created_at / updated_at | timestamptz | not null default now() |

**Indexes:** `(planner_id, status)`, `(customer_id)`, `(status)`.
**RLS:** customer reads/creates own; planner (via `event_planners.user_id = auth.uid()`) reads/updates requests addressed to them; admin service-role.

### 3.17 `portfolio_items` — Phase 5 (single canonical source — Q2)
Backs: REQ-PORT-01..05. Endpoints: `/api/providers/:id/portfolio`, `/api/users/portfolio`, `/api/services/:id/portfolio`.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| provider_id | uuid | not null FK→`profiles(id)` on delete cascade | owner |
| service_id | uuid | null FK→`services(id)` on delete cascade | NULL ⇒ source `profile`; set ⇒ source `service` |
| url | text | not null | Supabase Storage public URL (C3) |
| caption | text | null | |
| sort_order | int | not null default 0 | REQ-PORT-05 reorder |
| created_at | timestamptz | not null default now() | |

**Combined-portfolio merge (REQ-PORT-04):** `GET /api/providers/:id/portfolio` selects all rows for `provider_id`, computing `source = case when service_id is null then 'profile' else 'service' end`, joining `services.title` for service items. No dual storage — replaces old jsonb columns.
**Indexes:** `(provider_id, sort_order)`, `(service_id)`.
**RLS:** public `SELECT`; owner (`provider_id = auth.uid()`) CRUD; service-owner check for `service_id` items; admin service-role.

### 3.18 `reviews` — Phase 5 (polymorphic)
Backs: REQ-REV-01..03. Endpoints: `/api/reviews`, `/api/reviews/:targetId`.

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| author_id | uuid | not null FK→`profiles(id)` on delete cascade |
| target_type | review_target | not null |
| target_id | uuid | not null |
| rating | int | not null check (between 1 and 5) |
| comment | text | null |
| created_at | timestamptz | not null default now() |

**Constraints:** unique `(author_id, target_type, target_id)` (one review per target).
**Indexes:** `(target_type, target_id)`, `(author_id)`.
**RLS:** public `SELECT`; author creates/edits own (optionally gated to verified purchase — see REQ-REV-01 note); admin service-role.
**Triggers:** `reviews_aggregate` maintains `avg_rating`/`total_reviews` on the matching target table (see §5).

### 3.19 `platform_settings` — Phase 0 (singleton, admin-configurable)
Backs: REQ-PAY-06, BR-4. Endpoints: `/api/admin/settings`.

| Column | Type | Null/Default |
|--------|------|--------------|
| singleton | boolean | PK default true check (singleton) |
| commission_products | numeric(5,2) | not null default 15 |
| commission_services | numeric(5,2) | not null default 10 |
| commission_rentals | numeric(5,2) | not null default 10 |
| updated_by | uuid | null FK→`profiles(id)` |
| updated_at | timestamptz | not null default now() |

**RLS:** authenticated `SELECT` (needed at checkout/settlement); writes service-role (admin) only. Seeded with BR-4 defaults in `0002`.

> **CR-01 change (Phase 2, 0004) — escrow:** ADD `acceptance_window_hours int not null default 72 check (acceptance_window_hours > 0)` — the configurable HELD→AVAILABLE hold window (single global value; H-Q3 default = **72**). Drives `orders.auto_release_at` and the auto-release job (REQ-PAY-10, CR §H.1).

### 3.20 `platform_upfront_fees` — Phase 0 (per offering_type + currency — C7/C10)
Backs: REQ-PAY-01/06, C7, C10.

| Column | Type | Null/Default |
|--------|------|--------------|
| offering_type | text | not null check in (`'product'`,`'rental'`,`'service'`) |
| currency | currency_code | not null |
| amount_minor | int | not null check (>=0) | **integer minor units** |
| updated_by | uuid | null FK→`profiles(id)` |
| updated_at | timestamptz | not null default now() |

**Constraints:** PK `(offering_type, currency)`.
**RLS:** authenticated `SELECT`; writes service-role only. Seeded SAR+EGP in `0002`.

### 3.21 `notifications` — Phase 5
Backs: REQ-NOT-01 (REQ-NOT-02/03 Deferred). Internal (NotificationService).

| Column | Type | Null/Default |
|--------|------|--------------|
| id | uuid | PK |
| user_id | uuid | null FK→`profiles(id)` on delete set null |
| channel | text | not null default `'email'` check in (`'email'`,`'sms'`) |
| template | text | not null |
| payload | jsonb | null |
| status | text | not null default `'queued'` check in (`'queued'`,`'sent'`,`'failed'`) |
| created_at | timestamptz | not null default now() |

**Indexes:** `(user_id)`, `(status)`.
**RLS:** owner reads own; writes service-role only.

### 3.22 `audit_log` — Phase 5
Backs: REQ-NFR-05 (money/security trail).

| Column | Type | Null/Default |
|--------|------|--------------|
| id | bigint | PK generated always as identity |
| actor_id | uuid | null |
| action | text | not null |
| entity | text | null |
| entity_id | uuid | null |
| metadata | jsonb | null |
| created_at | timestamptz | not null default now() |

**Indexes:** `(entity, entity_id)`, `(created_at)`.
**RLS:** service-role only (no public access).

---

## 3′. CR-01 new tables & views

> Added by CR-01 (see the reconciliation note in §2 and the Changelog at the end). Migration in the section title. Numbering continues from §3.22 to avoid renumbering existing sections.

### 3.23 `product_prices` — Phase 1.5 (0008)
Backs: REQ-PROD-07, REQ-MKT-03 (CR §B.1). Per-market money block for `products` (replaces the money/stock columns dropped from §3.3).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| product_id | uuid | not null FK→`products(id)` on delete cascade | |
| market | market | not null | EG or SA |
| currency | currency_code | not null | derived from market; CHECK matches the market map (`EG`→`EGP`, `SA`→`SAR`) — enforced by check/trigger (Q-B2) |
| price | numeric(10,2) | not null check (>=0) | |
| rental_daily_price | numeric(10,2) | null check (>=0) | required if `products.is_rentable` |
| security_deposit | numeric(10,2) | null check (>=0) | refundable (C8) |
| stock | int | not null default 0 check (>=0) | per-market base stock for products WITHOUT variants (local branch inventory) |
| is_available | boolean | not null default true | market-level toggle without deleting the price |
| created_at / updated_at | timestamptz | not null default now() | |

**Constraints:** unique `(product_id, market)`; CHECK `currency` matches the market map.
**Indexes:** `(product_id)`, `(market, is_available)`, `(market, price)`, `(product_id, market)`.
**RLS:** public `SELECT where is_available and EXISTS(active parent product)`; owner (via `products.seller_id = auth.uid()`) full CRUD **restricted to APPROVED markets** (join `vendor_markets.is_approved`, §3.25); admin service-role. **Market visibility filter is applied in the QUERY layer, not RLS** (RLS can't read the request cookie) — RLS enforces `status='active'`; the query adds `inner join product_prices on market = :activeMarket` (CR §A.2). ⚠ **R3 cross-market-leak risk** — centralize the filter in `features/catalog/queries.ts` + an isolation test.

### 3.24 `product_variant_stock` — Phase 1.5 (0008)
Backs: REQ-PROD-07 (Q-B1, per-market stock). Replaces `product_variants.stock` (§3.4).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| variant_id | uuid | not null FK→`product_variants(id)` on delete cascade | |
| market | market | not null | |
| stock | int | not null default 0 check (>=0) | this variant's stock in this market |

**Constraints:** unique `(variant_id, market)`.
**Indexes:** `(variant_id)`, `(market)`.
**RLS:** public `SELECT` where parent product active + market available (via join); owner CRUD via product/variant ownership, restricted to approved markets; admin service-role.

### 3.25 `vendor_markets` — Phase 1.5 (0008)
Backs: REQ-PROD-08, REQ-VEND-04 (CR §B.1; generalized from `seller_markets`, **role-agnostic** — sellers/providers/planners). A vendor may only price a product in a market where they have an **approved** row here (RLS + app guard + trigger; same conditional-FK pattern as `center_offers`, §3.14).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| vendor_id | uuid | not null FK→`profiles(id)` on delete cascade | seller or provider |
| market | market | not null | |
| branch_name | text | null | local presence (REQ basis) |
| branch_address | jsonb | null | local fulfillment |
| is_approved | boolean | not null default false | admin confirms local presence (ties to KYC, §D) |
| created_at / updated_at | timestamptz | not null default now() | |

**Constraints:** unique `(vendor_id, market)`.
**Indexes:** `(vendor_id)`, `(market, is_approved)`.
**RLS:** owner reads/writes own but **`is_approved` is NOT self-settable** (no-escalation; column grants, same pattern as `profiles.role`/`status`, §5); admin service-role sets `is_approved`; public read of approved `(vendor_id, market)` via the `public_vendor_profiles` view (§3.29).

### 3.26 `attribute_definitions` — Phase 1.5 (0008)
Backs: REQ-PROD-09 (Q-G1, filterable facets). Admin-managed attribute catalog (like `categories`, §3.2). Attributes are **market-agnostic**.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| category_id | uuid | null FK→`categories(id)` | scope to a category (null = global, e.g. "Color") |
| key_ar | text | not null | label (RTL) |
| key_en | text | not null | |
| slug | text | not null unique | facet key in the URL (e.g. `color`, `size`) |
| input | attribute_input | not null default `'select'` | |
| sort_order | int | not null default 0 | |

**Indexes:** unique `(slug)`, `(category_id)`.
**RLS:** public `SELECT`; writes service-role (admin) only (same as `categories`).
**CR-1A launch vocabulary:** 0008 seeds **`color` + `size`** (both `multiselect`, global) as the starting controlled vocabulary; admin extends via `/api/admin/attributes` (REQ-DASH-05). Category-scoped attributes (e.g. numeric shoe sizes) are a later addition, not CR-1A.

### 3.27 `attribute_options` — Phase 1.5 (0008)
Backs: REQ-PROD-09. Allowed (controlled) values per attribute — enables clean, indexable facets.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| attribute_id | uuid | not null FK→`attribute_definitions(id)` on delete cascade | |
| value_ar | text | not null | |
| value_en | text | not null | |
| slug | text | not null | facet value in the URL; unique `(attribute_id, slug)` |
| sort_order | int | not null default 0 | |

**Constraints:** unique `(attribute_id, slug)`.
**Indexes:** `(attribute_id)`.
**RLS:** public `SELECT`; writes service-role (admin) only.

### 3.28 `product_attributes` — Phase 1.5 (0008)
Backs: REQ-PROD-09. The product's chosen controlled values (the EAV link; no free text → facets work).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| product_id | uuid | not null FK→`products(id)` on delete cascade | |
| attribute_id | uuid | not null FK→`attribute_definitions(id)` | |
| option_id | uuid | not null FK→`attribute_options(id)` | controlled value |

**Constraints:** unique `(product_id, option_id)`; for single-`select` attributes, at most one option per `(product_id, attribute_id)` (app + partial constraint).
**Indexes:** `(product_id)`, `(attribute_id, option_id)`, `(option_id)`.
**RLS:** public `SELECT where parent product active`; owner CRUD via product join; admin service-role.

### 3.29 `public_vendor_profiles` — Phase 1.5 (0008, VIEW)
Backs: REQ-VEND-03 (CR §E). A **narrow view** exposing ONLY the public seller block for product/service detail — **no contact/PII** (anticipated by §3.1 "narrow view or policy"). No raw public read of `profiles` contact fields.

| Column | Source | Notes |
|--------|--------|-------|
| vendor_id | `profiles.id` | |
| display_name | `vendor_applications.business_name` (or `profiles.full_name`) | public |
| markets | `vendor_markets.market where is_approved` | public |
| is_verified | `profiles.is_verified` | verification badge |
| city | `vendor_markets.branch_address->>'city'` | coarse only |
| member_since | `profiles.created_at` | |
| avatar_url | `profiles.avatar_url` | |
| avg_rating / total_reviews | provider rollup (`reviews`, §3.18, `review_target='provider'`) | full card completes when reviews land (Phase 5) |

**Excluded (PRIVATE):** email, phone, exact address (`profiles`/`vendor_*`); ID docs, doc number, legal name (`vendor_verification`, admin-only).
**RLS:** the view is the public read surface; underlying `profiles`/`vendor_verification` contact/PII stay non-public.

### 3.30 `vendor_applications` — Phase 1.6 (0009)
Backs: REQ-VEND-01 (CR §C.1; multi-role, Q-C1). **One row per (user, role)** — a user can apply as BOTH seller and provider. The approval basis (business data + sample images) reviewed before capability is granted.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| applicant_id | uuid | not null FK→`profiles(id)` on delete cascade | |
| role | user_role | not null | `seller` or `provider` |
| business_name | text | not null | |
| business_type | text | null | freelancer/center/store |
| contact_phone | text | not null | |
| business_address | jsonb | null | |
| markets | market[] | not null | markets requested (feeds `vendor_markets`, §3.25) |
| sample_images | jsonb | not null default `'[]'` | `[{url,alt,sort}]` public `products`/`services` bucket |
| status | profile_status | not null default `'pending'` | reuse existing enum (`pending/active/suspended/rejected`) |
| review_notes | text | null | admin feedback on reject |
| reviewed_by | uuid | null FK→`profiles(id)` | admin |
| reviewed_at | timestamptz | null | |
| created_at / updated_at | timestamptz | not null default now() | |

**Constraints:** unique `(applicant_id, role)`.
**Indexes:** unique `(applicant_id, role)`, `(status)`, `(role, status)`.
**RLS:** owner (`applicant_id = auth.uid()`) inserts + reads own + updates own **while `status='pending'`**; **cannot set `status`/`reviewed_*`** (no-escalation, §5); admin service-role reads all + approves/rejects; **no public read**. Capability derives from an approved (`status='active'`) row (see §3.1).

### 3.31 `vendor_verification` — Phase 1.6 (0009)
Backs: REQ-VEND-02 (CR §D.1; KYC, private docs). Admin-only read of docs/PII; the public only sees the derived `profiles.is_verified` badge.

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| vendor_id | uuid | not null unique FK→`profiles(id)` on delete cascade | |
| legal_name | text | not null | as on the ID |
| doc_type | text | not null check in (`'national_id'`,`'passport'`,`'commercial_registration'`) | |
| doc_number | text | null | optional; PII — consider hashing/retention policy |
| doc_urls | jsonb | not null default `'[]'` | **PRIVATE bucket** paths (front/back) — §7 |
| status | verification_status | not null default `'pending'` | |
| reviewed_by | uuid | null FK→`profiles(id)` | admin |
| reviewed_at | timestamptz | null | |
| review_notes | text | null | |
| created_at / updated_at | timestamptz | not null default now() | |

**Indexes:** unique `(vendor_id)`, `(status)`.
**RLS:** owner inserts + reads own (**not** `status`/`reviewed_*`); admin service-role reads all + sets status (on `approved` sets `profiles.is_verified=true`); **no public read** of docs/PII. Docs live in the private `verification-docs` bucket (§7); admin access via short-lived signed URLs only.

### 3.32 `order_deliveries` — Phase 2 (0004, escrow)
Backs: REQ-PAY-09 (CR §H.1; delivery-OTP hand-off proof).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| order_id | uuid | not null unique FK→`orders(id)` on delete cascade | |
| otp_hash | text | not null | **hash** of the code — never store plaintext (CLAUDE_RULES §5) |
| otp_expires_at | timestamptz | null | |
| delivered_at | timestamptz | null | set when OTP verified |
| confirmed_by | uuid | null FK→`profiles(id)` | courier/admin who confirmed (C9: admin in v1, H-Q2) |
| attempts | int | not null default 0 | throttle |

**Indexes:** unique `(order_id)`.
**RLS:** customer reads own (via order); **write service-role only** (OTP generated/verified server-side, never client-trusted — mirrors `payments` §3.8).

### 3.33 `disputes` — Phase 2 (0004, escrow)
Backs: REQ-PAY-11 (CR §H.1). Customer raises within the acceptance window → funds frozen → admin resolves.

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
| created_at / updated_at | timestamptz | not null default now() | |

**Indexes:** `(order_id)`, `(status)`, `(raised_by)`.
**RLS:** customer creates/reads own (via order, **only while within the acceptance window & order delivered**); vendor reads disputes on their `order_items`; **resolution writes service-role (admin) only**.

### 3.34 `payouts` — Phase 2 (0004, escrow)
Backs: REQ-PAY-13 (CR §H.1b; manual, pluggable disbursement record — audit-grade record of money leaving the platform).

| Column | Type | Null/Default | Notes |
|--------|------|--------------|-------|
| id | uuid | PK | |
| vendor_id | uuid | not null FK→`profiles(id)` | |
| market | market | not null | payouts are per-market (currency-consistent) |
| currency | currency_code | not null | |
| amount | numeric(10,2) | not null check (>=0) | the NET the system computed at disbursement time |
| method | payout_method | not null default `'manual_bank_transfer'` | pluggable (manual now → tap_marketplace later) |
| external_reference | text | null | bank transfer ref the admin enters |
| status | text | not null default `'paid'` check in (`'paid'`,`'failed'`,`'reversed'`) | manual = `paid` on confirm |
| executed_by | uuid | not null FK→`profiles(id)` | the admin (audit) |
| executed_at | timestamptz | not null default now() | |
| notes | text | null | |

**Indexes:** `(vendor_id, market)`, `(executed_at)`.
**"Mark as paid" (atomic, service-role):** create the `payouts` row for the computed `net_payable`, set covered `sale_payable` settlements `status='paid'`+`payout_id`, mark netted `cod_commission` rows cleared, write an `audit_log` (§3.22) entry; `net_payable` returns to 0. Executed via a pluggable `PayoutProvider` (`lib/payouts/*`: manual now → Tap Marketplace later) with **no change to ledger math**.
**RLS:** vendor reads own; **all writes service-role (admin) only** — disbursement is an admin-only privileged op; every "mark as paid" writes `audit_log`.

### 3.35 `vendor_balances` — Phase 2 (0004, escrow, VIEW)
Backs: REQ-PAY-12 (CR §H.1b). **System-computed, not stored** (avoids drift). Per `(vendor_id, market, currency)`:

| Bucket | Definition |
|--------|-----------|
| `held_total` | Σ `net_payout` where `entry_type='sale_payable' and status='held'` |
| `available_total` | Σ `net_payout` where `entry_type='sale_payable' and status='available'` |
| `cod_commission_due` | Σ `commission_amount` where `entry_type='cod_commission' and status in ('held','available')` and not yet cleared |
| `paid_total` | Σ `net_payout` where `status='paid'` |
| **`net_payable`** | `available_total − cod_commission_due` (the number the admin sees; can be **negative** → vendor owes the platform, carried forward — H-Q6/H-Q7/H-Q9) |

**RLS:** inherits `settlements` read scope (vendor sees own; admin via service-role).

> **`service_prices` (Phase 4) — deferred:** the provider analogue of `product_prices` `(service_id, market, currency, price, is_available)` is authored when 0006 lands (§3.11 note, CR §F.1). Not created by CR-01's 0008/0009.

---

## 4. Relationship summary

- `profiles 1:1 auth.users`; `1:1 event_planners`; `1:N` products, services, rentals(as customer), orders, bookings, cart_items, availability, center_offers, portfolio_items, reviews(author).
- `products 1:N` variants, order_items, cart_items, rentals.
- `services 1:N` bookings, portfolio_items(service-scoped).
- `orders 1:N` order_items, payments, settlements.
- `bookings/rentals 1:N` payments, settlements.
- `event_planners 1:N` event_requests.
- `reviews` polymorphic → product | service | provider(profile) | planner.

---

## 5. Triggers & functions

**`handle_new_user()`** (0001, `AFTER INSERT ON auth.users`): inserts a `profiles` row; `role` from `new.raw_user_meta_data->>'role'` (default `customer`); `status = 'active'` when role `customer`, else `'pending'` (REQ-AUTH-05). `SECURITY DEFINER`.

**`set_updated_at()`** (0001, `BEFORE UPDATE`): sets `updated_at = now()`. Attached to all tables with `updated_at`.

**`reviews_aggregate()`** (0007, `AFTER INSERT/UPDATE/DELETE ON reviews`): recomputes `avg_rating`/`total_reviews` on the target table by `target_type`:
- `product` → `products`, `service` → `services`, `planner` → `event_planners`, `provider` → (aggregated onto the provider's `profiles`-linked rollup; stored on `event_planners` when applicable or computed in a view for plain providers). Keeps client-reference `avgRating/totalReviews` semantics, maintained server-side (no client writes).

**Privilege guard** (0002): trigger/policy ensures non-admins cannot change `profiles.role` / `profiles.status` or `event_planners.is_verified`. **CR-01 extends this** to `profiles.is_verified` (admin-only, 0008), `vendor_markets.is_approved` (0008), and `vendor_applications`/`vendor_verification` `status`/`reviewed_*` (0009). Note `event_planners.is_verified` is removed when 0007 lands (Q-F1, §3.15).

---

## 6. RLS strategy (summary)

Deny-by-default everywhere (REQ-NFR-05). Patterns:
- **Public catalog read:** `products`, `services`, `categories`, `center_offers`, `portfolio_items`, `reviews`, `event_planners` (verified) — `SELECT` open (active/verified only).
- **Owner-scoped:** `cart_items`, `orders`, `rentals`, `bookings`, `event_requests`, `payments`(read), `settlements`(read) — `auth.uid()` matches owner; vendors see rows referencing their listings via join policies.
- **Admin/privileged:** `platform_settings`, `platform_upfront_fees`(write), `audit_log`, approvals, verify, COD confirm, settlement payouts — **service-role only** (server). Never a broad public admin policy.
- **No self-escalation:** role/status/is_verified not user-writable; `vendor_markets.is_approved`, `vendor_applications.status`/`reviewed_*`, `vendor_verification.status`/`reviewed_*` not owner-settable either (CR-01, §3.25/§3.30/§3.31).
- **CR-01 public read surfaces:** `product_prices`/`product_variant_stock` (available + active parent), `attribute_definitions`/`attribute_options` (writes admin-only), `product_attributes` (parent active), `public_vendor_profiles` view (no PII). **Market visibility is a QUERY-layer filter, not RLS** (RLS can't read the request cookie) — RLS = "is it public?", query = "is it in *your* market?" (§A.2, ⚠ R3 cross-market-leak).
- **CR-01 escrow (Phase 2):** `order_deliveries`/`payments` writes service-role only; `disputes` customer-create within window, admin-resolve; `settlements` transitions + `payouts` writes service-role only (every payout writes `audit_log`).

---

## 7. Storage (Supabase) — C3

Buckets: `avatars` (public), `products` (public), `services` (public), `portfolio` (public read; owner write via Storage RLS). Uploads go through `POST /api/upload` (validates mime/size, enforces ownership) and persist the returned public URL onto the row (`products.images`, `portfolio_items.url`, `profiles.avatar_url`). **No Cloudinary.**

> **CR-01 (0009) — NEW PRIVATE bucket `verification-docs` (first non-public bucket).** Stores KYC ID documents (`vendor_verification.doc_urls`, §3.31). Storage RLS: owner may **write** under `{uid}/…` and **read own**; **NO public read**; **admin reads via service-role / short-lived signed URLs only**. `lib/storage/buckets.ts` gains it with `public: false`; `POST /api/upload` must support private uploads (returns the storage **path**, not a public URL). ⚠ R4 net-new infra + PII retention policy (REQ-NFR-05).

---

## 8. Future scalability

- Partition `payments`/`audit_log` by month at scale.
- Add `delivery_agents` + COD reconciliation tables (C9, Phase 2 ops).
- Multi-currency modeled via `currency_code`; add FX table if cross-region selling appears.
- Materialized views for admin reports (REQ-DASH-06); read replicas for catalog.
- `pgvector` for AI recommendations (REQ-AI-01, deferred).

---

## 9. Reconciliation vs previous DATABASE.md

See the dedicated reconciliation note delivered with this batch. Summary of authoritative changes: `service_provider`→**`provider`**; `account_status`→**`profile_status`**; **dropped** `profiles.profile_portfolio` & `services.portfolio_images` jsonb (now `portfolio_items`); added **`is_paid` STORED generated** columns on orders/bookings/rentals; split fees into **`platform_settings` + `platform_upfront_fees`**; added `remaining_collected` (bookings) and explicit `cod_collected` (orders/rentals); `availability` simplified to offered windows with `is_open`.

---

## Changelog — CR-01 reconciliation (2026-07-01)

Reflects `CHANGE_REQUEST_01.md` (approved v2). Grouped by migration.

**0008 — `markets_pricing.sql` (Phase 1.5):**
- Enums: **add** `market ('EG','SA')`, `attribute_input ('select','multiselect')`.
- Tables: **add** `product_prices` (§3.23), `product_variant_stock` (§3.24), `vendor_markets` (§3.25, role-agnostic), `attribute_definitions` (§3.26), `attribute_options` (§3.27), `product_attributes` (§3.28); **add view** `public_vendor_profiles` (§3.29, no PII).
- Alter: `products` (§3.3) **DROP** price/currency/rental_daily_price/security_deposit/stock → `product_prices` ⚠ closed-phase; `product_variants` (§3.4) **DROP** `stock` → `product_variant_stock` ⚠ closed-phase; `profiles` (§3.1) **ADD** `market`/`country`/`is_verified` ⚠ closed-phase.
- RLS/notes: market filter in QUERY layer not RLS (§A.2, R3); `vendor_markets.is_approved` + `profiles.is_verified` not self-settable (§5/§6); attribute defs/options admin-write only.

**0009 — `vendor_verification.sql` (Phase 1.6):**
- Enum: **add** `verification_status ('unverified','pending','approved','rejected')`.
- Tables: **add** `vendor_applications` (§3.30, multi-role `unique(applicant_id, role)`, Q-C1), `vendor_verification` (§3.31, KYC private docs).
- Alter: `profiles` (§3.1) multi-role **capability model** — `role` → primary/display, authorization derives from approved `vendor_applications`.
- Storage/RLS: **new PRIVATE bucket `verification-docs`** (first non-public, §7, R4); owner-scoped write/read, admin via signed URLs; applications/verification `status`/`reviewed_*` not owner-settable (§5).

**Phase 2 — `0004_commerce.sql` (+ `0004b_escrow.sql`) escrow:**
- Enums: **extend** `settle_status` → `('held','available','paid','refunded','disputed','cancelled')` (`pending` retired → `held`, H-Q5); **add** `dispute_status`, `settlement_entry ('sale_payable','cod_commission')`, `payout_method ('manual_bank_transfer','tap_marketplace')`.
- Tables: **add** `order_deliveries` (§3.32, OTP), `disputes` (§3.33), `payouts` (§3.34, manual/pluggable); **add view** `vendor_balances` (§3.35, held/available/paid + COD-commission netting).
- Alter: `settlements` (§3.9) → escrow ledger (add `entry_type`/`market`/`held_at`/`available_at`/`available_reason`/`dispute_id`/`payout_id` + extended status); `orders` (§3.6) add `delivered_at`/`accepted_at`/`auto_release_at` + document buyer-`is_paid` vs vendor-`available`/`paid`; `platform_settings` (§3.19) add `acceptance_window_hours` (default 72, H-Q3).
- RLS: `order_deliveries`/`payouts`/`settlements` writes service-role only; `disputes` customer-create within window, admin-resolve; every payout writes `audit_log`.

**Deferred (noted, not created by CR-01):** `service_prices` (Phase 4, §3.11/§3.35); `event_planners.is_verified` **removed** → `profiles.is_verified` when 0007 lands (Q-F1, §3.15).
