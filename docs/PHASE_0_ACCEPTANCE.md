# PHASE_0_ACCEPTANCE.md — Foundation & Spike

> ## ✅ PHASE 0 — COMPLETE (gate PASSED 2026-06-30)
> All Phase-0 DoD met (IMPLEMENTATION_PLAN Phase 0; CLAUDE_RULES §0/§11/§12). Tasks
> 0.1–0.11 done & verified. **Live verification passed** by the user: typecheck +
> lint clean, E2E **16/16**, RLS smoke confirmed, and a **green deploy at
> `princess-woad.vercel.app`** with all 7 acceptance checks passing.
> Remaining git **commit + tag `phase-0`** are being handled by the user.

---

## 1. Gate results — green ✅

| Gate | Command | Result |
|------|---------|--------|
| Typecheck | `pnpm typecheck` | ✅ clean (no output) |
| Lint | `pnpm lint` | ✅ `No ESLint warnings or errors` |
| Unit | `pnpm test` | ✅ **24 passed**, 9 skipped (RLS opt-in) |
| E2E | `pnpm test:e2e` | ✅ **16/16** (ar + en) — user-run |
| RLS smoke | SQL editor + `rls.test.ts` | ✅ own-row read only · settings/fees readable · role+status escalation DENIED · full_name update allowed — user-run |
| Deploy | Vercel | ✅ green at **`princess-woad.vercel.app`**; 7/7 acceptance checks pass — user-run |

Unit coverage: auth schema validation (10), payment/notification providers + Tap
amount conversion + webhook hashstring round-trip/tamper/missing (14).

**Live acceptance (7/7 on `princess-woad.vercel.app`):** `/ar` RTL + `/en` LTR · navbar
(no dark bar, gold hairline, frosted scroll) · Atelier-line auth mirrored per dir ·
register → dashboard · seller/provider pending banner · login role-redirect ·
wrong-password toast visible · logged-out dashboard → login.

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

## 5. Final reconciliation — Built / Deferred

**Built in Phase 0** (Phase-0 scope complete & live-verified): REQ-AUTH-01..06,
REQ-NFR-01, -02, -03, -05, -07, -08, -10, **-11** (deploy green), REQ-PAY-06
(config live & RLS-tested; admin UI = Phase 2), REQ-PAY-07.

**Deferred** (foundation built in Phase 0; feature scheduled for its phase — *not* cut):
| REQ | Done in Phase 0 | Remaining | Deferred to |
|-----|-----------------|-----------|-------------|
| REQ-PAY-01 | Tap `createIntent` real call + sandbox spike verified (0.9) | checkout intent + `payments` persistence | Phase 2 |
| REQ-NOT-01 | `NotificationService` + `ResendEmailChannel` scaffolded (0.8) | triggers + localized templates | Phase 5 |

> At the gate these two are marked **Deferred (with reason + target phase)** in the
> matrix — the binary the gate requires — explicitly *not cut*: the Phase-0 groundwork
> is done and the feature is on schedule for its phase (CLAUDE_RULES §3 — surfaced, not silent).

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

> ⚠️ **The Phase-0 deploy shipped to Vercel PRODUCTION (from `main`) with sandbox/
> placeholder keys** (`princess-woad.vercel.app`). That's fine for now — it's a
> foundation preview in all but name; **no real payments or emails are wired**. A
> real production launch still waits for **Phase 7** and the items below. Do not
> treat the current prod URL as launch-ready.

- [ ] **Re-enable Supabase Auth "Confirm email"** (turned OFF in dev for E2E; app already handles the no-session path).
- [ ] **Tap:** switch sandbox → **live/Marketplace keys**; complete **per-vendor KYC / connected accounts** + **legal entity**; confirm the **webhook hashstring secret** (account secret vs a webhook secret) and align `TapProvider.verifyWebhook`; set the live webhook `post.url`.
- [ ] **Replace placeholder secrets** currently set on the deploy: `TAP_SECRET_KEY`, **`TAP_WEBHOOK_SECRET`**, **`RESEND_API_KEY`** (placeholders) → real values; `SUPABASE_SERVICE_ROLE_KEY` for the prod project.
- [ ] **Rotate any dev secret ever shared** — notably the **0.3 DB password** shared in chat.
- [ ] Verify a **verified Resend sender** (`RESEND_FROM_EMAIL`) before any real send; set `NEXT_PUBLIC_APP_URL` = prod domain.
- [ ] Re-run E2E + RLS against production config; full-flow/COD E2E (Phase 6) green first.

---

## 8. Commit/tag plan (gate PASSED — user is handling git)
- Suggested commit referencing Phase-0 REQ-IDs:
  `chore(foundation): scaffold next14+supabase, auth, rbac, i18n, providers, tap spike, shared UI`
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Tag `phase-0`. `.env.local` stays git-ignored; verify no secret is staged.
- **Status: the user is performing the commit + tag.** Phase 0 is otherwise COMPLETE.
