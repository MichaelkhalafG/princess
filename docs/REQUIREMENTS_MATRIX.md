# REQUIREMENTS_MATRIX.md

> **Project:** Princess — All-in-One Women's Marketplace
> **"The law" (CLAUDE_RULES §0).** Every implementation task MUST cite a `REQ-ID`. Nothing ships without a matching row. When a requirement changes, **edit the row + add a changelog line** — never delete history.
> **This file supersedes the previous matrix.** Columns are now: **REQ-ID | Description | Priority | Phase | Status | Notes**.
> **Priority:** `P0` must / never cut (payment, RBAC, availability, core flows) · `P1` core · `P2` deferrable.
> **Status:** `Not started` · `In progress` · `Built` · `Deferred`.
> **Phase** maps to `IMPLEMENTATION_PLAN.md` (0–7).

---

## Locked decisions (confirmed 2026-06-28)

| Decision | Resolution |
|---|---|
| Stack | Supabase (DB/Auth/Storage/Realtime) · Next.js 14 + TS · Tailwind + shadcn/ui · Vercel · Resend |
| Notifications | Email (Resend) now; SMS provider-agnostic, **Twilio = Phase 2** |
| Payments | `PaymentProvider` abstraction; **Tap primary**, Stripe deferred |
| i18n | **Arabic-first**, bilingual AR/EN, RTL (`next-intl`) |
| Scope/timeline | Full scope into **5 dev + 2 test days** (risk in PROJECT_ANALYSIS §8) |
| Schema naming | `provider` role · `profile_status` · `portfolio_items` (single source) · `is_paid` generated · `platform_settings`+`platform_upfront_fees` |

---

## A. Authentication & Accounts

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-AUTH-01 | Register (email/password, role at signup) | P0 | 0 | Done | 0.3: `profiles` + `handle_new_user` trigger live (role from signup metadata). 0.7: `POST /api/auth/register` (Zod, role→user metadata so trigger sets status) + RegisterForm + RoleSelect — **verified via Playwright E2E** (customer/seller/provider register, duplicate→EMAIL_TAKEN, ar+en) |
| REQ-AUTH-02 | Login + session via `@supabase/ssr` | P0 | 0 | Done | 0.2: ssr clients. 0.6: middleware session refresh live & verified. 0.7: `POST /api/auth/login` + `/logout` + `GET /api/auth/me` + LoginForm with role-based redirect — **verified via Playwright E2E** (login ok, wrong-pass→error & not signed in, logout, ar+en) |
| REQ-AUTH-03 | Roles: customer/seller/provider/admin | P0 | 0 | In progress | 0.3: enum `user_role` (`provider`, not service_provider) + `profiles.role` live |
| REQ-AUTH-04 | Provider type freelancer/center | P1 | 0 | In progress | 0.3: `profiles.provider_type` enum/column live |
| REQ-AUTH-05 | Seller/provider admin approval before listing | P0 | 0 | In progress | 0.3: trigger sets non-customers to `pending` (verified live: seller=pending, customer=active). 0.7: pending sellers/providers land on a dashboard PendingApprovalBanner (status from `/api/auth/me` / `getSessionProfile`) — **banner presence verified via E2E (seller+provider, absent for customer)**. Admin approval UI + actual listing-disable still later |
| REQ-AUTH-06 | RBAC middleware + RLS enforcement | P0 | 0 | In progress | 0.4: `profiles` RLS policies. 0.6: middleware composes intl + Supabase session refresh + `/dashboard/*` role guard (role from DB, not client claims) — verified (logged-out →/login). 0.7: dashboard routes exist; role-based redirect verified via E2E. Full role-match guard + RoleGuard component = 0.10; RLS policy tests = Phase 6 |

## B. Products (Buy)

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PROD-01 | Product catalog (dresses/shoes/bags/accessories/cosmetics) | P0 | 1 | Not started | `products` |
| REQ-PROD-02 | Filters/sort (category, price, sort) | P1 | 1 | Not started | indexed |
| REQ-PROD-03 | Product detail page | P0 | 1 | Not started | |
| REQ-PROD-04 | Variants (size/color/stock) | P1 | 1 | Not started | `product_variants` |
| REQ-PROD-05 | Seller CRUD (own products) | P0 | 1 | Not started | RLS owner |
| REQ-PROD-06 | Product images (Supabase Storage) | P0 | 1 | Not started | `products.images`, C3 |

## C. Cart, Orders & Checkout

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-CART-01 | Add/view/remove cart | P0 | 2 | Not started | `cart_items` |
| REQ-ORD-01 | Checkout (COD + upfront fee) | P0 | 2 | Not started | `orders` |
| REQ-ORD-02 | My orders | P1 | 2 | Not started | RLS |
| REQ-ORD-03 | Exact COD cash shown at checkout | P0 | 2 | Not started | `orders.cod_amount`; client-repeated |
| REQ-ORD-04 | Order status lifecycle | P1 | 2 | Not started | `order_status` |

## D. Payments (Hybrid)

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PAY-01 | Upfront fee intent (platform revenue) | P0 | 2 | Not started | Tap; `platform_upfront_fees` |
| REQ-PAY-02 | Payment webhook (signed, idempotent) | P0 | 2 | Not started | `payments.idempotency_key` |
| REQ-PAY-03 | Confirm COD (admin/agent) | P0 | 2 | Not started | C9: admin confirms v1 |
| REQ-PAY-04 | Paid ONLY when upfront AND COD | P0 | 2 | Not started | **`is_paid` STORED generated col** |
| REQ-PAY-05 | Commission settlement before payout | P0 | 2 | Not started | `settlements` |
| REQ-PAY-06 | Configurable commission/fees (admin) | P0 | 2 | In progress | 0.4: `platform_settings` (15/10/10) + `platform_upfront_fees` (per type×currency, minor units) live & seeded, RLS authenticated-read/service-role-write. Admin UI/API = Phase 2 |
| REQ-PAY-07 | `PaymentProvider` abstraction (Tap; Stripe later) | P1 | 0 | Not started | `lib/payments` |

## E. Rentals

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-RENT-01 | Rental request (date range) | P0 | 3 | Not started | `rentals` |
| REQ-RENT-02 | Availability — no date overlap | P0 | 3 | Not started | **btree_gist exclusion** |
| REQ-RENT-03 | My rentals | P1 | 3 | Not started | RLS |
| REQ-RENT-04 | Rental status lifecycle | P1 | 3 | Not started | `rental_status` |
| REQ-RENT-05 | Security deposit + booking fee | P0 | 3 | Not started | C8 refundable deposit |

## F. Services & Bookings

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-SVC-01 | Service catalog | P0 | 4 | Not started | `services` |
| REQ-SVC-02 | Service filters (type/price/rating) | P1 | 4 | Not started | indexed |
| REQ-SVC-03 | Service detail + portfolio | P0 | 4 | Not started | `portfolio_items` |
| REQ-SVC-04 | Provider service CRUD | P0 | 4 | Not started | RLS owner |
| REQ-SVC-05 | Availability slots | P0 | 4 | Not started | `availability` + exclusion |
| REQ-SVC-06 | Beauty-center offers | P2 | 4 | **Deferred** | schema defined; UI deferred (cut-line) |
| REQ-BOOK-01 | Create booking + upfront fee | P0 | 4 | Not started | confirmed on capture |
| REQ-BOOK-02 | My bookings | P1 | 4 | Not started | RLS |
| REQ-BOOK-03 | Provider bookings | P1 | 4 | Not started | RLS |
| REQ-BOOK-04 | Booking status (confirm/complete/cancel) | P0 | 4 | Not started | `booking_status` |
| REQ-BOOK-05 | Realtime slot blocking | P1 | 4 | Not started | bookings exclusion + Realtime |

## G. Event Planning

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-EVT-01 | Planner profiles (specialties/packages) | P1 | 5 | Not started | `event_planners` typed jsonb |
| REQ-EVT-02 | Planner listing + filters (city/specialty) | P1 | 5 | Not started | GIN(specialties) |
| REQ-EVT-03 | Planner detail (packages/portfolio/quote) | P1 | 5 | Not started | |
| REQ-EVT-04 | Quote request | P1 | 5 | Not started | `event_requests` |
| REQ-EVT-05 | Provider request mgmt (accept/decline/complete) | P1 | 5 | Not started | `request_status` |
| REQ-EVT-06 | My event requests (customer) | P2 | 5 | Not started | RLS |
| REQ-EVT-07 | Admin verify planners | P1 | 5 | Not started | `is_verified` |

## H. Portfolio Gallery

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-PORT-01 | Reusable gallery (grid+lightbox) | P1 | 5 | Not started | `PortfolioGallery` |
| REQ-PORT-02 | Profile portfolio | P1 | 5 | Not started | `portfolio_items` (service_id null) |
| REQ-PORT-03 | Service portfolio | P1 | 5 | Not started | `portfolio_items` (service_id set) |
| REQ-PORT-04 | Combined portfolio merge (source tag) | P1 | 5 | Not started | computed `source` |
| REQ-PORT-05 | Portfolio manager (upload/caption/associate/delete/reorder) | P1 | 5 | Not started | `sort_order` |

## I. Reviews & Notifications

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-REV-01 | Create review | P1 | 5 | Not started | `reviews`; verified-purchase gate TBD |
| REQ-REV-02 | List reviews + summary | P1 | 5 | Not started | indexed |
| REQ-REV-03 | Rating aggregation | P1 | 5 | Not started | `reviews_aggregate` trigger |
| REQ-NOT-01 | Email notifications (Resend) | P0 | 5 | Not started | `NotificationService` |
| REQ-NOT-02 | SMS notifications | P1 | — | **Deferred** | Phase 2 Twilio (C5; Resend email-only) |
| REQ-NOT-03 | Scheduled booking reminders | P2 | — | **Deferred** | Phase 2 edge cron |

## J. Dashboards

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-DASH-01 | Customer dashboard | P0 | 2–5 | Not started | orders/rentals/bookings/requests |
| REQ-DASH-02 | Seller dashboard | P0 | 1–2 | Not started | products/orders/revenue |
| REQ-DASH-03 | Provider dashboard | P0 | 4–5 | Not started | services/bookings/portfolio/requests |
| REQ-DASH-04 | Admin dashboard | P0 | 2–5 | Not started | approvals/COD/settings/verify/reports |
| REQ-DASH-05 | Category management | P1 | 1 | Not started | `categories` |
| REQ-DASH-06 | Reports (sales/revenue/commission) | P2 | 5 | **Deferred** (advanced) | basic now, advanced deferrable |

## K. Non-Functional

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-NFR-01 | RTL + Arabic-first bilingual | P0 | 0 | In progress | 0.5: `next-intl` + `[locale]` routing (ar default, en), RTL `dir` per locale, message catalogs — verified in browser (/→/ar Arabic RTL, /en LTR). Per-feature translations ongoing |
| REQ-NFR-02 | Mobile responsive / PWA-ready | P0 | 0+ | Not started | repeated by client |
| REQ-NFR-03 | RBAC isolation (sellers/providers/admin) | P0 | 0 | In progress | 0.4: profiles RLS. 0.6: middleware dashboard role guard verified. Per-table RLS + RoleGuard in later phases |
| REQ-NFR-04 | Performance (RSC, caching) | P1 | all | Not started | |
| REQ-NFR-05 | Security (RLS, webhook verify, validation) | P0 | all | In progress | 0.1–0.4: RLS deny-by-default on `profiles`/settings; service-role server-only; secrets in env. 0.6: middleware uses anon key + DB role (no client claims). Webhook verify + Zod = later phases |
| REQ-NFR-06 | Accessibility WCAG AA | P1 | all | Not started | DESIGN_RULES §10 |
| REQ-NFR-07 | SEO (metadata/sitemap/hreflang) | P1 | all | In progress | 0.1/0.5: root metadata + viewport themeColor; `lang`/`dir` per locale. sitemap/hreflang/OG = later |
| REQ-NFR-08 | Elegant feminine design (peach/rose-gold/white) | P0 | 0+ | In progress | 0.1: brand tokens (rose-gold/peach/ivory), type scale, 3 shadows, radii, Lucide; shadcn restyled (not default theme). Per-screen polish ongoing |
| REQ-NFR-09 | Scalability/maintainability (enterprise/modular) | P0 | all | Not started | feature modules |
| REQ-NFR-10 | Testing (unit/integration/E2E; COD thorough) | P0 | 6 | In progress | Vitest unit (auth schema, 10 tests). **Playwright E2E pulled forward (scoped to auth)**: `playwright.config.ts` (ar+en projects, auto `pnpm dev` webServer, traces on failure) + `tests/e2e/auth.spec.ts` — **16/16 passed on user's machine** (register customer/seller/provider, login ok/wrong-pass, duplicate email, RTL+copy, no console errors). Full E2E (buy/rent/book/quote, COD/webhook) + RLS policy tests still Phase 6 |
| REQ-NFR-11 | Deployment (Vercel + Supabase) | P0 | 0/7 | Not started | ENV_SETUP.md |
| REQ-NFR-12 | Storage in Supabase buckets | P0 | 1 | Not started | replaces Cloudinary |

## L. AI

| REQ-ID | Description | Priority | Phase | Status | Notes |
|--------|-------------|----------|-------|--------|-------|
| REQ-AI-01 | Smart recommendations | P2 | — | **Deferred** | Phase 3; needs interaction data + pgvector |

---

## Deferred items (with reason)

| REQ-ID | Reason |
|--------|--------|
| REQ-AI-01 | Needs accumulated user-interaction data; not on the 5-day critical path. |
| REQ-NOT-02 | Resend is email-only; SMS via Twilio is Phase 2 (C5). Provider-agnostic service built now. |
| REQ-NOT-03 | Scheduled SMS/email reminders depend on NOT-02 + edge cron; Phase 2. |
| REQ-SVC-06 | Center offers are P2; schema defined, UI deferred per cut-line (IMPLEMENTATION_PLAN). |
| REQ-DASH-06 | Basic reports in-scope; advanced reporting deferrable per cut-line. |

> **Never cut (P0):** all payment (PAY-*), RBAC (AUTH-*, NFR-03/05), availability/no-double-booking (RENT-02, SVC-05, BOOK-05), and the four core flows (buy/rent/book/quote).

---

## Conflict register (all resolved)

| C-ID | Summary | Resolution | Status |
|------|---------|-----------|--------|
| C1 | Prisma vs Supabase | Supabase migrations + generated types | ✅ |
| C2 | next-auth vs Supabase Auth | Supabase Auth (`@supabase/ssr`) | ✅ |
| C3 | Cloudinary vs Supabase Storage | Supabase Storage buckets | ✅ |
| C4 | JS/JSX vs TypeScript | TS; client code reference-only | ✅ |
| C5 | Resend (email) vs required SMS | Email now; SMS Phase 2 (Twilio) | ✅ |
| C6 | App-layer RBAC vs platform | RLS-first + app guards | ✅ |
| C7 | Upfront fee amounts inconsistent | `platform_upfront_fees` per type+currency | ✅ default |
| C8 | Booking fee vs security deposit | `upfront_fee` (non-refundable) + `security_deposit` (refundable) | ✅ default |
| C9 | "delivery agent" role absent | Admin confirms COD v1; `delivery_agent` Phase 2 | ✅ default |
| C10 | Currency (USD vs SAR/EGP) | Per-region currency on every monetary row | ✅ default |

---

## Changelog
- 2026-06-28 — Initial matrix from all client messages + stack decisions.
- 2026-06-28 — Conflicts C7–C10 confirmed (defaults).
- 2026-06-28 — **Upgraded to REQ-ID|Description|Priority|Phase|Status|Notes format; aligned with rebuilt DATABASE.md (provider/profile_status/portfolio_items/is_paid/platform_upfront_fees); phases + deferrals made explicit.**
- 2026-06-28 — Phase 0 progress: Tasks 0.1–0.3 done & verified. REQ-AUTH-01..05 → In progress (0.3 DB foundation live: profiles, role/provider_type/profile_status enums, signup trigger, pending state, RLS enabled — smoke-test confirmed seller=pending/customer=active, relrowsecurity=true).
- 2026-06-28 — Task 0.4 done & verified (0002 pushed): profiles RLS policies + no-escalation column grants; platform_settings + platform_upfront_fees live, seeded, RLS authenticated-read/service-role-write. REQ-AUTH-06, REQ-PAY-06, REQ-NFR-05 → In progress.
- 2026-06-29 — Tasks 0.5 & 0.6 done & browser-verified. 0.5: next-intl `[locale]` shell (ar default, RTL, message catalogs, landing). 0.6: composed middleware (intl + Supabase session refresh + dashboard role guard from DB). REQ-NFR-01/03/07/08 → In progress; REQ-AUTH-02/06 progressed.
- 2026-06-29 — Task 0.7 implemented (sandbox gate passed: typecheck + lint clean, 10/10 unit tests). Auth routes `register`/`login`/`logout`/`me` (typed `{data}|{error:{code,message}}` envelope, server-side Zod), `features/auth` data layer (schema/queries/mutations/client), AuthCard + LoginForm + RegisterForm + RoleSelect, role-based redirect, minimal dashboard landings (customer/seller/provider/admin) with PendingApprovalBanner for pending sellers/providers (REQ-AUTH-05). All copy via `messages/*`; admin not self-registerable (schema rejects it). RLS smoke note at `tests/integration/auth.rls-smoke.md`. **Awaiting user browser verification** before marking 0.7 verified PASS. REQ-AUTH-01/02/05/06 progressed.
- 2026-06-29 — Playwright E2E set up (pulled forward from Phase 6, scoped to auth) so auth flows are verified by `pnpm test:e2e` instead of by hand. Added `@playwright/test`, `playwright.config.ts` (ar+en projects, baseURL :3000, auto `pnpm dev` webServer, traces/screenshots on failure), `tests/e2e/{fixtures.ts,auth.spec.ts,README.md}` + `data-testid`s on auth forms/banner/logout. 16 tests collected & compile (typecheck + lint + `playwright --list` green in sandbox). **0.7 stays "awaiting verification" until the user's `pnpm test:e2e` run is green.** REQ-NFR-10 → In progress.
- 2026-06-29 — **Task 0.7 VERIFIED PASS.** User ran `pnpm test:e2e` → **16/16 passed** (ar+en). Root cause of an initial failure was Supabase "Confirm email" being ON; user turned it OFF (⚠️ **must be re-enabled before production** — see prod caveat below) and ran the E2E teardown SQL. REQ-AUTH-01/02 → Done; REQ-AUTH-05/06 progressed; REQ-NFR-10 → In progress (auth E2E green).
- ⚠️ **PROD CAVEAT (Supabase Auth "Confirm email"):** turned OFF in dev so registration returns a session (E2E + smooth dev). **Re-enable before production** so emails are verified; when re-enabled the app already handles the no-session path (register → "check your email" → login). Tracked for the pre-launch checklist.
