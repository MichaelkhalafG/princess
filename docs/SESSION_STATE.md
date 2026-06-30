# SESSION_STATE.md — resume note

> Scratch hand-off so work can resume exactly where it stopped. Last updated: **2026-06-28**.
> Authoritative planning docs: `REQUIREMENTS_MATRIX.md` (the law), `DATABASE.md`, `IMPLEMENTATION_PLAN.md`, `CLAUDE_RULES.md`, `DESIGN_RULES.md`, `ENV_SETUP.md`.

## Where we are
**Phase 0 (Foundation).** Tasks 0.1 → 0.10 done; **0.11 phase-gate prepared** (`docs/PHASE_0_ACCEPTANCE.md`) — gates green, awaiting the user's **Vercel preview** verification. No commit until the user confirms preview is green; then commit + tag `phase-0`.

| Task | What | Status |
|------|------|--------|
| 0.1 | Scaffold (Next 14 + TS strict + Tailwind + shadcn/ui, brand tokens, folder skeleton, PWA baseline) | ✅ Done — typecheck + lint green |
| 0.2 | Supabase clients (`lib/supabase/{client,server,admin}.ts`), `lib/database.types.ts`, `db:types` script, `.env.example` | ✅ Done — typecheck + lint green |
| 0.3 | `supabase/migrations/0001_foundation.sql` (extensions, enums, `profiles`, `handle_new_user` + `set_updated_at` triggers, RLS enabled) | ✅ Done — **applied to live DB & verified** |
| 0.4 | `supabase/migrations/0002_rls_and_settings.sql` (profiles RLS + no-escalation column grants; `platform_settings` + `platform_upfront_fees` + seed; RLS authenticated-read/service-role-write) | ✅ Done — **applied to live DB & verified** |
| 0.5 | i18n + RTL shell (`next-intl` v4, `app/[locale]`, `ar` default + `localeDetection:false`, message catalogs, ThemeProvider+Toaster, localized landing). Root layout deleted so `[locale]/layout` is root (fixes missing-html-tags). | ✅ Done — **verified in browser** (/→/ar Arabic RTL; /en LTR; no root-layout error) |
| 0.6 | Composed `middleware.ts` (intl + Supabase session refresh + `/dashboard/*` role guard from DB) + `lib/rbac.ts` | ✅ Done — **verified in browser** (logged-out → /login; role guard) |
| 0.7 | Auth: routes `register`/`login`/`logout`/`me` (typed envelope, server Zod), `features/auth/*` (schema/queries/mutations/client + components AuthCard/LoginForm/RegisterForm/RoleSelect), role-based redirect, minimal dashboard landings + PendingApprovalBanner. Unit test (schema) + RLS smoke note. **+ Playwright E2E** (config + `tests/e2e/auth.spec.ts`, 16 tests ar/en) to verify auth without hand-testing. | ✅ Done — **verified via Playwright E2E (16/16 passed, ar+en)** + typecheck/lint/unit green |
| 0.8 | Provider abstractions: `lib/payments/{PaymentProvider,tap,stripe,index}` (Tap primary — sandbox-stub createIntent w/ optional `destination` for split→Phase 2; **Tap hashstring** webhook verify, timing-safe + fail-closed; Stripe NotImplemented stub; factory) + `lib/notifications/{NotificationService,resend,sms,index}` (Resend email channel; SMS interface placeholder Phase 2). Secrets env + `server-only`; integer minor units; feature code → interfaces only. Unit test (factory + minor-units guard + webhook round-trip/tamper). | ✅ **PASS** (user-reviewed) — typecheck + lint + 21/21 unit green |
| 0.9 | Tap sandbox spike: `TapProvider.createIntent` now makes the **real** `/v2/charges` call (minor→major `toTapAmount`, raw on `PaymentIntent.raw`); `scripts/tap-spike.ts` + `scripts/tsconfig.json` + `pnpm spike:tap`; createIntent unit tests mock `fetch`; `docs/SPIKE_NOTES.md`. | ✅ **PASS** — verified live (charge `chg_TS05A…`, INITIATED, transaction.url; SAR=2dp confirmed). Caveat (a) webhook secret deferred → Phase 2 |

### Task 0.3 — DoD: FULL PASS
- Migration applied to live project `kukjkkkpyohsykaeealw`. ✅
- Enums + `profiles` match DATABASE.md §3.1 exactly (`user_role` has `provider` not service_provider; `profile_status` includes `rejected`; `currency_code` SAR/EGP). ✅
- Signup trigger sets status per role — **verified live: seller → `pending`, customer → `active`.** ✅
- RLS enabled on `profiles` — **verified live: `relrowsecurity = true`.** ✅
- `lib/database.types.ts` regenerated from the LIVE database (contains `profiles` + 4 enums). ✅
- `pnpm typecheck` + `pnpm lint` green against regenerated types. ✅

REQ-AUTH-01..06 marked **In progress** in the matrix (DB foundation + RLS + session/RBAC middleware live; auth routes/forms still to come in 0.7).

## What's next
**Close Phase 0 (Task 0.11):** see `docs/PHASE_0_ACCEPTANCE.md`. Steps for the user:
1. (Optional re-confirm) `pnpm test:e2e` → 16 passed; `pnpm test rls` (with `RLS_TEST=1` in `.env.local`) → 9 passed.
2. **Vercel PREVIEW deploy** with the env list in PHASE_0_ACCEPTANCE §3.1 (sandbox keys; server-only vars NOT `NEXT_PUBLIC_`); run the §3.4 acceptance checklist on the preview URL.
3. On **green**, confirm → I `git init`, branch, commit (Phase-0 REQ-IDs) + tag `phase-0`. **No commit before that.**

**Then Phase 1 — catalog & storage** (products, filters, detail, seller CRUD, Supabase Storage buckets). Task pack **FINAL**: `docs/Phasses prompt's/PHASE_1_TASKS.md` (8 tasks, `0003_catalog.sql`). Decisions D1–D5 + both defaults **APPROVED** (URL filter state · offset pagination · server `/api/upload` with RLS · in-house typed `DataTable<T>` · tag-based catalog cache). Image limits live in one constant `lib/constants.ts` `PRODUCT_IMAGE_LIMITS` (6→8 = one-line change). **Sequencing: user is closing Phase 0 (Task 0.11) FIRST**, then triggers Task 1.1. Do NOT start Phase 1 until triggered.

**Phase 2 carry-forward from the Tap spike** (`docs/SPIKE_NOTES.md`): confirm the webhook hashstring secret via a delivered sandbox webhook (public `post.url`/ngrok) and align `verifyWebhook` (`TAP_WEBHOOK_SECRET` vs `TAP_SECRET_KEY`); build `/payment/callback` (redirect.url) + webhook handler at `/api/payments/webhook` (post.url); don't assume merchant/currency from the shared sandbox account (599424/KWD) — ours comes with our keys. Then 0.10 (shared primitives Navbar/Footer/LocaleSwitcher/RoleGuard — uses `public/logo.svg`), 0.11 (Phase 0 DoD gate).

**Verifying tasks from here on:** auth (and future flows) are covered by `pnpm test:e2e` (auto-starts `pnpm dev`; green = 16/16, ar+en). Extend `tests/e2e/*` as new flows land rather than hand-testing. E2E users use unique `…@e2e.princess.test` emails; teardown: `delete from auth.users where email like '%@e2e.princess.test';`.

## Standing workflow
Sandbox limits: **cannot reach Postgres** (DNS/5432 egress blocked; only HTTPS) and **cannot run `pnpm dev`** (Google Fonts egress blocked). So:
1. **Claude Code writes** code + migrations (and updates docs/type expectations); runs `pnpm typecheck` + `pnpm lint` as the sandbox gate.
2. **You run from your own terminal:** `pnpm exec supabase db push` + `pnpm db:types` for DB changes, and `pnpm dev` to verify UI/runtime in the browser.
3. **You paste results back** (push/types output, browser verification); Claude reconciles against DATABASE.md / the task DoD before advancing.
- **Secrets rule:** you NEVER paste DB passwords or PATs into chat. (The 0.3 DB password that was shared earlier should still be rotated — see below.) typecheck+lint passing is necessary but NOT sufficient — runtime bugs (e.g. 0.5) only surface in `pnpm dev`.

## ⚠️ Not committed yet
**No git commit has been made.** Uncommitted work spans **Tasks 0.1–0.10** (scaffold, Supabase wiring, migrations 0001+0002 + generated types, i18n/RTL shell, composed middleware, auth routes/forms/dashboards, Vitest + Playwright E2E, payment/notification provider abstractions, Tap spike, shared Navbar/Footer/primitives + marketing shell — `@playwright/test` + `tsx` in `package.json`/lockfile, planning docs). When ready to commit, branch first (repo not initialized yet) and reference the Phase-0 REQ-IDs.

## Brand assets (ready for Task 0.10)
Final logo = **Version C (Rose Jewel)**, confirmed 2026-06-29. Production copies in `public/`: `logo.svg` (horizontal → Navbar), `logo-stacked.svg` (Footer/auth), `icon.svg` (mark), `favicon.svg` (wired in layout `metadata.icons`). Source archive `./logo/` also holds `-reversed` (dark-bg) and `-mono-*` (single-colour) alternates — pull into `public/` when dark mode (Phase 2) / mono use arrives. See memory `brand-logo-assets`.

## Secrets housekeeping
- `.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key value); `SUPABASE_SERVICE_ROLE_KEY` + Tap/Resend still blank.
- The **DB password** was shared in chat during 0.3 — **rotate it** (Dashboard → Project Settings → Database → Reset password) when convenient.

## ⚠️ Pre-launch checklist (carry forward to production)
- **Re-enable Supabase Auth → "Confirm email".** Turned OFF in dev (2026-06-29) so registration returns a session for E2E + smooth dev. App already handles the no-session path (register → "check your email" → login), so re-enabling is safe; do it before production so emails are verified.
- Rotate the 0.3 DB password (above) before launch if not already done.
