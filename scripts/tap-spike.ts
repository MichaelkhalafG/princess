/**
 * Tap sandbox spike (IMPLEMENTATION_PLAN Phase 0; PROJECT_ANALYSIS Known Risks —
 * Tap unknowns). Proves a REAL create-intent round-trip against the Tap sandbox
 * through `getPaymentProvider()` (the abstraction feature code uses — CLAUDE_RULES
 * §3) and closes the two 0.8 caveats:
 *   (a) which key authenticates the API call vs keys the webhook hashstring;
 *   (b) per-currency amount/decimal formatting Tap expects/returns.
 *
 * The sandbox has no internet — run this from YOUR terminal:
 *   pnpm spike:tap
 *   (= tsx --tsconfig scripts/tsconfig.json scripts/tap-spike.ts)
 *
 * Reads TAP_SECRET_KEY from .env.local. Secrets are masked in output; never logs
 * the raw key. Refuses to run against live keys. Sandbox-only; not shipped.
 */
import { readFileSync } from "node:fs";

import { getPaymentProvider } from "@/lib/payments";
import type { Currency } from "@/lib/payments";
import { toTapAmount } from "@/lib/payments/tap";

/** Minimal .env.local loader (no dependency) — only sets keys not already present. */
function loadEnvLocal(): void {
  let content: string;
  try {
    content = readFileSync(".env.local", "utf8");
  } catch {
    return; // rely on whatever is already in process.env
  }
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

/** Mask a secret for printing — keep the prefix + last 4 only. */
function maskSecret(secret: string): string {
  return secret.length <= 8 ? "••••" : `${secret.slice(0, 7)}…${secret.slice(-4)}`;
}

function parseCurrency(): Currency {
  const raw = (process.argv[2] ?? process.env.TAP_SPIKE_CURRENCY ?? "SAR").toUpperCase();
  if (raw !== "SAR" && raw !== "EGP") {
    throw new Error(`Unsupported currency "${raw}" — use SAR or EGP`);
  }
  return raw;
}

function parseAmountMinor(): number {
  const raw = process.env.TAP_SPIKE_AMOUNT_MINOR ?? "100"; // 1.00 by default
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`TAP_SPIKE_AMOUNT_MINOR must be a positive integer; got "${raw}"`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function main(): Promise<void> {
  loadEnvLocal();

  const secret = process.env.TAP_SECRET_KEY;
  if (!secret) {
    console.error("✗ TAP_SECRET_KEY is not set in .env.local — aborting.");
    process.exitCode = 1;
    return;
  }
  if (secret.startsWith("sk_live")) {
    console.error("✗ Refusing to run the spike against LIVE keys (sk_live…). Use a sandbox key.");
    process.exitCode = 1;
    return;
  }

  const currency = parseCurrency();
  const amountMinor = parseAmountMinor();
  const webhookSecret = process.env.TAP_WEBHOOK_SECRET;

  console.log("Tap sandbox spike — create-intent\n");
  console.log("Config:");
  const keyKind = secret.startsWith("sk_test") ? "sandbox" : "unknown prefix";
  console.log(`  TAP_SECRET_KEY:      ${maskSecret(secret)} (${keyKind})`);
  console.log(`  TAP_WEBHOOK_SECRET:  ${webhookSecret ? `present (${maskSecret(webhookSecret)})` : "absent"}`);
  console.log(`  NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL ?? "(default http://localhost:3000)"}`);
  console.log(`  amount:              ${amountMinor} minor → ${toTapAmount(amountMinor, currency)} ${currency}\n`);

  const idempotencyKey = `spike_${Date.now()}`;

  try {
    const intent = await getPaymentProvider().createIntent({
      target: { type: "order", id: idempotencyKey },
      amountMinor,
      currency,
      idempotencyKey,
    });

    console.log("✓ createIntent succeeded\n");
    console.log("Mapped PaymentIntent:");
    console.log(`  intentId:    ${intent.intentId}`);
    console.log(`  clientToken: ${intent.clientToken}   ← Tap transaction.url (redirect flow)`);
    console.log(`  amountMinor: ${intent.amountMinor}`);
    console.log(`  currency:    ${intent.currency}\n`);

    console.log("Full Tap response (intent.raw):");
    console.log(JSON.stringify(intent.raw, null, 2));

    const raw = intent.raw;
    const respAmount = isRecord(raw) && typeof raw.amount === "number" ? raw.amount : "(n/a)";
    const respCurrency = isRecord(raw) && typeof raw.currency === "string" ? raw.currency : "(n/a)";
    const respStatus = isRecord(raw) && typeof raw.status === "string" ? raw.status : "(n/a)";

    console.log("\n— Caveat reconciliation —");
    console.log("(a) API auth: the call used `Authorization: Bearer TAP_SECRET_KEY`. A returned");
    console.log("    charge id => TAP_SECRET_KEY authenticates the Charges API. The webhook");
    console.log("    hashstring secret is confirmed only by a DELIVERED webhook (needs a public");
    console.log("    post.url, e.g. ngrok). Per Tap docs it is keyed by the secret API key —");
    console.log("    record the observed answer in docs/SPIKE_NOTES.md and align tap.ts.");
    console.log(`(b) Decimals: sent ${toTapAmount(amountMinor, currency)} ${currency}; Tap echoed`);
    console.log(`    amount=${respAmount} currency=${respCurrency} status=${respStatus}. Reconcile`);
    console.log(`    against CURRENCY_DECIMALS (${currency}=2 decimals) in lib/payments/tap.ts.`);
  } catch (err) {
    console.error("✗ createIntent failed:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
