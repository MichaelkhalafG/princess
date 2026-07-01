# SYSTEM_ARCHITECTURE.md

> **Project:** Princess — All-in-One Women's Marketplace
> Stack (locked): **Supabase** · **Next.js 14 App Router + TypeScript** · **Tailwind + shadcn/ui** · **Vercel** · **Resend** · **Tap** (payments).

---

## 1. Architecture Overview

A **single Next.js 14 application** (App Router) deployed on Vercel, using **Supabase** as the backend platform (Postgres, Auth, Storage, Realtime, auto REST/Realtime APIs). No separate Express server — all server logic lives in **Route Handlers** (`app/api/**/route.ts`), **Server Components**, and **Server Actions**, plus a few **Supabase Edge Functions** for webhooks/cron.

```
                         ┌─────────────────────────────────────┐
                         │              Vercel                  │
                         │  Next.js 14 (App Router, TS)         │
                         │  ┌───────────────┐ ┌──────────────┐  │
   Browser (RTL/AR) ───▶ │  │ Server Comps  │ │ Route        │  │
   Mobile PWA            │  │ + Actions     │ │ Handlers /api│  │
                         │  └──────┬────────┘ └──────┬───────┘  │
                         └─────────┼──────────────────┼─────────┘
                                   │ @supabase/ssr    │ service role (server only)
                                   ▼                  ▼
                         ┌─────────────────────────────────────┐
                         │             Supabase                 │
                         │  Postgres + RLS │ Auth │ Storage     │
                         │  Realtime       │ Edge Functions     │
                         └───────┬─────────────────┬───────────┘
                                 │                 │
                    ┌────────────▼───┐   ┌─────────▼──────────┐
                    │   Tap Payments │   │   Resend (email)   │
                    │  (webhook→Edge)│   │  Twilio SMS (P2)   │
                    └────────────────┘   └────────────────────┘
```

**Why this shape:** fewer moving parts → fits the deadline; RLS gives security-by-default; Realtime gives live slot blocking for free; Edge Functions isolate untrusted webhook traffic from the app.

---

## 2. Folder Structure (feature-modular)

```
/princess
├── app/
│   ├── [locale]/                      # next-intl routing (ar default, en)
│   │   ├── (marketing)/               # landing, about
│   │   ├── (auth)/login | register
│   │   ├── products/ | [id]/
│   │   ├── rentals/ | [id]/
│   │   ├── services/ | [id]/
│   │   ├── event-planners/ | [id]/
│   │   ├── providers/[id]/            # public provider profile + portfolio
│   │   ├── cart/
│   │   ├── checkout/
│   │   └── dashboard/
│   │       ├── customer/ seller/ provider/ admin/
│   ├── api/                           # Route Handlers (see API_MAP.md)
│   └── layout.tsx                     # sets <html dir lang>
├── components/
│   ├── ui/                            # shadcn primitives
│   ├── shared/                        # Navbar, Footer, LocaleSwitcher, etc.
│   ├── catalog/ rentals/ services/ bookings/
│   ├── portfolio/PortfolioGallery.tsx
│   ├── checkout/ dashboard/
├── features/                          # domain logic per module (pure-ish)
│   ├── auth/ products/ rentals/ services/ bookings/
│   ├── orders/ payments/ event-planners/ portfolio/ reviews/ notifications/
│   │   └── <module>/{queries.ts, mutations.ts, schema.ts, types.ts}
├── lib/
│   ├── supabase/{client.ts, server.ts, middleware.ts, admin.ts}
│   ├── payments/{PaymentProvider.ts, tap.ts, stripe.ts, index.ts}
│   ├── notifications/{NotificationService.ts, resend.ts, sms.ts}
│   ├── storage/{upload.ts, buckets.ts}
│   ├── money.ts  rbac.ts  utils.ts  validation.ts
│   └── database.types.ts              # generated from Supabase
├── messages/{ar.json, en.json}       # i18n strings
├── supabase/
│   ├── migrations/                    # SQL migrations (source of truth)
│   ├── functions/                     # edge fns: payments-webhook, reminders
│   └── seed.sql
├── tests/{unit, integration, e2e}
├── middleware.ts                      # auth + locale + RBAC routing
└── docs/                              # these planning documents
```

**Module contract:** each `features/<module>` exposes typed `queries` (read), `mutations` (write), `schema` (Zod), `types`. UI imports from features; features import from `lib`. No cross-feature imports except via shared types.

---

## 3. Modules

`auth` · `products` · `rentals` · `services` · `bookings` · `cart` · `orders` · `payments` · `event-planners` · `portfolio` · `reviews` · `notifications` · `admin` · `dashboard`. Each maps to matrix sections A–L.

## 4. Shared Components

shadcn/ui primitives (Button, Dialog, Form, Input, Select, Calendar, Card, Table, Tabs, Badge, Toast, Sheet) wrapped in `components/ui`. Cross-feature: `Navbar`, `Footer`, `LocaleSwitcher`, `RoleGuard`, `EmptyState`, `DataTable`, `PriceTag`, `RatingStars`, `ImageUploader`, `DateRangePicker`, `AvailabilityCalendar`, `PortfolioGallery`. (See COMPONENT_TREE.md.)

## 5. Routing

- **Locale-prefixed** (`/ar/...`, `/en/...`) via `next-intl` middleware; `ar` default.
- **Market resolution runs as a parallel layer in `middleware.ts`, separate from locale** (see §19). Locale (`ar`/`en`) governs language/RTL; **market** (`EG`/`SA`) governs currency, catalog visibility, shipping and COD. The two are orthogonal — `{ar,en} × {EG,SA}` = **4 combos** (e.g. an Egyptian shopping in English = `en` + `EG`/`EGP`).
- **Route groups** isolate marketing/auth/dashboard layouts.
- **Server Components** for catalog/detail pages (SEO + speed); **Client Components** only where interactive (cart, calendars, forms, lightbox).
- Dashboards are role-segmented routes guarded in `middleware.ts` + layout-level checks (capability-based since CR-01 — see §7).

## 6. Authentication

- **Supabase Auth** (email/password v1). Session managed with `@supabase/ssr` (cookie-based) — `lib/supabase/server.ts` for RSC/handlers, `client.ts` for client components, `middleware.ts` to refresh tokens.
- On signup a `profiles` row is created (trigger) carrying `role`, `provider_type`, `status`.

## 7. Authorization & RBAC

- **Primary: Postgres RLS** — deny-by-default; policies per table keyed on `auth.uid()` and `profiles.role`. Sellers/providers can only read/write rows they own; admin uses **service-role key (server only)** to bypass for ops.
- **Secondary: app guards** — `middleware.ts` blocks dashboard routes by role; server actions re-check via `lib/rbac.ts`. Defense-in-depth (REQ-NFR-03).
- Never expose service-role key to the client. Client always uses anon key + RLS.
- **Multi-role capability model (CR-01, Q-C1).** Authorization moves from **`profiles.role ==`** checks to **capability derived from approved `vendor_applications`**: "can sell" = an approved (`status='active'`) application with `role='seller'`; "can offer services" = one with `role='provider'`. `profiles.role` becomes a **primary/display** hint and no longer gates capability, so **one user can be BOTH seller and provider and reach both dashboards**. `middleware.ts` + `lib/rbac.ts` change from *"role =="* to *"has capability"*; owner RLS/guards key off the relevant capability. This is a **contained-but-pervasive rewrite** (touches middleware, `lib/rbac.ts`, dashboard routing and every owner guard) — scheduled in **Phase 1.6** with focused RLS/guard tests.

## 8. Database

Postgres on Supabase. Schema, enums, indexes, constraints, and migration order in **DATABASE.md**. Money stored as `numeric(10,2)` + `currency`; integrity for availability via `btree_gist` exclusion constraints.

## 9. Storage

Supabase Storage buckets: `avatars` (public), `products` (public), `services` (public), `portfolio` (public read, owner write). Uploads go through a **server route** that validates type/size and enforces ownership, then returns the public URL. Replaces Cloudinary (C3).

**First private bucket — `verification-docs` (`public: false`, CR-01 / Phase 1.6).** For KYC identity documents. Storage RLS: **owner writes** under `{uid}/…` and **reads own**; **NO public read**; **admin reads via short-lived signed URLs only** (service-role generated). Contrast with the four public buckets above — this is net-new infra: `lib/storage/buckets.ts` (`STORAGE_BUCKETS`) gains a **`public: false`** flag on this entry, and `POST /api/upload` gains a **private path** that returns the storage *path* (not a public URL). PII (doc numbers, legal name) never leaks to public read; a retention/secrecy policy applies (REQ-NFR-05).

## 10. Realtime

Supabase Realtime channels for: **availability/slot blocking** (bookings, rentals) and **dashboard live updates** (incoming bookings/requests, COD confirmations). Subscriptions scoped by RLS.

## 11. Caching

- Next.js **RSC + fetch cache / `revalidateTag`** for catalog reads; **ISR** for public detail pages.
- `unstable_cache` for commission/settings lookups.
- Tag-based invalidation on mutations (`revalidateTag('products')`, etc.).
- CDN via Vercel edge for static + Supabase Storage public assets.

## 12. Validation

**Zod** schemas in each `features/<module>/schema.ts`, shared between client form validation and server route validation. No request is trusted without server-side Zod parse. DB constraints are the final backstop.

## 13. API Strategy

- **Route Handlers** under `app/api/**` follow the client's endpoint contract (see API_MAP.md) for explicit operations (payments, webhooks, status changes, admin actions).
- **Server Actions** for simple form mutations (cart, profile, portfolio updates) to cut boilerplate.
- **Direct Supabase reads** in Server Components for catalog/listing (RLS-protected).
- Consistent JSON envelope: `{ data } | { error: { code, message, details? } }`.

## 14. State Management

- Server state via **RSC + React Query (TanStack)** on the client for interactive lists/dashboards.
- UI/local state via React hooks; minimal global state (`zustand` only for cart if needed).
- Forms via **react-hook-form + Zod resolver**.

## 15. Error Handling

- App: `error.tsx` + `not-found.tsx` per route segment; toast for recoverable errors.
- API: typed error envelope with stable `code`s (see API_MAP §Error Codes).
- Payments/webhooks: never trust client; verify signature, log to `payments` + idempotency table, fail closed.
- Central `lib/errors.ts` with `AppError` classes mapped to HTTP codes.

## 16. Logging & Observability

- Vercel logs + structured server logs (`pino`-style) with request IDs.
- Payment + COD events written to an **audit log** table.
- Sentry (or Vercel monitoring) for error tracking (Phase 2 if time-constrained).

## 17. Deployment

- **Vercel** for the Next.js app (preview per PR, production on `main`).
- **Supabase** project (db migrations applied via `supabase db push` in CI).
- **Edge Functions** deployed via `supabase functions deploy` (payments webhook, reminders cron).
- Secrets in Vercel/Supabase env (never in repo): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TAP_SECRET_KEY`, `TAP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`. (Twilio keys Phase 2.)
- CI: lint + typecheck + unit/integration tests gate every PR; E2E on preview.

---

## 18. Cross-cutting principles

Strong TypeScript everywhere · feature-module isolation · RLS-first security · provider abstractions for payments/notifications/storage · Arabic-first RTL · money as integers in logic · reuse-first (see CLAUDE_RULES.md).

---

## 19. Markets & Market Resolution (CR-01)

Markets (`EG`, `SA`) are **independent regional storefronts** — self-contained currency, shipping and COD, no FX or cross-border. Market is a **parallel resolution layer to locale** (§5), never the same axis.

- **Resolution order in `middleware.ts`:** cookie `market` → `profiles.market` → (first visit) show a **MarketChooser** gate. The Vercel `request.geo.country` value is used **only to pre-highlight the likely choice** — it is **never auto-committed**. The chosen value is written to the `market` cookie and (if logged in) to `profiles.market`, and can be changed any time via the **MarketSwitcher** (a sibling to `LocaleSwitcher`, §4).
- **`lib/markets.ts` (new)** holds the fixed market→currency map (`EG→EGP`, `SA→SAR`); currency is **derived, never entered twice**.
- **Cross-market catalog filtering lives in the query layer (`features/catalog/queries.ts`), NOT in RLS.** RLS cannot read the request cookie, so it keeps enforcing *"is this product public?"* (`status='active'`); the query layer adds *"is it in **your** market?"* via an inner join to `product_prices` on the active market. A product without a price row for the active market is invisible (404 on detail).
- **⚠ Market-leak risk:** any read path that forgets the market join could leak cross-market products. **Mitigation:** centralize all catalog reads in `features/catalog/queries.ts` and add a **market-isolation integration test** asserting EG never sees SA-only products and vice-versa.

## 20. Payments, Escrow & Settlement Ledger (CR-01 §H, Phase 2)

Funds are **HELD, not paid to the vendor on purchase** ("Amazon principle"): captured on payment (online) or on COD collection → `held` → released to the vendor on **acceptance** (customer taps "received & satisfied") **or auto-release** on window expiry. Disputes freeze funds pending admin resolution.

- **The `settlements` ledger + `vendor_balances` view are the single source of truth** for what is held / available / paid; UI and admin never recompute money — they display system-computed numbers. Two ledger entry types model the netting: `sale_payable` (online — platform owes vendor net) and `cod_commission` (COD — vendor owes platform its commission). NET payable = online `available` net − outstanding COD-commission debt.
- **Pluggable `PayoutProvider` abstraction (`lib/payouts/{PayoutProvider,manual,tapMarketplace,index}.ts`)** mirrors the existing `lib/payments` `PaymentProvider`. **`ManualPayoutProvider` now** (admin views the computed NET, transfers via bank outside the system, clicks **"Mark as paid"**); **`TapMarketplacePayoutProvider` later**. **Swapping the provider does NOT change the ledger math** — `settlements` + `vendor_balances` stay authoritative.
- **Launch uses a SINGLE Tap merchant account for collection (NOT Tap Marketplace).** This removes the Tap Marketplace launch blocker: Marketplace payout becomes a *later automation* (provider swap), not a launch gate. **Tap refunds** (for online dispute resolution) remain in Phase-2 scope.

## 21. Scheduled Jobs (CR-01)

The **auto-release sweep is the first scheduled job in the stack** (§10/§17 already anticipate edge fns/cron). Implemented as a **Supabase scheduled Edge Function / `pg_cron`** job that moves settlements `held → available` (`available_reason='auto_release'`) for orders where `now() >= auto_release_at` **and** no open dispute exists. Runs server-side with service-role; never client-triggered.

## 22. Legal & Compliance (CR-01 §H.8)

**⚖ For launch the platform holds third-party funds in its own Tap merchant account** until manual payout to vendors. Holding/transmitting third-party money can carry **regulatory/licensing implications in Egypt and Saudi Arabia** (e-money / payment-intermediary / escrow rules) — *this is not legal advice; the client must verify the EG/SA regulatory position* and whether terms-of-service + vendor agreements must disclose the hold-and-release model (a go-live checklist item alongside the KYC/legal-entity note, REQ-NFR-11). Every payout is **admin-only, service-role-gated, and written to `audit_log`** (who / when / how-much / reference); there is no vendor-writable path to payout state and no self-payout.

---

## Changelog — CR-01 reconciliation (2026-07-01)

- **§5 Routing:** documented the parallel **market** resolution layer (separate from locale) and the `{ar,en}×{EG,SA}` = 4-combo matrix; noted capability-based dashboard guards.
- **§7 Authorization & RBAC:** added the **multi-role capability model** (Q-C1) — authorization moves from `profiles.role ==` to *has capability* derived from approved `vendor_applications`; `middleware.ts` + `lib/rbac.ts` rewrite flagged as a contained-but-pervasive Phase 1.6 change; a both-role user reaches both dashboards.
- **§9 Storage:** added the first **private bucket `verification-docs`** (`public:false`, owner-write/read-own, no public read, admin via short-lived signed URLs); `lib/storage/buckets.ts` gains a `public:false` flag and `POST /api/upload` gains a private path.
- **§19 (new) Markets & Market Resolution:** cookie→`profiles.market`→first-visit MarketChooser order (geo is a hint only), `lib/markets.ts` fixed EG→EGP/SA→SAR map, MarketSwitcher sibling to LocaleSwitcher, and the query-layer (not RLS) cross-market filter with the market-leak risk + mitigation.
- **§20 (new) Payments, Escrow & Settlement Ledger:** escrow hold→available→paid design, `settlements`+`vendor_balances` as single source of truth, pluggable `PayoutProvider` (manual now / Tap Marketplace later), single-Tap-merchant collection removing the Marketplace launch blocker.
- **§21 (new) Scheduled Jobs:** the first scheduled job — the auto-release sweep (Supabase scheduled Edge Function / `pg_cron`).
- **§22 (new) Legal & Compliance:** flagged the platform holding third-party funds (EG/SA regulatory implications, client to verify) and admin-only, audit-logged payouts.
