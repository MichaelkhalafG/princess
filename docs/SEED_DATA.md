# SEED_DATA.md

> **Project:** Princess — demo data plan + how to run it.
> Script: `supabase/seed.sql`. Companion: `DATABASE.md`, `PROJECT_ANALYSIS.md §6` (success criteria), `ENV_SETUP.md`.
> **Goal:** after seeding, you can test **buy / rent / book / quote** end-to-end immediately.

---

## 1. What gets seeded

| Area | Records |
|------|---------|
| **Settings** | `platform_settings` (commission 15/10/10 — BR-4); `platform_upfront_fees` for product/rental/service × SAR + EGP (minor units, C7/C10) |
| **Users** (via admin step, §3) | 1 admin · 2 sellers (approved + pending) · 2 providers (freelancer approved + center pending) · 2 customers |
| **Categories** | 5 product (Dresses, Shoes, Bags, Accessories, Cosmetics) + 4 service (Makeup, Hair, Nails, Massage) |
| **Products** | 3 by the approved seller, incl. **1 rentable** dress; variants (sizes) |
| **Services** | 2 by the approved freelancer provider (Bridal Makeup, Hair Styling) + availability slots (July 2026) |
| **Event planner** | 1 **verified** planner (the approved provider) with `packages` + `specialties` |
| **Event request** | 1 sample request (customer → planner) to exercise REQ-EVT-04/05/06 |
| **Portfolio** | 1 **profile-level** item + 1 **service-level** item on the same provider → exercises the combined-merge `source` tag (REQ-PORT-04) |

This satisfies the PROJECT_ANALYSIS §6 success criteria: a buyable product, a rentable item, a bookable service with open slots, and a planner to quote.

## 2. Demo accounts

| Email | Role | State | Purpose |
|-------|------|-------|---------|
| `admin@princess.test` | admin | active | approvals, COD confirm, settings, verify |
| `seller1@princess.test` | seller | **approved** | owns the seeded products |
| `seller2@princess.test` | seller | **pending** | tests approval flow / pending banner |
| `provider1@princess.test` | provider (freelancer) | **approved** | owns services, availability, portfolio, is the planner |
| `provider2@princess.test` | provider (center) | **pending** | tests center + approval flow |
| `customer1@princess.test` | customer | active | buyer/renter/booker; sent the event request |
| `customer2@princess.test` | customer | active | second buyer |

> Suggested demo password for all: `Princess#2026` (sandbox only — never reuse in prod).

## 3. How to run (order matters — Q5)

`seed.sql` **never inserts into `profiles` directly** (the `handle_new_user` trigger owns that). So create the auth users **first**, then run the SQL, which looks users up by email and `UPDATE`s their profile (approval state, provider_type, name).

### Step 1 — create the 7 auth users (admin step)
Use one of these (all fire the trigger correctly):

**Option A — Supabase Dashboard:** Authentication → Users → *Add user* for each email above; set the password; under *User Metadata* add `{"role":"<role>"}` (`customer`/`seller`/`provider`/`admin`). The trigger creates the profile with the right default status.

**Option B — Admin API script** (documented tooling, run once; not app code):
```ts
// scripts/seed-users.ts — run with the SERVICE ROLE key, locally only.
import { createClient } from '@supabase/supabase-js';
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const users = [
  ['admin@princess.test','admin'], ['seller1@princess.test','seller'], ['seller2@princess.test','seller'],
  ['provider1@princess.test','provider'], ['provider2@princess.test','provider'],
  ['customer1@princess.test','customer'], ['customer2@princess.test','customer'],
];
for (const [email, role] of users) {
  await admin.auth.admin.createUser({ email, password: 'Princess#2026', email_confirm: true, user_metadata: { role } });
}
```

**Option C — local dev SQL (local Supabase only):** insert into `auth.users` with `crypt()`-hashed passwords. Allowed **only** against a local instance; the trigger still fires. Do not do this against a hosted project.

### Step 2 — apply migrations + seed
```bash
supabase db push                 # applies 0001..0007
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
# or: supabase db reset          # if seed.sql is wired as the project seed
```

### Step 3 — verify
- Sign in as `customer1@princess.test` → browse products, add to cart, reach checkout (see COD amount + upfront fee).
- Open the rentable dress → pick July dates → see availability + deposit.
- Open a service → pick an open July slot → booking with upfront fee.
- Open the planner → send a quote request.
- Sign in as `provider1` → see the incoming event request + portfolio (profile + service items merged).
- Sign in as `admin` → see `seller2`/`provider2` pending for approval.

## 4. Idempotency

`seed.sql` is safe to re-run: settings/fees use `ON CONFLICT … DO UPDATE`; content rows use **fixed UUIDs** + `ON CONFLICT (id) DO NOTHING`; categories key on `slug`; profile rows are `UPDATE`d (never inserted). FK-dependent inserts use `INSERT … SELECT … WHERE EXISTS` so a missing user no-ops instead of erroring. Availability uses fixed July-2026 timestamps (deterministic, future).

## 5. Cross-reference

Exercises: REQ-AUTH-05 (pending vendors), REQ-PROD-01/04, REQ-RENT-01/05, REQ-SVC-01/05, REQ-BOOK-01, REQ-EVT-01..06, REQ-PORT-02/03/04, REQ-PAY-01/06 (fees+commission). Maps to PROJECT_ANALYSIS §6 success criteria.
