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

> Enums are created in the migration of their first use. `currency_code` lives in `0001` because `platform_upfront_fees` (0002) and `products` (0003) depend on it.

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
create type settle_status  as enum ('pending','paid','held');
-- 0005
create type rental_status  as enum ('pending','active','returned','cancelled');
-- 0006
create type booking_status as enum ('pending','confirmed','completed','cancelled','no_show');
-- 0007
create type request_status as enum ('pending','accepted','declined','completed','cancelled');
create type review_target  as enum ('product','service','provider','planner');
```

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

**Privilege guard** (0002): trigger/policy ensures non-admins cannot change `profiles.role` / `profiles.status` or `event_planners.is_verified`.

---

## 6. RLS strategy (summary)

Deny-by-default everywhere (REQ-NFR-05). Patterns:
- **Public catalog read:** `products`, `services`, `categories`, `center_offers`, `portfolio_items`, `reviews`, `event_planners` (verified) — `SELECT` open (active/verified only).
- **Owner-scoped:** `cart_items`, `orders`, `rentals`, `bookings`, `event_requests`, `payments`(read), `settlements`(read) — `auth.uid()` matches owner; vendors see rows referencing their listings via join policies.
- **Admin/privileged:** `platform_settings`, `platform_upfront_fees`(write), `audit_log`, approvals, verify, COD confirm, settlement payouts — **service-role only** (server). Never a broad public admin policy.
- **No self-escalation:** role/status/is_verified not user-writable.

---

## 7. Storage (Supabase) — C3

Buckets: `avatars` (public), `products` (public), `services` (public), `portfolio` (public read; owner write via Storage RLS). Uploads go through `POST /api/upload` (validates mime/size, enforces ownership) and persist the returned public URL onto the row (`products.images`, `portfolio_items.url`, `profiles.avatar_url`). **No Cloudinary.**

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
