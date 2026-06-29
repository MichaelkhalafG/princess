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
| REQ-AUTH-01 | Register (email/password, role at signup) | P0 | 0 | Built | 0.3: `profiles` + `handle_new_user` trigger live. 0.7: `POST /api/auth/register` (Zod, role→user metadata) + RegisterForm + RoleSelect — **E2E-verified** (customer/seller/provider, duplicate→EMAIL_TAKEN, ar+en) |
| REQ-AUTH-02 | Login + session via `@supabase/ssr` | P0 | 0 | Built | 0.2: ssr clients. 0.6: middleware session refresh verified. 0.7: `POST /api/auth/login` + `/logout` + `GET /api/auth/me` + LoginForm role-redirect — **E2E-verified** (login ok, wrong-pass→error, logout, ar+en) |
| REQ-AUTH-03 | Roles: customer/seller/provider/admin | P0 | 0 | Built | 0.3: enum `user_role` (`provider`) + `profiles.role` live; consumed by register/login redirect, middleware guard, RoleGuard, AuthMenu (4 dashboards) |
| REQ-AUTH-04 | Provider type freelancer/center | P1 | 0 | Built | 0.3: `provider_type` enum/column live (data model complete). Provider chooses type during onboarding UI in Phase 4 (carry-forward) |
| REQ-AUTH-05 | Seller/provider admin approval before listing | P0 | 0 | Built | 0.3: trigger sets non-customers `pending` (live-verified). 0.7: PendingApprovalBanner (status from `/api/auth/me`) — **E2E-verified** (seller+provider show it, customer doesn't). Admin approval UI + listing-disable = Phase 5/admin (carry-forward) |
| REQ-AUTH-06 | RBAC middleware + RLS enforcement | P0 | 0 | Built | 0.4: `profiles` RLS. 0.6: middleware (intl + session refresh + `/dashboard/*` role guard from DB). 0.7: role-redirect E2E-verified. 0.10: `RoleGuard` component. RLS verified via `tests/integration/rls.test.ts` + SQL block. Per-table RLS as tables land (carry-forward) |

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
| REQ-PAY-01 | Upfront fee intent (platform revenue) | P0 | 2 | In progress | **0.9 spike VERIFIED** against live Tap sandbox (charge `chg_TS05A…`, `live_mode:false`, `status:INITIATED`, `transaction.url` redirect): `TapProvider.createIntent` makes the real `/v2/charges` call (minor→major `toTapAmount` — SAR/EGP=2dp confirmed; redirect flow; idempotency via `reference.transaction`). Findings + observed shape in `docs/SPIKE_NOTES.md`. Full route + `payments`/`platform_upfront_fees` persistence + webhook hashstring secret confirmation = Phase 2 |
| REQ-PAY-02 | Payment webhook (signed, idempotent) | P0 | 2 | Not started | `payments.idempotency_key` |
| REQ-PAY-03 | Confirm COD (admin/agent) | P0 | 2 | Not started | C9: admin confirms v1 |
| REQ-PAY-04 | Paid ONLY when upfront AND COD | P0 | 2 | Not started | **`is_paid` STORED generated col** |
| REQ-PAY-05 | Commission settlement before payout | P0 | 2 | Not started | `settlements` |
| REQ-PAY-06 | Configurable commission/fees (admin) | P0 | 2 | In progress | 0.4: `platform_settings` (15/10/10) + `platform_upfront_fees` (per type×currency, minor units) live & seeded, RLS authenticated-read/service-role-write. Admin UI/API = Phase 2 |
| REQ-PAY-07 | `PaymentProvider` abstraction (Tap; Stripe later) | P1 | 0 | Done | 0.8 **VERIFIED**: `lib/payments` — `PaymentProvider` interface (createIntent/verifyWebhook/getCaptureStatus, integer minor units, typed envelope, optional `destination` for marketplace split → REQ-PAY-05/Phase 2), `TapProvider` (createIntent sandbox stub → real call in 0.9; webhook verify via **Tap hashstring** scheme, timing-safe + fail-closed), `StripeProvider` stub (NotImplemented), `index.ts` factory (→Tap). Feature code depends on the interface only (CLAUDE_RULES §3). Unit-tested (factory + minor-units guard + webhook round-trip/tamper). 0.9 confirms hashstring secret + per-currency decimals |

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
| REQ-NOT-01 | Email notifications (Resend) | P0 | 5 | In progress | 0.8: `lib/notifications` — `NotificationService` interface (`send(template,to,data)`, channel-agnostic), `ResendEmailChannel` (env-keyed, server-only, 5 template keys w/ stub bodies), `SmsChannel` interface placeholder (Twilio Phase 2, C5), `index.ts` factory (→email). Real localized templates + triggers = Phase 5 |
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
| REQ-NFR-01 | RTL + Arabic-first bilingual | P0 | 0 | Built | 0.5: `next-intl` + `[locale]` routing (ar default, en), RTL `dir` per locale, message catalogs — E2E-verified (/→/ar Arabic RTL, /en LTR). 0.10: logical RTL props throughout nav/footer. Per-feature translations land with each feature (expected) |
| REQ-NFR-02 | Mobile responsive / PWA-ready | P0 | 0+ | Built | 0.1: PWA `manifest.webmanifest` + themeColor baseline. 0.10: responsive Navbar/Footer + MobileNav Sheet drawer, mobile-first layouts. Offline/installable hardening = Phase 6/7 (carry-forward) |
| REQ-NFR-03 | RBAC isolation (sellers/providers/admin) | P0 | 0 | Built | 0.4: profiles RLS (deny-by-default + column grants). 0.6: middleware dashboard role guard (DB role). 0.10: `RoleGuard` defense-in-depth. RLS smoke test + SQL block (Phase-0 DoD). Per-table RLS as tables land (carry-forward) |
| REQ-NFR-04 | Performance (RSC, caching) | P1 | all | Not started | |
| REQ-NFR-05 | Security (RLS, webhook verify, validation) | P0 | all | Built | Phase-0 posture complete: RLS deny-by-default (`profiles`/settings) + no-escalation column grants (RLS-tested); service-role `server-only`; secrets env-only; middleware anon key + DB role. 0.7: server-side Zod on auth routes. 0.8: provider abstractions `server-only`. 0.9: Tap webhook HMAC verify (fail-closed). Per-route Zod + Tap webhook-secret confirmation as routes land (carry-forward) |
| REQ-NFR-06 | Accessibility WCAG AA | P1 | all | Not started | DESIGN_RULES §10 |
| REQ-NFR-07 | SEO (metadata/sitemap/hreflang) | P1 | all | Built | 0.1/0.5: Next metadata API + viewport themeColor, `lang`/`dir` per locale, favicon, per-page `generateMetadata` (auth). sitemap.xml / robots / hreflang / OpenGraph = Phase 6/7 (carry-forward) |
| REQ-NFR-08 | Elegant feminine design (peach/rose-gold/white) | P0 | 0+ | Built | 0.1: brand tokens, type scale, 3 shadows, radii, Lucide; shadcn restyled (not default). 0.10: Navbar/Footer/MobileNav/LocaleSwitcher + real Rose-Jewel logo, premium landing hero. Navbar feel iterated with user (light ivory, presence). Per-screen polish ongoing as features land |
| REQ-NFR-09 | Scalability/maintainability (enterprise/modular) | P0 | all | Not started | feature modules |
| REQ-NFR-10 | Testing (unit/integration/E2E; COD thorough) | P0 | 6 | Built | Phase-0 scope: Vitest unit (auth schema + providers + Tap webhook/amount = 24 tests); Playwright auth E2E **16/16** (ar+en); RLS smoke `tests/integration/rls.test.ts` (opt-in) + SQL block. Full-flow E2E (buy/rent/book/quote) + exhaustive COD/webhook + per-table RLS tests = Phase 6 (carry-forward) |
| REQ-NFR-11 | Deployment (Vercel + Supabase) | P0 | 0/7 | In progress | Supabase live (migrations 0001+0002 pushed). 0.11: Vercel **PREVIEW** env list + steps + acceptance checklist prepared (`docs/PHASE_0_ACCEPTANCE.md`). Production deploy = Phase 7 |
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
- 2026-06-29 — Task 0.8 done (sandbox gate: typecheck + lint clean, 17/17 unit). Provider abstractions: `lib/payments/{PaymentProvider,tap,stripe,index}.ts` (Tap primary; Stripe NotImplemented stub; factory) + `lib/notifications/{NotificationService,resend,sms,index}.ts` (Resend email channel; SMS interface placeholder for Phase 2). All secrets env + `server-only`; money in integer minor units; feature code depends on interfaces only. vitest `server-only` aliased to a stub so tests can import server-only modules. REQ-PAY-07 → Done; REQ-NOT-01 → In progress.
- 2026-06-29 — Task 0.10 (shared primitives) built; sandbox gate green (typecheck + lint + 24/24 unit). `components/shared/`: Navbar (server, fetches role) + NavbarClient (sticky, scroll-aware ivory blur, rose-gold active underline, real `public/logo.svg`, search/cart-badge/locale/auth menu), MobileNav (Sheet drawer, RTL start-side), AuthMenu (role-aware: login/register vs dashboard/logout), LocaleSwitcher (ar↔en preserving path), Footer (rich 4-zone warm peach-soft), RoleGuard (defense-in-depth), EmptyState + LoadingState. Wired via new `(marketing)/layout.tsx`; landing hero refined (premium). New messages (nav/common/footer/home extras). **Awaiting user FEEL review** (premium/spacious/distinctive) before 0.10 PASS. REQ-NFR-03/08 progressed.
- 2026-06-29 — **Task 0.11 — Phase 0 DoD gate (prepared; awaiting Vercel preview).** Gates green: typecheck + lint clean; **24 unit + 9 RLS (opt-in)**; auth E2E 16/16 (user-run). Added `tests/integration/rls.test.ts` (opt-in `RLS_TEST=1`) + SQL-editor RLS block. Phase-0 REQ-IDs set to **Built**: REQ-AUTH-01..06, REQ-NFR-01/02/03/05/07/08/10. Multi-phase reqs kept **In progress + carry-forward** (not "Built"=overclaim, not "Deferred"=implies cut): REQ-PAY-01 (Tap intent → Phase 2), REQ-PAY-06 (admin settings UI → Phase 2), REQ-NOT-01 (email triggers/templates → Phase 5); REQ-NFR-11 deployment In progress (preview). `docs/PHASE_0_ACCEPTANCE.md` produced. **No commit until user confirms preview is green** (then commit+tag the phase). Carry-forwards: Tap webhook-secret confirmation (Phase 2), `/payment/callback` (Phase 2), dark mode + `logo-reversed.svg` (Phase 2), SMS/Twilio (Phase 2), sitemap/hreflang/OG (Phase 6/7).
- 2026-06-29 — **Task 0.9 (Tap sandbox spike) VERIFIED PASS.** User ran `pnpm spike:tap` against live Tap sandbox → charge `chg_TS05A…`, `live_mode:false`, `status:INITIATED`, `transaction.url` returned. Caveat (b) decimals CONFIRMED (sent 1 SAR, echoed amount=1/SAR; SAR/EGP=2dp). Caveat (a): API auth = `TAP_SECRET_KEY` CONFIRMED; webhook hashstring secret DEFERRED to Phase 2 (needs delivered webhook via public post.url; keep account-secret assumption in tap.ts). Findings recorded in `docs/SPIKE_NOTES.md`: (1) shared sandbox merchant 599424 reports KWD — not ours, real merchant/currency comes with our keys; (2) Phase 2 must build `/payment/callback` (redirect.url) + ensure webhook handler at `/api/payments/webhook` (post.url). REQ-PAY-01 progressed.
- 2026-06-29 — Task 0.9 (Tap sandbox spike) built; sandbox gate green (typecheck + lint + 24/24 unit). `TapProvider.createIntent` now makes the real Tap `/v2/charges` call (minor→major via exported `toTapAmount`; raw response on `PaymentIntent.raw`); `scripts/tap-spike.ts` + `scripts/tsconfig.json` (server-only stub alias) + `pnpm spike:tap` run it; offline createIntent unit tests now mock `fetch`. Caveat (b) closed by unit test (SAR/EGP = 2 decimals). Caveat (a): API auth = `TAP_SECRET_KEY` (a dummy key reached Tap → `401 code 2104`, so HTTPS to Tap IS reachable from this env — premise corrected; structurally confirmed); webhook hashstring secret needs a delivered webhook to confirm (docs/SPIKE_NOTES.md). **Awaiting user's keyed `pnpm spike:tap` run** to record the live charge response + close caveat (a). Not Done until then.
- 2026-06-29 — **Task 0.8 VERIFIED PASS** + two marketplace refinements (user review): (1) `CreateIntentInput.destination?: PaymentDestination` added as an **optional** field (own type) so the Tap split-settlement path (REQ-PAY-05) is additive later with no caller breakage — single-merchant now, split = Phase 2; (2) `TapProvider.verifyWebhook` restructured from generic whole-body HMAC to **Tap's `hashstring` scheme** (canonical field string in fixed order → HMAC-SHA256 → timing-safe compare, fail-closed; exported `buildTapHashString`). Two caveats deferred to the 0.9 live spike (well-isolated): which secret keys the hashstring (used `TAP_WEBHOOK_SECRET`), and per-currency amount decimals. Now 21/21 unit (added destination + webhook round-trip/tamper/missing-hash tests).
