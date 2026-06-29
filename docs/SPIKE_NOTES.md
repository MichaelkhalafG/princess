# SPIKE_NOTES.md — Tap sandbox spike (Task 0.9)

> Proves the real `create-intent` round-trip against the Tap sandbox via
> `TapProvider.createIntent` (REQ-PAY-01/07) and closes the two caveats flagged in
> Task 0.8. Source: `scripts/tap-spike.ts`. Phase 2 builds the webhook against the
> reality recorded here — do not infer the webhook shape, confirm it.

## How to run (from your terminal, sandbox key in `.env.local`)

```bash
pnpm spike:tap                       # SAR, 100 minor (1.00) by default
pnpm spike:tap EGP                   # currency via arg
TAP_SPIKE_AMOUNT_MINOR=250 pnpm spike:tap   # 2.50
```

`= tsx --tsconfig scripts/tsconfig.json scripts/tap-spike.ts`. The `scripts/tsconfig.json`
aliases `server-only` to a stub so the script can import the (server-only) provider;
the app build keeps the real `server-only` guard. Secret is masked in output; the
script refuses to run against `sk_live…` keys.

### A successful result looks like
- `✓ createIntent succeeded`
- Mapped `PaymentIntent`: `intentId` = `chg_…`, `clientToken` = a
  `https://…tap.company/…` redirect URL, `amountMinor`/`currency` echoed.
- A full JSON Tap charge under "Full Tap response (intent.raw)".
- The "Caveat reconciliation" block (a) + (b).

## What the spike sends (charge request)

`POST https://api.tap.company/v2/charges`, `Authorization: Bearer <TAP_SECRET_KEY>`:

```jsonc
{
  "amount": 1,                     // MAJOR units (100 minor / 10^2) — caveat (b)
  "currency": "SAR",
  "customer": { "first_name": "Princess", "last_name": "Sandbox", "email": "sandbox@princess.test" },
  "source": { "id": "src_all" },   // hosted page shows all enabled methods
  "redirect": { "url": "<APP_URL>/payment/callback" },   // required (redirect flow)
  "post": { "url": "<APP_URL>/api/payments/webhook" },   // webhook target
  "reference": { "transaction": "<idempotencyKey>", "order": "<target.id>" },
  "description": "Upfront fee for order <id>",
  "metadata": { "target_type": "order", "target_id": "<id>" }
}
```

## Observed — LIVE sandbox run ✅ (Task 0.9 PASS, 2026-06-29)

`pnpm spike:tap` (SAR, 1.00) succeeded against the live Tap sandbox:

- ✅ **Charge created:** `id = chg_TS05A…`, `object: "charge"`, **`status: "INITIATED"`**,
  `live_mode: false` (sandbox).
- ✅ **Redirect flow:** `transaction.url` returned → mapped to `PaymentIntent.clientToken`
  (this is where the customer is sent to pay).
- ✅ **Amount/decimals (caveat b):** sent `1` SAR; Tap echoed `amount = 1`, `currency = SAR`.
  Confirms `CURRENCY_DECIMALS = { SAR: 2, EGP: 2 }` and `toTapAmount`.
- ✅ **API auth (caveat a, API half):** the call authenticated with `TAP_SECRET_KEY`
  and returned a charge.
- ✅ HTTPS to `api.tap.company` reachable; key masked in all output; no secret leaked.

Confirmed answers to the earlier open questions:
- `status` on creation = **`INITIATED`** (→ redirect/3DS → `CAPTURED` later, via webhook).
- Redirect URL location = **`transaction.url`**.
- Charge response includes **`post.url`** (webhook) and **`redirect.url`** (callback) echoed back.
- `amount` echoed as **`1`** (numeric, no forced trailing decimals) for a 2-decimal currency.

## Caveat (a) — which key authenticates what

- **API call:** `Authorization: Bearer TAP_SECRET_KEY` (the secret key). ✅ **CONFIRMED**
  by the live run — the charge was created with this key.
- **Webhook hashstring:** ⏸ **DEFERRED to Phase 2** — confirming which secret keys the
  `hashstring` requires a **delivered webhook** (public `post.url`, e.g. an ngrok tunnel),
  which the create-intent call can't produce. Keep the Tap-docs assumption (the
  **account secret key**) noted in `tap.ts`; Task 0.8 currently keys
  `TapProvider.verifyWebhook` with `TAP_WEBHOOK_SECRET`. **Action for Phase 2:** deliver a
  real sandbox webhook, confirm the keying, and if needed switch `verifyWebhook` to
  `TAP_SECRET_KEY` (one isolated line; `buildTapHashString` field order unchanged).

## Caveat (b) — per-currency amount decimals

- SAR and EGP are **2-decimal** currencies → `CURRENCY_DECIMALS = { SAR: 2, EGP: 2 }`.
- Spike sends `amountMinor / 10^2` (100 → `1`, 250 → `2.5`, 12345 → `123.45`) and
  prints what Tap echoes, to reconcile against `toTapAmount` + `buildTapHashString`.
- Note: some Gulf currencies (e.g. KWD/BHD) are **3-decimal**; if added later,
  extend `CURRENCY_DECIMALS` — `toTapAmount`/`buildTapHashString` already key off it.

## Findings to carry into Phase 2 (from the live run)

1. **Shared sandbox merchant ≠ ours.** The response's merchant (id `599424`) reports
   currency **KWD** — that's Tap's **public/shared test account**, not Princess's. Our
   real merchant id + currency (SAR/EGP) arrive with our **own / Marketplace keys**.
   Don't hardcode or assume merchant/currency from this spike; re-confirm under our keys.
2. **Callback + webhook paths must exist in Phase 2.** The charge echoes
   **`redirect.url`** (we send `<APP_URL>/payment/callback`) and **`post.url`**
   (`<APP_URL>/api/payments/webhook`). Phase 2 must (a) build the **`/payment/callback`**
   page (handles the post-payment return + shows status from the webhook-updated record),
   and (b) ensure the webhook handler actually lives at **`/api/payments/webhook`** to
   match `post.url` (the middleware matcher already excludes `/api`).

## Gotchas to carry into Phase 2

- **Redirect flow:** Tap is not a single API call — the customer is redirected to
  `transaction.url` (hosted page / 3DS), then back to `redirect.url`; final state
  arrives via the **webhook** (`post.url`). Don't treat `createIntent` success as
  payment success (ties to REQ-PAY-04: paid needs capture AND COD).
- **Webhook signature:** Tap sends the `hashstring` (header) computed over the
  canonical field string — NOT a generic body HMAC. Already implemented in 0.8
  (`buildTapHashString`); confirm field order/secret on a real delivery.
- **Payment methods / `source`:** `src_all` (all), `src_card`, mada `src_sa.mada`,
  KNET `src_kw.knet`. mada/KNET are region-specific debit rails — verify they're
  enabled on the sandbox account before relying on them.
- **3DS:** card flows may force 3-D Secure in the redirect; handle the
  authentication redirect, never assume inline capture.
- **Idempotency:** carried via `reference.transaction` (our idempotencyKey); the
  webhook handler must still dedupe via `payments.idempotency_key` (REQ-PAY-02).
- **Amounts:** always send MAJOR units to Tap; we hold integer minor units in logic
  and convert at the boundary only (`toTapAmount`).
