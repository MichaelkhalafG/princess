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
| GET | `/api/products?category=&minPrice=&maxPrice=&sort=&page=&limit=` | Public | query | `{items, total, page}` | 400 |
| GET | `/api/products/:id` | Public | — | `{product, variants, reviews}` | 404 NOT_FOUND |
| POST | `/api/products` | Seller | `ProductSchema` | `{product}` | 401,403 FORBIDDEN,400 |
| PUT | `/api/products/:id` | Owner(Seller) | `ProductSchema(partial)` | `{product}` | 401,403,404 |
| DELETE | `/api/products/:id` | Owner(Seller) | — | `{ok}` | 401,403,404 |

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

> Checkout response MUST include `cod_amount` so the UI shows exact cash to prepare (REQ-ORD-03). Order `paid` only when upfront captured AND COD confirmed (REQ-PAY-04).

## Payments (REQ-PAY-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| POST | `/api/payments/create-intent` | User | `{target:{type,id}}` | `{intent_id, client_token, amount, currency}` | 400,401,404 |
| POST | `/api/payments/webhook` | Public (signed) | Tap event | `200` (always, after verify) | 400 BAD_SIGNATURE |
| POST | `/api/payments/confirm-cod` | Admin/Agent | `{order_id|booking_id}` | `{payment}` | 401,403,404,409 ALREADY_COLLECTED |
| GET | `/api/payments/:id` | Owner/Admin | — | `{payment}` | 401,403,404 |

> **Webhook security:** verify Tap signature, dedupe via `payments.idempotency_key`, update status, write `audit_log`, return 200 even on duplicate. Never trust client confirmation of capture.

## Event Planners (REQ-EVT-*)

| Method | Path | Auth | Request | Response | Errors |
|--------|------|------|---------|----------|--------|
| GET | `/api/event-planners?city=&specialty=&pending=` | Public (pending=Admin) | query | `{items}` | 400 |
| POST | `/api/event-planners` | Provider | `PlannerSchema` | `{planner}` | 401,403,400,409 EXISTS |
| GET | `/api/event-planners/:id` | Public | — | `{planner, packages, portfolio}` | 404 |
| PUT | `/api/event-planners/:id` | Owner(Provider) | partial | `{planner}` | 401,403,404 |
| PUT | `/api/event-planners/:id/verify` | Admin | `{verify:boolean}` | `{planner}` | 401,403,404 |
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
| GET/PUT | `/api/admin/categories` | Admin | category CRUD | `{categories}` | 401,403,400 |
| GET/PUT | `/api/admin/settings` | Admin | `{commission_*, upfront_fee_*}` | `{settings}` | 401,403,400 |
| GET | `/api/admin/reports?from=&to=` | Admin | query | `{sales,revenue,commission}` | 401,403 |
| GET | `/api/admin/settlements` | Admin | — | `{items}` | 401,403 |
| POST | `/api/admin/settlements/:id/pay` | Admin | — | `{settlement}` | 401,403,404,409 |

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
