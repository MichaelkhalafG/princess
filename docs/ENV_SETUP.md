# ENV_SETUP.md

> **Project:** Princess — environment, secrets & provisioning playbook.
> Locked stack: **Supabase · Next.js 14 + TS · Tailwind + shadcn · Vercel · Resend · Tap**.
> Companion: `SYSTEM_ARCHITECTURE.md §17`, `CLAUDE_RULES.md §5` (security), `PHASE_0_TASKS.md` (Task 0.2 / 0.9 / 0.11).

---

## 1. Environment variables

### 1.1 Client-safe (`NEXT_PUBLIC_*`) — shipped to the browser

| Var | Purpose | Example |
|-----|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | `https://abcd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (RLS-protected, safe in browser) | `eyJ...` |
| `NEXT_PUBLIC_APP_URL` | App base URL (redirects, webhooks, emails) | `http://localhost:3000` |
| `NEXT_PUBLIC_TAP_PUBLISHABLE_KEY` | Tap publishable key (client tokenization) | `pk_test_...` |

> Only these four are ever exposed to the client. Anything here is **public** — never put a secret behind `NEXT_PUBLIC_`.

### 1.2 Server-only — NEVER shipped to the browser

| Var | Purpose |
|-----|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses RLS** — server only (admin ops, webhooks, settlement). |
| `TAP_SECRET_KEY` | Tap secret (create charges/intents server-side). |
| `TAP_WEBHOOK_SECRET` | Verify Tap webhook signatures (REQ-PAY-02). |
| `RESEND_API_KEY` | Send transactional email (REQ-NOT-01). |
| `RESEND_FROM_EMAIL` | Verified sender, e.g. `Princess <no-reply@yourdomain.com>`. |

> ### ⛔ HARD RULE (CLAUDE_RULES §5)
> Server-only vars must **never** be referenced in any `'use client'` component, nor prefixed with `NEXT_PUBLIC_`. The service-role key bypasses all RLS — leaking it compromises the entire database. It is only used in `lib/supabase/admin.ts` (guarded with `import 'server-only'`) and server-side payment/webhook/settlement code.

### 1.3 Phase 2 (do NOT wire yet)

| Var | When |
|-----|------|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | SMS — Phase 2 (REQ-NOT-02, C5) |
| `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe — deferred international gateway (REQ-PAY-07) |

---

## 2. ⚠️ Variables from the client reference `.env` that we DO NOT use

The client's reference `.env` (Prisma/next-auth/Cloudinary stack) lists variables that are **wrong for the locked stack**. Do not wire these — they will silently mislead implementation.

| Dropped var | Why dropped | Replaced by |
|-------------|-------------|-------------|
| `DATABASE_URL` (Prisma/`postgresql://...`) | No Prisma (C1) | Supabase project + migrations (`supabase` CLI) |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | No Cloudinary (C3) | Supabase Storage buckets |
| `SENDGRID_API_KEY` | Not the chosen email provider (C5) | `RESEND_API_KEY` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | SMS is Phase 2 (C5) | (later) Twilio via `NotificationService` |
| `STRIPE_SECRET_KEY` (as primary) | Tap is primary for SA/EG (REQ-PAY-07) | `TAP_SECRET_KEY` (Stripe deferred) |
| next-auth secrets (`NEXTAUTH_*`) | No next-auth (C2) | Supabase Auth (`@supabase/ssr`) |

> If you see any of the above wired into the app, it is a mistake — remove it and use the replacement.

---

## 3. Provisioning playbook (step-by-step)

### 3.1 Supabase
1. Create a project at supabase.com → note the **Project URL** and the **anon** + **service_role** keys (Project Settings → API).
2. Install CLI: `npm i -g supabase` (or `pnpm dlx supabase`).
3. `supabase login`, then **link**: `supabase link --project-ref <ref>`.
4. Push migrations: `supabase db push` (applies `supabase/migrations/0001…0007`).
5. Generate types: `pnpm db:types` → writes `lib/database.types.ts` (script: `supabase gen types typescript --linked > lib/database.types.ts`).
6. Create Storage buckets (dashboard or migration): `avatars`, `products`, `services`, `portfolio` (public read; owner write via Storage policies — see DATABASE.md §7).

### 3.2 Tap Payments (SANDBOX) — ⏰ start this FIRST (lead-time risk)
> PROJECT_ANALYSIS §8/§9 flags Tap sandbox provisioning as a schedule risk. Request access on Day 0.
1. Create a Tap merchant account → enable **test/sandbox** mode.
2. Get **sandbox** keys: publishable (`pk_test_…` → `NEXT_PUBLIC_TAP_PUBLISHABLE_KEY`) and secret (`sk_test_…` → `TAP_SECRET_KEY`).
3. Configure a **webhook endpoint** → `${NEXT_PUBLIC_APP_URL}/api/payments/webhook`; copy the signing secret → `TAP_WEBHOOK_SECRET`.
4. Confirm currencies enabled: **SAR** and **EGP** (mada coverage for SA).
5. Validate with the Task 0.9 spike (create-intent round-trip) before Phase 2.

### 3.3 Resend (email)
1. Create a Resend account → generate an API key → `RESEND_API_KEY`.
2. Verify a sending **domain/sender** → set `RESEND_FROM_EMAIL` (e.g. `Princess <no-reply@yourdomain.com>`). Unverified senders are rejected.

### 3.4 Vercel
1. Import the repo → framework auto-detected (Next.js).
2. Add **all** env vars under Project → Settings → Environment Variables:
   - Scope **client-safe + server-only** to **Production** and **Preview** (use sandbox/test keys for Preview).
   - Keep production secrets (live Tap keys) out of Preview.
3. Preview deploys per PR; Production on `main`.
4. Set `NEXT_PUBLIC_APP_URL` per environment (preview URL vs prod domain) and update the Tap webhook URL to match the environment under test.

---

## 4. Pre-flight checklist (run BEFORE Phase 0 Task 0.1)

- [ ] Supabase project created; **URL + anon + service_role** keys captured.
- [ ] Supabase CLI installed, `login` + `link` working.
- [ ] **Tap sandbox access requested/approved** (start early — lead-time risk); `pk_test`/`sk_test` + webhook secret in hand.
- [ ] Tap sandbox has **SAR + EGP** enabled.
- [ ] Resend account + **verified sender** + API key.
- [ ] Vercel project created and repo imported.
- [ ] `.env.local` filled from `.env.example` (see §5); no secret committed.
- [ ] Confirm `.env.local` is in `.gitignore`.
- [ ] Decide Preview vs Prod key sets (sandbox for Preview).

> If Tap sandbox is not ready by Day 1, Phase 0 still proceeds: the `PaymentProvider` abstraction (Task 0.8) lets the Tap call be stubbed; only the Task 0.9 spike blocks until keys arrive.

---

## 5. Local dev — `.env.local`

Copy `.env.example` → `.env.local` and fill. `.env.local` is git-ignored; `.env.example` (committed) lists keys with **no values**.

```dotenv
# ---- Client-safe (browser) ----
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_TAP_PUBLISHABLE_KEY=

# ---- Server-only (NEVER expose to browser) ----
SUPABASE_SERVICE_ROLE_KEY=
TAP_SECRET_KEY=
TAP_WEBHOOK_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL="Princess <no-reply@example.com>"

# ---- Phase 2 (leave blank for now) ----
# TWILIO_ACCOUNT_SID=
# TWILIO_AUTH_TOKEN=
# TWILIO_FROM=
# STRIPE_SECRET_KEY=
# NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### 5.1 Which vars each phase needs

| Phase | Needs |
|-------|-------|
| 0 (foundation) | Supabase (URL/anon/service_role), `NEXT_PUBLIC_APP_URL`; Tap sandbox keys for Task 0.9 spike; Resend key for provider wiring |
| 1 (catalog/storage) | Supabase + Storage buckets |
| 2 (commerce/payments) | **All Tap vars** (`pk`, `sk`, webhook secret) + service-role for webhook/settlement |
| 3 (rentals) | Supabase + Tap (booking fee) |
| 4 (services/bookings) | Supabase + Tap + Storage |
| 5 (planners/portfolio/reviews/notifications) | Supabase + Storage + **Resend** (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) |
| 6 (testing) | Sandbox keys; never live payments/emails without explicit go-ahead (CLAUDE_RULES §12) |
| 7 (deploy) | Production Supabase + **live** Tap + Resend on Vercel Production |

---

## 6. Security recap (CLAUDE_RULES §5)

- Secrets in env only — never committed, never logged.
- Service-role key: `lib/supabase/admin.ts` (`import 'server-only'`) — never a client component.
- Browser uses **anon key + RLS** exclusively.
- Webhook (`/api/payments/webhook`): verify `TAP_WEBHOOK_SECRET` signature, enforce idempotency, fail closed (REQ-PAY-02).
- Rotate any key that is ever printed or shared.
