# SESSION_STATE.md — resume note

> Scratch hand-off so work can resume exactly where it stopped. Last updated: **2026-06-28**.
> Authoritative planning docs: `REQUIREMENTS_MATRIX.md` (the law), `DATABASE.md`, `IMPLEMENTATION_PLAN.md`, `CLAUDE_RULES.md`, `DESIGN_RULES.md`, `ENV_SETUP.md`.

## Where we are
**Phase 0 (Foundation).** Tasks 0.1 → 0.7 complete & verified (0.7 verified by Playwright E2E, 16/16 green). Next: Task 0.8 (on trigger).

| Task | What | Status |
|------|------|--------|
| 0.1 | Scaffold (Next 14 + TS strict + Tailwind + shadcn/ui, brand tokens, folder skeleton, PWA baseline) | ✅ Done — typecheck + lint green |
| 0.2 | Supabase clients (`lib/supabase/{client,server,admin}.ts`), `lib/database.types.ts`, `db:types` script, `.env.example` | ✅ Done — typecheck + lint green |
| 0.3 | `supabase/migrations/0001_foundation.sql` (extensions, enums, `profiles`, `handle_new_user` + `set_updated_at` triggers, RLS enabled) | ✅ Done — **applied to live DB & verified** |
| 0.4 | `supabase/migrations/0002_rls_and_settings.sql` (profiles RLS + no-escalation column grants; `platform_settings` + `platform_upfront_fees` + seed; RLS authenticated-read/service-role-write) | ✅ Done — **applied to live DB & verified** |
| 0.5 | i18n + RTL shell (`next-intl` v4, `app/[locale]`, `ar` default + `localeDetection:false`, message catalogs, ThemeProvider+Toaster, localized landing). Root layout deleted so `[locale]/layout` is root (fixes missing-html-tags). | ✅ Done — **verified in browser** (/→/ar Arabic RTL; /en LTR; no root-layout error) |
| 0.6 | Composed `middleware.ts` (intl + Supabase session refresh + `/dashboard/*` role guard from DB) + `lib/rbac.ts` | ✅ Done — **verified in browser** (logged-out → /login; role guard) |
| 0.7 | Auth: routes `register`/`login`/`logout`/`me` (typed envelope, server Zod), `features/auth/*` (schema/queries/mutations/client + components AuthCard/LoginForm/RegisterForm/RoleSelect), role-based redirect, minimal dashboard landings + PendingApprovalBanner. Unit test (schema) + RLS smoke note. **+ Playwright E2E** (config + `tests/e2e/auth.spec.ts`, 16 tests ar/en) to verify auth without hand-testing. | ✅ Done — **verified via Playwright E2E (16/16 passed, ar+en)** + typecheck/lint/unit green |

### Task 0.3 — DoD: FULL PASS
- Migration applied to live project `kukjkkkpyohsykaeealw`. ✅
- Enums + `profiles` match DATABASE.md §3.1 exactly (`user_role` has `provider` not service_provider; `profile_status` includes `rejected`; `currency_code` SAR/EGP). ✅
- Signup trigger sets status per role — **verified live: seller → `pending`, customer → `active`.** ✅
- RLS enabled on `profiles` — **verified live: `relrowsecurity = true`.** ✅
- `lib/database.types.ts` regenerated from the LIVE database (contains `profiles` + 4 enums). ✅
- `pnpm typecheck` + `pnpm lint` green against regenerated types. ✅

REQ-AUTH-01..06 marked **In progress** in the matrix (DB foundation + RLS + session/RBAC middleware live; auth routes/forms still to come in 0.7).

## What's next
**Task 0.8 — payment & notification provider abstractions** (`lib/payments`, `lib/notifications`). Do NOT start until the user triggers it. Per CLAUDE_RULES §3 (provider abstractions — never call Tap/Resend directly from feature code) + API_MAP Payments/Notifications. Tap is primary (Stripe deferred), Resend for email (SMS/Twilio = Phase 2).

**Verifying tasks from here on:** auth (and future flows) are covered by `pnpm test:e2e` (auto-starts `pnpm dev`; green = 16/16, ar+en). Extend `tests/e2e/*` as new flows land rather than hand-testing. E2E users use unique `…@e2e.princess.test` emails; teardown: `delete from auth.users where email like '%@e2e.princess.test';`.

## Standing workflow
Sandbox limits: **cannot reach Postgres** (DNS/5432 egress blocked; only HTTPS) and **cannot run `pnpm dev`** (Google Fonts egress blocked). So:
1. **Claude Code writes** code + migrations (and updates docs/type expectations); runs `pnpm typecheck` + `pnpm lint` as the sandbox gate.
2. **You run from your own terminal:** `pnpm exec supabase db push` + `pnpm db:types` for DB changes, and `pnpm dev` to verify UI/runtime in the browser.
3. **You paste results back** (push/types output, browser verification); Claude reconciles against DATABASE.md / the task DoD before advancing.
- **Secrets rule:** you NEVER paste DB passwords or PATs into chat. (The 0.3 DB password that was shared earlier should still be rotated — see below.) typecheck+lint passing is necessary but NOT sufficient — runtime bugs (e.g. 0.5) only surface in `pnpm dev`.

## ⚠️ Not committed yet
**No git commit has been made.** Uncommitted work spans **Tasks 0.1–0.7** (scaffold, Supabase wiring, migrations 0001+0002 + generated types, i18n/RTL shell, composed middleware, auth routes/forms/dashboards, Vitest + Playwright E2E setup — `@playwright/test` added to `package.json`/lockfile, planning docs). When ready to commit, branch first (repo not initialized yet) and reference the Phase-0 REQ-IDs.

## Secrets housekeeping
- `.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key value); `SUPABASE_SERVICE_ROLE_KEY` + Tap/Resend still blank.
- The **DB password** was shared in chat during 0.3 — **rotate it** (Dashboard → Project Settings → Database → Reset password) when convenient.

## ⚠️ Pre-launch checklist (carry forward to production)
- **Re-enable Supabase Auth → "Confirm email".** Turned OFF in dev (2026-06-29) so registration returns a session for E2E + smooth dev. App already handles the no-session path (register → "check your email" → login), so re-enabling is safe; do it before production so emails are verified.
- Rotate the 0.3 DB password (above) before launch if not already done.
