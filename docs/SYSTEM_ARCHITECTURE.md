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
- **Route groups** isolate marketing/auth/dashboard layouts.
- **Server Components** for catalog/detail pages (SEO + speed); **Client Components** only where interactive (cart, calendars, forms, lightbox).
- Dashboards are role-segmented routes guarded in `middleware.ts` + layout-level checks.

## 6. Authentication

- **Supabase Auth** (email/password v1). Session managed with `@supabase/ssr` (cookie-based) — `lib/supabase/server.ts` for RSC/handlers, `client.ts` for client components, `middleware.ts` to refresh tokens.
- On signup a `profiles` row is created (trigger) carrying `role`, `provider_type`, `status`.

## 7. Authorization & RBAC

- **Primary: Postgres RLS** — deny-by-default; policies per table keyed on `auth.uid()` and `profiles.role`. Sellers/providers can only read/write rows they own; admin uses **service-role key (server only)** to bypass for ops.
- **Secondary: app guards** — `middleware.ts` blocks dashboard routes by role; server actions re-check via `lib/rbac.ts`. Defense-in-depth (REQ-NFR-03).
- Never expose service-role key to the client. Client always uses anon key + RLS.

## 8. Database

Postgres on Supabase. Schema, enums, indexes, constraints, and migration order in **DATABASE.md**. Money stored as `numeric(10,2)` + `currency`; integrity for availability via `btree_gist` exclusion constraints.

## 9. Storage

Supabase Storage buckets: `avatars` (public), `products` (public), `services` (public), `portfolio` (public read, owner write). Uploads go through a **server route** that validates type/size and enforces ownership, then returns the public URL. Replaces Cloudinary (C3).

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
