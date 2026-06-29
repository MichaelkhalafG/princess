import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  assertMinorUnits,
  type CreateIntentInput,
  type Currency,
  type PaymentIntent,
  type PaymentProvider,
  type WebhookEvent,
  type WebhookEventType,
  type WebhookVerificationResult,
} from "./PaymentProvider";

/**
 * Tap Payments provider (REQ-PAY-01/02; primary gateway for SA/EG — C1/Decision 3).
 * Secrets read from env, server-only (CLAUDE_RULES §5). The live charge call is
 * proven in Task 0.9; createIntent is a clearly-marked sandbox stub until then.
 *
 * Webhook verification follows Tap's **hashstring** scheme (NOT a generic
 * whole-body HMAC): Tap builds a canonical string from specific charge fields in
 * a fixed order, HMAC-SHA256s it with the account secret, and sends the result
 * as the `hashstring` (header on webhooks). We recompute and timing-safe compare,
 * failing closed (REQ-PAY-02). Exact amount decimals/secret are reconfirmed
 * against the sandbox in Task 0.9.
 */
const TAP_HASHSTRING_HEADER = "hashstring";
const TAP_API_BASE = "https://api.tap.company/v2";

/** Decimal places per currency for Tap amount formatting (SAR/EGP = 2). */
const CURRENCY_DECIMALS: Record<Currency, number> = { SAR: 2, EGP: 2 };

/**
 * Convert integer minor units → the MAJOR-unit number Tap expects (caveat b).
 * e.g. 100 → 1 (SAR), 150 → 1.5, 12345 → 123.45. Division by a power of ten keeps
 * the value exact for our 2-decimal currencies (no float drift at these sizes).
 */
export function toTapAmount(amountMinor: number, currency: Currency): number {
  assertMinorUnits(amountMinor);
  const decimals = CURRENCY_DECIMALS[currency];
  return amountMinor / 10 ** decimals;
}

export class TapProvider implements PaymentProvider {
  readonly id = "tap";

  private readonly secretKey: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor() {
    // Read env without throwing so the provider can be constructed in tests;
    // methods fail closed when a required secret is missing.
    this.secretKey = process.env.TAP_SECRET_KEY;
    this.webhookSecret = process.env.TAP_WEBHOOK_SECRET;
  }

  async createIntent(input: CreateIntentInput): Promise<PaymentIntent> {
    assertMinorUnits(input.amountMinor);
    if (!this.secretKey) {
      throw new Error("TAP_SECRET_KEY is not configured");
    }

    // Tap wants the amount in MAJOR units with currency-correct decimals (caveat b).
    const amount = toTapAmount(input.amountMinor, input.currency);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    // Charge body for the upfront fee (REQ-PAY-01). `source: src_all` surfaces all
    // enabled methods (card/mada/etc.) on Tap's hosted page; `redirect.url` is
    // required (Tap is a redirect flow); `post.url` is the webhook target.
    // `reference.transaction` carries our idempotency key for dedupe (REQ-PAY-02).
    //
    // Marketplace split (Phase 2, REQ-PAY-05): when `input.destination` is set,
    // add Tap `destinations: [{ id: input.destination.vendorAccountId, amount,
    // currency }]` so the vendor share settles to their connected account.
    // Single-merchant for now; left as a TODO so callers needn't change later.
    const body = {
      amount,
      currency: input.currency,
      customer: { first_name: "Princess", last_name: "Sandbox", email: "sandbox@princess.test" },
      source: { id: "src_all" },
      redirect: { url: `${appUrl}/payment/callback` },
      post: { url: `${appUrl}/api/payments/webhook` },
      reference: { transaction: input.idempotencyKey, order: input.target.id },
      description: `Upfront fee for ${input.target.type} ${input.target.id}`,
      metadata: { target_type: input.target.type, target_id: input.target.id },
    };

    const response = await fetch(`${TAP_API_BASE}/charges`, {
      method: "POST",
      headers: {
        // The API call is authenticated with the SECRET key (caveat a).
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const parsed: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      // Never include the secret in errors; Tap's error body is safe to surface.
      throw new Error(`Tap charge failed (${response.status}): ${JSON.stringify(parsed)}`);
    }
    if (!isRecord(parsed)) {
      throw new Error("Tap charge returned an unexpected (non-object) response");
    }

    const intentId = asString(parsed.id);
    const transactionUrl = asString(getNested(parsed, ["transaction", "url"]));

    return {
      intentId,
      clientToken: transactionUrl,
      amountMinor: input.amountMinor,
      currency: input.currency,
      raw: parsed,
    };
  }

  async verifyWebhook(req: Request): Promise<WebhookVerificationResult> {
    // Fail closed if not configured (CLAUDE_RULES §5, SYSTEM_ARCHITECTURE §15).
    if (!this.webhookSecret) return { verified: false, event: null };

    const rawBody = await req.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { verified: false, event: null };
    }
    if (!isRecord(parsed)) return { verified: false, event: null };

    // Tap delivers the hash in the `hashstring` header (fallback: body field).
    const provided =
      req.headers.get(TAP_HASHSTRING_HEADER) ??
      (typeof parsed.hashstring === "string" ? parsed.hashstring : null);
    if (!provided) return { verified: false, event: null };

    // Recompute Tap's hashstring over the canonical field string (not the body).
    const canonical = buildTapHashString(parsed);
    const expected = createHmac("sha256", this.webhookSecret).update(canonical).digest("hex");
    if (!timingSafeEqualHex(expected, provided)) {
      return { verified: false, event: null };
    }

    return { verified: true, event: toWebhookEvent(parsed) };
  }
}

/**
 * Build Tap's canonical hashstring input from a charge object, in Tap's fixed
 * field order. Exported for tests. (Per Tap docs: id, amount, currency,
 * gateway.reference, reference.payment, status, transaction.created.)
 */
export function buildTapHashString(charge: Record<string, unknown>): string {
  const id = asString(charge.id);
  const currency = asString(charge.currency);
  const amount = formatTapAmount(charge.amount, charge.currency);
  const gatewayReference = asString(getNested(charge, ["gateway", "reference"]));
  const paymentReference = asString(getNested(charge, ["reference", "payment"]));
  const status = asString(charge.status);
  const created = asString(getNested(charge, ["transaction", "created"]));

  return (
    `x_id${id}` +
    `x_amount${amount}` +
    `x_currency${currency}` +
    `x_gateway_reference${gatewayReference}` +
    `x_payment_reference${paymentReference}` +
    `x_status${status}` +
    `x_created${created}`
  );
}

/** Format a charge amount to the currency's decimal places (Tap expects e.g. "10.00"). */
function formatTapAmount(amount: unknown, currency: unknown): string {
  if (typeof amount !== "number") return "";
  const decimals = isCurrency(currency) ? CURRENCY_DECIMALS[currency] : 2;
  return amount.toFixed(decimals);
}

/** Constant-time hex comparison; length-guards before `timingSafeEqual`. */
function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Map a Tap charge `status` to our normalized event type. */
function toEventType(status: string): WebhookEventType {
  switch (status.toUpperCase()) {
    case "CAPTURED":
    case "PAID":
      return "payment.captured";
    case "FAILED":
    case "DECLINED":
    case "CANCELLED":
      return "payment.failed";
    case "REFUNDED":
      return "payment.refunded";
    default:
      return "unknown";
  }
}

/** Normalize a verified Tap charge into our webhook event (sketch; Phase 2). */
function toWebhookEvent(charge: Record<string, unknown>): WebhookEvent {
  const intentId = asString(charge.id);
  const status = asString(charge.status);

  // Tap `amount` is major units (e.g. 10.50) — convert to integer minor units.
  const amountMinor = typeof charge.amount === "number" ? Math.round(charge.amount * 100) : null;
  const currency = isCurrency(charge.currency) ? charge.currency : null;

  return { type: toEventType(status), intentId, amountMinor, currency, raw: charge };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function getNested(obj: Record<string, unknown>, path: [string, string]): unknown {
  const first = obj[path[0]];
  return isRecord(first) ? first[path[1]] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCurrency(value: unknown): value is Currency {
  return value === "SAR" || value === "EGP";
}
