# PHASE_0_ACCEPTANCE.md — Foundation & Spike

> Phase-0 Definition-of-Done gate (IMPLEMENTATION_PLAN Phase 0; CLAUDE_RULES §0/§11/§12).
> Tasks 0.1–0.10 are individually verified; this is the **phase gate**. Sandbox-side
> work is prepared here; **live steps are run by the user** (DB/dev/deploy egress is
> blocked in the build sandbox). **No commit/tag until the user confirms the preview is green.**

---

## 1. Gate results (sandbox — green)

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `pnpm typecheck` | ✅ clean (no output) |
| Lint | `pnpm lint` | ✅ `No ESLint warnings or errors` |
| Unit | `pnpm test` | ✅ **24 passed**, 9 skipped (RLS opt-in) |

Unit coverage: auth schema validation (10), payment/notification providers + Tap
amount conversion + webhook hashstring round-trip/tamper/missing (14).

---

## 2. Tests for the gate (user runs the live ones)

### 2.1 Auth unit — already green
`pnpm test` → `Test Files 2 passed`, `Tests 24 passed | 9 skipped`.

### 2.2 Auth E2E (Playwright) — user runs
```bash
pnpm exec playwright install chromium   # one-time
pnpm test:e2e
```
**Green = `16 passed`** (8 specs × ar/en): customer register → dashboard (no banner);
seller & provider → pending banner; login ok; wrong password → error & not signed in;
duplicate email → EMAIL_TAKEN; `/ar` RTL + Arabic copy / `/en` LTR; no console errors.
Prereq: Supabase Auth **"Confirm email" OFF**. (Already passed 16/16 in Task 0.7.)

### 2.3 RLS smoke — two ways, user runs

**(a) Automated** (`tests/integration/rls.test.ts`, opt-in so CI/sandbox never hits the DB):
```bash
# add RLS_TEST=1 to .env.local (Supabase URL + anon key already there), then:
pnpm test rls
```
**Green = 9 passed:** anon cannot read `profiles`/`platform_settings`; signUp returns a
session (customer→active); authenticated reads only own row; `platform_settings` readable;
`full_name` update allowed; **role/status updates DENIED** (escalation blocked); role/status
unchanged after. Teardown: `delete from auth.users where email like '%@rls-test.princess.test';`

**(b) Supabase SQL editor** — role-impersonation block in
`tests/integration/auth.rls-smoke.md §6` (expected results inline: anon → 0 rows;
authenticated → 1 own row + settings readable; `role`/`status` update → `ERROR 42501`).

---

## 3. Vercel PREVIEW deploy (user runs; prepared here)

> **PREVIEW ONLY** — do not configure Production, real payments, or real emails
> (CLAUDE_RULES §12). Use **sandbox/test** keys for Preview.

### 3.1 Environment variables

**Client-safe — `NEXT_PUBLIC_*` (shipped to browser):**
| Var | Value (preview) |
|-----|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kukjkkkpyohsykaeealw.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/publishable key |
| `NEXT_PUBLIC_APP_URL` | the Vercel **preview URL** (set after first deploy, then redeploy) |

**Server-only — NEVER prefixed `NEXT_PUBLIC_`, never in a client component:**
| Var | Notes |
|-----|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | bypasses RLS — server only |
| `TAP_SECRET_KEY` | Tap **sandbox** `sk_test_…` |
| `TAP_WEBHOOK_SECRET` | Tap webhook secret (sandbox) |
| `RESEND_API_KEY` | Resend key (no real sends triggered in Phase 0) |

Optional (present but unused in Phase 0): `RESEND_FROM_EMAIL`, `NEXT_PUBLIC_TAP_PUBLISHABLE_KEY`.
Do **not** set Twilio/Stripe (Phase 2). Scope all the above to **Preview** (and Production later, Phase 7).

### 3.2 Build config
**No `vercel.json` needed.** Vercel auto-detects Next.js 14 and pnpm (via `pnpm-lock.yaml`);
build = `next build`, install = `pnpm install`. pnpm-11 build-script approvals are already
handled by `pnpm-workspace.yaml` (`allowBuilds`: esbuild, unrs-resolver, supabase). The
favicon/logo are static in `public/`.

### 3.3 Deploy steps
1. Vercel → **Add New Project** → import the repo (framework auto-detected: Next.js).
2. **Settings → Environment Variables** → add all of §3.1 scoped to **Preview** (sandbox keys).
3. Trigger a **Preview** deploy (push a branch / open a PR, or "Deploy" in the dashboard).
4. Copy the preview URL → set `NEXT_PUBLIC_APP_URL` to it → **redeploy** (so redirect/app-URL is correct).

### 3.4 Preview acceptance checklist (verify on the preview URL)
- [ ] `/` → redirects to `/ar`; **`/ar` renders RTL + Arabic** copy; favicon (Rose-Jewel) + logo show.
- [ ] `/en` renders **LTR** English; locale switch `/ar ↔ /en` preserves path.
- [ ] **Register** (customer) → lands on `/ar/dashboard/customer`; seller/provider → pending banner.
- [ ] **Login** → role redirect; **wrong password** → Arabic error, not signed in.
- [ ] **Logged-out** `/ar/dashboard/customer` → redirects to `/ar/login` (middleware).
- [ ] Navbar scroll firm-up, Footer renders; mobile drawer opens (< lg).

> (Tap charge/webhook + emails are NOT exercised in Phase 0 — Phase 2/5.)

---

## 4. Migrations & generated types
- `supabase/migrations/0001_foundation.sql` + `0002_rls_and_settings.sql` — **pushed & live-verified** (Tasks 0.3/0.4).
- `lib/database.types.ts` — regenerated from the **live** DB (contains `profiles`, `platform_settings`,
  `platform_upfront_fees` + enums). Will be included in the Phase-0 commit (nothing committed yet).
- No new migration in 0.11. To re-confirm live: `pnpm exec supabase db push` (no-op if applied) + `pnpm db:types` (clean diff).

---

## 5. What's Built vs Carried-forward

**Built in Phase 0** (Phase-0 scope complete): REQ-AUTH-01..06, REQ-NFR-01, -02, -03, -05, -07, -08, -10, REQ-PAY-07.

**Carried forward** (foundation built in Phase 0; feature lands in target phase — *not* cut):
| REQ | Done in Phase 0 | Remaining | Target |
|-----|-----------------|-----------|--------|
| REQ-PAY-01 | Tap `createIntent` real call + sandbox spike verified | checkout intent + `payments` persistence | Phase 2 |
| REQ-PAY-06 | `platform_settings`/`platform_upfront_fees` live + seeded | admin settings UI/API | Phase 2 |
| REQ-NOT-01 | `NotificationService` + `ResendEmailChannel` scaffolded | triggers + localized templates | Phase 5 |
| REQ-NFR-11 | Supabase live; preview prepared | production deploy | Phase 7 |

> **Status-vocabulary note (per CLAUDE_RULES §3 — surfaced, not silent):** multi-phase
> requirements are kept **In progress + carry-forward** rather than forced to "Built"
> (would overclaim) or "Deferred" (implies cut). They are on schedule for their phases.

**Tip-of-spear carry-forwards (also in SESSION_STATE):** Tap webhook-secret confirmation
via a delivered sandbox webhook (Phase 2); `/payment/callback` page + `/api/payments/webhook`
handler (Phase 2); dark mode using `public/logo-reversed.svg` (Phase 2); SMS/Twilio (Phase 2);
sitemap/hreflang/OpenGraph (Phase 6/7); per-table RLS + full-flow/COD E2E (Phase 6).

---

## 6. Conflicts / findings surfaced during Phase 0
- **C-stack conflicts** resolved earlier (no Prisma/next-auth/Cloudinary/SendGrid/Stripe-primary) — held throughout.
- **Sandbox egress premise corrected (0.9):** this environment *can* reach `api.tap.company`
  over HTTPS (a dummy key returned Tap `401 code 2104`). DB (Postgres/5432) and `pnpm dev`
  (Google-Fonts) remain unreachable — so live DB/dev/deploy stay user-run.
- **Tap shared sandbox merchant** (id 599424) reports **KWD** — that's Tap's public test
  account, not ours; real merchant/currency arrive with our own/Marketplace keys (Phase 2).
- **Marketplace split:** `CreateIntentInput.destination?` reserved (optional) so the Tap
  split-settlement path is additive in Phase 2 with no caller changes.

---

## 7. Production checklist (discovered during Phase 0 — for Phase 7)
- [ ] **Re-enable Supabase Auth "Confirm email"** (turned OFF in dev for E2E; app already handles the no-session path).
- [ ] **Tap:** switch sandbox → **live/Marketplace keys**; complete **per-vendor KYC / connected accounts**; confirm the **webhook hashstring secret** (account secret vs a webhook secret) and align `TapProvider.verifyWebhook`; set the live webhook `post.url`.
- [ ] **Rotate any dev secret ever shared** — notably the **0.3 DB password** shared in chat.
- [ ] Production env on Vercel (live Supabase + live Tap + verified Resend sender); `NEXT_PUBLIC_APP_URL` = prod domain.
- [ ] Re-run E2E + RLS against production config; full-flow/COD E2E (Phase 6) green first.

---

## 8. Commit/tag plan (ONLY after user confirms preview green)
- Branch first (repo not yet initialized) — `git init`, branch e.g. `phase-0-foundation`.
- One commit referencing Phase-0 REQ-IDs:
  `chore(foundation): scaffold next14+supabase, auth, rbac, i18n, providers, tap spike, shared UI`
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Tag `phase-0`. `.env.local` stays git-ignored; verify no secret is staged.
