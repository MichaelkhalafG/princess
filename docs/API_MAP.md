# API_MAP.md

> **Project:** Princess · Next.js 14 Route Handlers (`app/api/**/route.ts`) + Server Actions.
> Auth via **Supabase** session (cookie). RBAC = **RLS** + server guard. All bodies validated with **Zod**.
> Response envelope: success `{ data }` · error `{ error: { code, message, details? } }`.

---

## Conventions

- **Auth column:** `Public` (no session) · `User` (any logged-in) · `Owner` (RLS-scoped) · `Seller` / `Provider` / `Admin` (role-gated).
- All write endpoints: server-side Zod validation + RLS. All list endpoints: pagination `?page=&limit=` (default 1/20).
- Money in responses includes `currency`.

---

## Auth (REQ-AUTH-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/auth/register` | Public | `{email,password,full_name,role}` | `{user, session}` | 400 VALIDATION, 409 EMAIL_TAKEN |
| POST | `/api/auth/login` | Public | `{email,password}` | `{user, session}` | 400, 401 INVALID_CREDENTIALS |
| POST | `/api/auth/logout` | User | — | `{ok}` | 401 |
| GET | `/api/auth/me` | User | — | `{profile}` | 401 |

> Register/login may also use Supabase client SDK directly; routes wrap to set role + create profile.

## Products (REQ-PROD-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/products?category=&minPrice=&maxPrice=&sort=&attr_<slug>=&page=&limit=` | Public | query | `{items, total, page}` | 400 |
| GET | `/api/products/:id` | Public | — | `{product, prices, seller, variants, reviews}` | 404 NOT_FOUND |
| POST | `/api/products` | Seller | `ProductSchema` | `{product}` | 401,403 FORBIDDEN,400 |
| PUT | `/api/products/:id` | Owner(Seller) | `ProductSchema(partial)` | `{product}` | 401,403,404 |
| DELETE | `/api/products/:id` | Owner(Seller) | — | `{ok}` | 401,403,404 |

> **Market context (REQ-MKT-01/03, CR-01):** `GET /api/products` and `/:id` resolve the active **market** server-side (cookie/geo, never a client-trusted param; optional `?market=` for admin/testing only). Responses return the active market's `product_prices` block; `/:id` returns `404 NOT_FOUND` if the product has no price in the active market ("invisible" cross-market). `seller` = public vendor block (name, approved markets, verified badge, coarse city, member-since, rating — REQ-VEND-03).
> **Attribute facets (REQ-PROD-09, CR-01):** `?attr_<slug>=<optionSlug>,<optionSlug>` — multi-valued, controlled-vocabulary facets (URL = single source of truth).
> **`ProductSchema` (CR-01):** replaces scalar `price`/`currency` with a **`prices[]`** array `[{market, price, rental_daily_price?, security_deposit?, stock, is_available}]` (every `market` must be one the seller is approved for — `vendor_markets.is_approved`) + `attribute_option_ids[]` (validated against the category's allowed options).

## Markets (REQ-MKT-*) — CR-01

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/market` | Public | — | `{market, currency, geo_hint}` | — |
| POST | `/api/market` | Public | `{market}` | `{market}` | 400 |
| GET | `/api/vendor/markets` | Seller/Provider | — | `{items}` | 401,403 |
| POST | `/api/vendor/markets` | Seller/Provider | `{market, branch_name?, branch_address?}` | `{market}` | 401,403,400,409 |

> `GET/POST /api/market` read/set the explicit market selector (cookie → `profiles.market`; geo is a hint only, never auto-committed — REQ-MKT-02). May be a Server Action setting the cookie. `POST /api/vendor/markets` creates a **pending** `vendor_markets` row (`is_approved=false`, not self-settable); admin approves via the approvals flow. A seller may only price a product in a market they are **approved** for.

## Vendor Onboarding & KYC (REQ-VEND-*) — CR-01

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/vendor/applications` | User | `ApplicationSchema {role, business_name, business_type?, contact_phone, business_address?, markets[], sample_images[]}` | `{application}` | 401,400,409 EXISTS |
| GET | `/api/vendor/applications/me` | User | — | `{items}` | 401 |
| POST | `/api/vendor/verification` | User | `{legal_name, doc_type, doc_number?, doc_urls[]}` | `{verification}` | 401,400 |
| GET | `/api/vendor/verification/me` | User | — | `{verification}` | 401 |

> **Multi-role (Q-C1):** applications are keyed `unique(applicant_id, role)` — a user can submit BOTH `seller` and `provider` applications and reach both dashboards; capability is derived from **approved** applications, not `profiles.role`. Owner may insert/read/update own **while `pending`**; cannot set `status`/`reviewed_*` (no-escalation). `doc_urls[]` are **private-bucket paths** (`verification-docs`); admin review sets `profiles.is_verified` on approve. Admin review endpoints are in §Admin.

## Rentals (REQ-RENT-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/rentals/availability/:productId?start=&end=` | Public | query | `{available:boolean, blockedRanges[]}` | 404 |
| POST | `/api/rentals` | User | `{product_id,start_date,end_date}` | `{rental, payment_intent}` | 400,409 DATE_CONFLICT |
| GET | `/api/rentals/my-rentals` | Owner | — | `{items}` | 401 |
| PUT | `/api/rentals/:id/status` | Owner/Seller/Admin | `{status}` | `{rental}` | 401,403,404,409 INVALID_TRANSITION |

> `POST /api/rentals` runs in a transaction; exclusion constraint → `409 DATE_CONFLICT` on overlap (REQ-RENT-02).

## Services (REQ-SVC-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/services?type=&maxPrice=&rating=&page=` | Public | query | `{items,total}` | 400 |
| GET | `/api/services/:id` | Public | — | `{service, provider, portfolio, reviews}` | 404 |
| | | | | *(CR-01: `provider` = shared public vendor block, same shape as products' `seller` — REQ-VEND-03)* | |
| POST | `/api/services` | Provider | `ServiceSchema` | `{service}` | 401,403,400 |
| PUT | `/api/services/:id` | Owner(Provider) | partial | `{service}` | 401,403,404 |
| DELETE | `/api/services/:id` | Owner(Provider) | — | `{ok}` | 401,403,404 |
| GET | `/api/availability/:providerId?date=` | Public | query | `{slots:[{start,end,available}]}` | 404 |
| POST | `/api/availability` | Provider | `{slots[]}` | `{ok}` | 401,403,400,409 OVERLAP |
| POST | `/api/center-offers` | Provider(center) | `OfferSchema` | `{offer}` | 401,403,400 |
| GET | `/api/center-offers?providerId=` | Public | query | `{items}` | — |

## Bookings (REQ-BOOK-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/bookings` | User | `{service_id,slot_start,slot_end}` | `{booking, payment_intent}` | 400,409 SLOT_TAKEN |
| GET | `/api/bookings/my-bookings` | Owner | — | `{items}` | 401 |
| GET | `/api/bookings/provider` | Provider | — | `{items}` | 401,403 |
| PUT | `/api/bookings/:id/status` | Provider/Owner/Admin | `{status}` | `{booking}` | 401,403,404,409 INVALID_TRANSITION |

> Booking creation is transactional + reserves the availability slot; emits Realtime event for live blocking (REQ-BOOK-05). Booking is only `confirmed` after upfront fee captured (REQ-BOOK-01).

## Cart & Orders (REQ-CART-*, REQ-ORD-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/cart` | User | — | `{items, totals}` | 401 |
| POST | `/api/cart` | User | `{product_id,variant_id?,quantity}` | `{item}` | 400,401,409 OUT_OF_STOCK |
| DELETE | `/api/cart/:itemId` | Owner | — | `{ok}` | 401,403,404 |
| POST | `/api/orders` | User | `{items?,shipping_address,payment:{upfront}}` | `{order, payment_intent, cod_amount}` | 400,401,409 |
| GET | `/api/orders/my-orders` | Owner | — | `{items}` | 401 |
| PUT | `/api/orders/:id/status` | Seller/Admin | `{status}` | `{order}` | 401,403,404,409 |
| POST | `/api/orders/:id/confirm-delivery` | Admin/Agent | `{otp}` | `{order, delivery}` | 401,403,404,409 INVALID_TRANSITION |
| POST | `/api/orders/:id/accept` | Owner(Customer) | — | `{order}` | 401,403,404,409 |

> Checkout response MUST include `cod_amount` so the UI shows exact cash to prepare (REQ-ORD-03). Order `paid` only when upfront captured AND COD confirmed (REQ-PAY-04).
> **Escrow lifecycle (CR-2 / Phase 2):** `confirm-delivery` verifies the hashed **delivery OTP** (server-side) → order `delivered`, `cod_collected=true` for COD, settlement `held`, and starts the acceptance window (`auto_release_at = delivered_at + acceptance_window_hours`, default 72h). Auth Admin/Agent — **admin enters the OTP on the courier's behalf in v1** (no new role, H-Q2/C9). `accept` = customer "received & satisfied" → settlement `held → available` (`available_reason='customer_accepted'`). No action by expiry → auto-release (§Admin, scheduled job). "Paid" (buyer) ≠ "available/paid-out" (vendor) — separate axes (REQ-PAY-04/12).

## Payments (REQ-PAY-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/payments/create-intent` | User | `{target:{type,id}}` | `{intent_id, client_token, amount, currency}` | 400,401,404 |
| POST | `/api/payments/webhook` | Public (signed) | Tap event | `200` (always, after verify) | 400 BAD_SIGNATURE |
| POST | `/api/payments/confirm-cod` | Admin/Agent | `{order_id|booking_id}` | `{payment}` | 401,403,404,409 ALREADY_COLLECTED |
| GET | `/api/payments/:id` | Owner/Admin | — | `{payment}` | 401,403,404 |

> **Webhook security:** verify Tap signature, dedupe via `payments.idempotency_key`, update status, write `audit_log`, return 200 even on duplicate. Never trust client confirmation of capture.
> **CR-01 / CR-2 (escrow):** COD collection **moves to the delivery-OTP step** — `POST /api/orders/:id/confirm-delivery` (§Cart & Orders) sets `cod_collected=true` on OTP verify. `POST /api/payments/confirm-cod` **merges into** `confirm-delivery` (or remains an admin fallback). Capture/COD-collection now opens the escrow **hold** (`settlements.status='held'`), not an immediate vendor payout — see §Orders escrow, §Disputes, §Admin payouts.

## Disputes (REQ-PAY-11) — CR-2 / Phase 2

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/disputes` | Owner(Customer) | `{order_id, reason, description?, evidence[]}` | `{dispute}` | 400,401,403,404,409 |
| GET | `/api/disputes/:id` | Owner(Customer)/Admin | — | `{dispute}` | 401,403,404 |

> Customer may open a dispute **only while the order is `delivered` and within the acceptance window** → funds stay `held` (settlement `disputed`) until an admin resolves (§Admin `PUT /api/admin/disputes/:id`). Resolution writes are service-role (admin) only.

## Event Planners (REQ-EVT-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/event-planners?city=&specialty=&pending=` | Public (pending=Admin) | query | `{items}` | 400 |
| POST | `/api/event-planners` | Provider | `PlannerSchema` | `{planner}` | 401,403,400,409 EXISTS |
| GET | `/api/event-planners/:id` | Public | — | `{planner, packages, portfolio}` | 404 |
| PUT | `/api/event-planners/:id` | Owner(Provider) | partial | `{planner}` | 401,403,404 |
| PUT | `/api/event-planners/:id/verify` | Admin | `{verify:boolean}` | `{planner}` | 401,403,404 |
| | | | | *(CR-01: **folded into** unified admin KYC `PUT /api/admin/verifications/:id`; `event_planners.is_verified` removed → reads `profiles.is_verified`. Planner-specific verify endpoint dropped/aliased — REQ-EVT-07/Q-F1)* | |
| POST | `/api/event-planners/requests` | User | `RequestSchema` | `{request}` | 400,401,404 |
| GET | `/api/event-planners/requests/my-requests` | Owner(Customer) | — | `{items}` | 401 |
| GET | `/api/event-planners/requests?provider=true` | Provider | — | `{items}` | 401,403 |
| PUT | `/api/event-planners/requests/:id` | Provider | `{status}` | `{request}` | 401,403,404,409 |

## Portfolio (REQ-PORT-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/providers/:id/portfolio` | Public | — | `{provider_name, profile_pic, portfolio[]}` | 404 |
| PUT | `/api/users/portfolio` | Provider | `{profile_portfolio[]}` | `{data}` | 401,400 |
| PUT | `/api/services/:id/portfolio` | Owner(Provider)/Admin | `{portfolio_images[]}` | `{data}` | 401,403,404 |

> Combined portfolio = `portfolio_items` (profile) merged with each service's `portfolio_images`, tagged by `source` (REQ-PORT-04).

## Uploads / Storage (REQ-NFR-12)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/upload` | User | multipart `files[]`, `bucket` | `{urls[], data[]}` | 400 BAD_FILE,401,413 TOO_LARGE |

> Validates mime (`image/*`) + size; uploads to Supabase Storage bucket; returns public URLs. Replaces Cloudinary route (C3).
> **Private bucket (CR-01, REQ-VEND-02):** `bucket='verification-docs'` uploads to the private KYC bucket under an owner-scoped path (`{uid}/…`) and returns the storage **path** (`data[].path`), NOT a public URL. Admins read via short-lived signed URLs only; no public read.

## Reviews (REQ-REV-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/reviews` | User | `{target_type,target_id,rating,comment}` | `{review}` | 400,401,409 ALREADY_REVIEWED |
| GET | `/api/reviews/:targetId?type=` | Public | query | `{items, summary:{avg,total}}` | 400 |

## Admin (REQ-DASH-*, REQ-PAY-06)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/admin/approvals` | Admin | — | `{sellers[],providers[]}` | 401,403 |
| PUT | `/api/admin/approvals/:userId` | Admin | `{status}` | `{profile}` | 401,403,404 |
| GET | `/api/admin/applications` | Admin | `?role=&status=` | `{items}` | 401,403 |
| PUT | `/api/admin/applications/:id` | Admin | `{status, review_notes?, markets?}` | `{application}` | 401,403,404 |
| GET | `/api/admin/verifications` | Admin | `?status=` | `{items}` | 401,403 |
| PUT | `/api/admin/verifications/:id` | Admin | `{status, notes?}` | `{verification}` | 401,403,404 |
| GET/PUT | `/api/admin/attributes` | Admin | attribute definitions + options CRUD | `{definitions, options}` | 401,403,400 |
| GET/PUT | `/api/admin/categories` | Admin | category CRUD | `{categories}` | 401,403,400 |
| GET/PUT | `/api/admin/settings` | Admin | `{commission_*, upfront_fee_*, acceptance_window_hours}` | `{settings}` | 401,403,400 |
| GET | `/api/admin/reports?from=&to=` | Admin | query | `{sales,revenue,commission}` | 401,403 |
| GET | `/api/admin/disputes?status=` | Admin | query | `{items}` | 401,403 |
| PUT | `/api/admin/disputes/:id` | Admin | `{resolution: release\|refund, notes?}` | `{dispute}` | 401,403,404,409 |
| GET | `/api/admin/payouts` | Admin | `?market=` | `{vendors:[{vendor_id, market, currency, net_payable, held_total, available_total, cod_commission_due}]}` | 401,403 |
| POST | `/api/admin/payouts` | Admin | `{vendor_id, market, external_reference?, notes?}` | `{payout}` | 401,403,404,409 |
| GET | `/api/admin/settlements` | Admin | — | `{items}` | 401,403 |

> **CR-01 approvals basis:** `GET/PUT /api/admin/approvals*` extends to read **vendor applications + KYC** (`vendor_applications`, `vendor_verification`) as the approval basis — approve sets `status='active'`, approves `vendor_markets`, and (on KYC approve) `profiles.is_verified=true`.
> **CR-01 admin settings:** `acceptance_window_hours` (default 72) added for the escrow acceptance window (REQ-PAY-10).
> **CR-2 payouts (supersedes `POST /api/admin/settlements/:id/pay`):** `POST /api/admin/settlements/:id/pay` is **REMOVED/superseded** by `POST /api/admin/payouts` — a **per-vendor netted disbursement**, not per-settlement. `GET /api/admin/payouts` lists vendors + the **system-computed NET payable** (`vendor_balances`: `available_total − cod_commission_due`, per market/currency). `POST` records the manual disbursement via `PayoutProvider.execute` (admin transfers via bank OUTSIDE the system), moves `available → paid`, clears netted COD commission, zeroes `net_payable`, and writes `audit_log` ("Mark as paid"). Admin-only, service-role (REQ-PAY-12/13).
> **CR-2 disputes:** admin resolves within the acceptance window — `release` → settlement `available`, `refund` → `refunded` (+ Tap refund for online; void COD-commission debt on COD refund — H-Q7). Resolutions are **release/refund only** in v1 (no partial — H-Q4).
> **CR-2 auto-release (scheduled job):** a Supabase scheduled **Edge Function / `pg_cron`** sweeps orders where `now() >= auto_release_at` with no open dispute → settlement `held → available` (`available_reason='auto_release'`, assumed acceptance). Not an HTTP endpoint (H-Q8).

## Notifications (REQ-NOT-*) — internal

| Trigger | Channel | Template |
|---------|---------|----------|
| Order/booking confirmed | Email (Resend) | `order_confirmed`, `booking_confirmed` |
| Upfront fee captured | Email | `payment_received` |
| New event request → planner | Email | `new_event_request` |
| Booking reminder (cron edge fn) | Email | `booking_reminder` |
| (Phase 2) all above | SMS (Twilio) | same keys |

---

## Standard Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | VALIDATION | Zod/body invalid |
| 401 | UNAUTHENTICATED | No/expired session |
| 403 | FORBIDDEN | Role/ownership denied (RLS) |
| 404 | NOT_FOUND | Missing resource |
| 409 | CONFLICT | DATE_CONFLICT / SLOT_TAKEN / OUT_OF_STOCK / ALREADY_* / INVALID_TRANSITION |
| 413 | TOO_LARGE | Upload exceeds limit |
| 429 | RATE_LIMITED | Throttle |
| 500 | INTERNAL | Unexpected |
| 502 | PAYMENT_PROVIDER | Tap/gateway error |

All write endpoints are idempotent where it matters (payments via `idempotency_key`; status transitions validated against allowed state machine).

The typed response envelope `{data} | {error:{code,message,details?}}` is unchanged. Auth/role annotations (customer/seller/provider/admin; service-role where noted) stay consistent across the new endpoints.

---

## Changelog — CR-01 reconciliation (2026-07-01)

Reconciled against approved `CHANGE_REQUEST_01.md` (v2; escrow defaults H-Q2(a) admin-enters-OTP, H-Q3 72h global, H-Q4 release/refund only, H-Q7(a) void COD-commission debt on COD refund, H-Q8 pg_cron/Edge).

**Changed endpoints**
- `GET /api/products` — server-resolved market context (cookie/geo, optional `?market=` for admin/testing) + `?attr_<slug>=` multi-valued attribute facets; response returns the active market's price block.
- `GET /api/products/:id` — returns `404 NOT_FOUND` if no price in the active market; response gains a public `seller` block + `prices`.
- `POST/PUT /api/products` — `ProductSchema` replaces `price`/`currency` with `prices[]` (per approved market) + `attribute_option_ids[]`.
- `POST /api/upload` — supports private `verification-docs` bucket (owner-scoped path, returns storage path, admin signed-URL reads).
- `POST /api/payments/confirm-cod` — COD collection moved to `confirm-delivery`; merges into it / admin fallback; capture now opens escrow hold.
- `GET /api/services/:id` — `provider` block reconciled to the shared public vendor block.
- `PUT /api/event-planners/:id/verify` — folded into unified admin KYC (`PUT /api/admin/verifications/:id`); dropped/aliased.
- `GET/PUT /api/admin/approvals*` — extended to read vendor applications + KYC as approval basis; `/api/admin/settings` gains `acceptance_window_hours`.
- `POST /api/admin/settlements/:id/pay` — **superseded/removed** by `POST /api/admin/payouts` (per-vendor netted disbursement).

**New endpoints (CR-1A/1B)** — `GET/POST /api/market`; `GET/POST /api/vendor/markets`; `GET/PUT /api/admin/attributes`; `POST /api/vendor/applications` + `GET …/me`; `GET /api/admin/applications` + `PUT /api/admin/applications/:id`; `POST /api/vendor/verification` + `GET …/me`; `GET /api/admin/verifications` + `PUT /api/admin/verifications/:id`.

**New endpoints (CR-2 / Phase 2)** — `POST /api/orders/:id/confirm-delivery` (OTP verify → delivered, hold, window; Admin/Agent, admin enters OTP in v1); `POST /api/orders/:id/accept` (held→available); `POST /api/disputes` + `GET /api/disputes/:id`; `GET/PUT /api/admin/disputes*`; `GET /api/admin/payouts` (vendors + system-computed NET payable) + `POST /api/admin/payouts` ("Mark as paid"); auto-release scheduled Edge Function / `pg_cron` (not an HTTP endpoint).
