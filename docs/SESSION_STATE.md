# SESSION_STATE.md — resume note

> Scratch hand-off so work can resume exactly where it stopped. Last updated: **2026-06-28**.
> Authoritative planning docs: `REQUIREMENTS_MATRIX.md` (the law), `DATABASE.md`, `IMPLEMENTATION_PLAN.md`, `CLAUDE_RULES.md`, `DESIGN_RULES.md`, `ENV_SETUP.md`.

## Where we are
**Phase 0 (Foundation).** Tasks 0.1 → 0.3 complete and verified.

| Task | What | Status |
|------|------|--------|
| 0.1 | Scaffold (Next 14 + TS strict + Tailwind + shadcn/ui, brand tokens, folder skeleton, PWA baseline) | ✅ Done — typecheck + lint green |
| 0.2 | Supabase clients (`lib/supabase/{client,server,admin}.ts`), `lib/database.types.ts`, `db:types` script, `.env.example` | ✅ Done — typecheck + lint green |
| 0.3 | `supabase/migrations/0001_foundation.sql` (extensions, enums, `profiles`, `handle_new_user` + `set_updated_at` triggers, RLS enabled) | ✅ Done — **applied to live DB & verified** |
| 0.4 | `supabase/migrations/0002_rls_and_settings.sql` (profiles RLS + no-escalation column grants; `platform_settings` + `platform_upfront_fees` + seed; RLS authenticated-read/service-role-write) | ✅ Done — **applied to live DB & verified** |
| 0.5 | i18n + RTL shell (`next-intl` v4, `app/[locale]`, `ar` default + `localeDetection:false`, message catalogs, ThemeProvider+Toaster, localized landing). Root layout deleted so `[locale]/layout` is root (fixes missing-html-tags). | ✅ Done — **verified in browser** (/→/ar Arabic RTL; /en LTR; no root-layout error) |

### Task 0.3 — DoD: FULL PASS
- Migration applied to live project `kukjkkkpyohsykaeealw`. ✅
- Enums + `profiles` match DATABASE.md §3.1 exactly (`user_role` has `provider` not service_provider; `profile_status` includes `rejected`; `currency_code` SAR/EGP). ✅
- Signup trigger sets status per role — **verified live: seller → `pending`, customer → `active`.** ✅
- RLS enabled on `profiles` — **verified live: `relrowsecurity = true`.** ✅
- `lib/database.types.ts` regenerated from the LIVE database (contains `profiles` + 4 enums). ✅
- `pnpm typecheck` + `pnpm lint` green against regenerated types. ✅

REQ-AUTH-01..05 marked **In progress** in the matrix (DB foundation live; routes/forms/RBAC still to come in 0.6/0.7). REQ-AUTH-06 not started.

## What's next
**Task 0.6 — middleware (Supabase session + locale + RBAC)** — IN PROGRESS this session. Composes `intlMiddleware` with Supabase `getUser()` session refresh and a `/<locale>/dashboard/*` role guard (unauth→login; wrong role→own dashboard; role read from DB, never client claims). Files: `middleware.ts`, `lib/rbac.ts`. Then Task 0.7 (auth routes/forms).
- Note: 0.6 can't be runtime-verified in this sandbox (needs a live session); user verifies redirects in browser.

## Standing workflow reminder (DB tasks)
This sandbox **cannot reach Postgres** (DNS/5432 egress blocked; only HTTPS works), so:
1. **Claude Code writes** the migration SQL (and updates docs/types expectations).
2. **You run from your own terminal:** `pnpm exec supabase db push` then `pnpm db:types`.
3. **You paste results back** (push output + any smoke-test/SQL-editor output); Claude verifies & reconciles against DATABASE.md before advancing.
- Alternative: provide a short-lived `sbp_` Personal Access Token and Claude can run apply/types/smoke via the Management API over HTTPS (revoke it after).

## ⚠️ Not committed yet
**No git commit has been made.** Uncommitted work spans **Tasks 0.1–0.3** (scaffold, Supabase wiring, migration 0001 + generated types, planning docs). When ready to commit, branch first (repo currently not initialized / on default) and reference the Phase-0 REQ-IDs.

## Secrets housekeeping
- `.env.local` exists with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key value); `SUPABASE_SERVICE_ROLE_KEY` + Tap/Resend still blank.
- The **DB password** was shared in chat during 0.3 — **rotate it** (Dashboard → Project Settings → Database → Reset password) when convenient.
