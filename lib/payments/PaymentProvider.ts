import type { Database } from "@/lib/database.types";

/**
 * Payment provider abstraction (REQ-PAY-07; SYSTEM_ARCHITECTURE §13/§18,
 * PROJECT_ANALYSIS Recommended Decision 3). Feature code depends on this
 * interface only — never on `TapProvider`/`StripeProvider` directly
 * (CLAUDE_RULES §3) — so swapping/adding gateways needs no feature refactor.
 *
 * Money rule (CLAUDE_RULES §6, Decision 4): all amounts are **integer minor
 * units** (e.g. SAR halalas, EGP piastres). Never floats in logic.
 */

/** Currency mirrors the DB `currency_code` enum (single source of truth). */
export type Currency = Database["public"]["Enums"]["currency_code"];

/** What an intent pays for — the upfront fee on an order/booking/rental. */
export type PaymentTargetType = "order" | "booking" | "rental";

export interface PaymentTarget {
  type: PaymentTargetType;
  id: string;
}

/**
 * Marketplace split-settlement destination — Tap `destination_id` of the
 * vendor's connected account (REQ-PAY-05). Modeled as its own type so the split
 * (e.g. per-destination amounts) can grow without touching `CreateIntentInput`.
 * The split path itself is Phase 2; this only reserves the shape.
 */
export interface PaymentDestination {
  vendorAccountId: string;
}

export interface CreateIntentInput {
  target: PaymentTarget;
  /** Integer minor units (REQ-PAY-01). */
  amountMinor: number;
  currency: Currency;
  /** Caller-supplied key for safe retries / webhook dedupe (REQ-PAY-02). */
  idempotencyKey: string;
  /**
   * Optional vendor split target (marketplace settlement, REQ-PAY-05). Optional
   * by design: the single-merchant path ignores it today, and the split path is
   * added later WITHOUT breaking existing callers. Implementation = Phase 2.
   */
  destination?: PaymentDestination;
}

export interface PaymentIntent {
  /** Provider charge/intent id, persisted for reconciliation. */
  intentId: string;
  /** Token/url the client uses to complete payment (Tap = `transaction.url` redirect). */
  clientToken: string;
  amountMinor: number;
  currency: Currency;
  /** Raw provider response, for audit logging / diagnostics (optional). */
  raw?: unknown;
}

/** Normalized webhook event types across providers. */
export type WebhookEventType =
  | "payment.captured"
  | "payment.failed"
  | "payment.refunded"
  | "unknown";

export interface WebhookEvent {
  type: WebhookEventType;
  /** Provider intent/charge id this event concerns. */
  intentId: string;
  amountMinor: number | null;
  currency: Currency | null;
  /** Raw parsed payload, for audit logging (SYSTEM_ARCHITECTURE §15/§16). */
  raw: unknown;
}

/** Result of signature-verifying an inbound webhook (REQ-PAY-02). */
export interface WebhookVerificationResult {
  verified: boolean;
  event: WebhookEvent | null;
}

/**
 * Capture confirmation (sketch — finalized in Phase 2, REQ-PAY-02/04). An order
 * /booking is `paid` ONLY when the upfront fee is captured AND COD is collected;
 * this surfaces the capture half. Optional so a stub provider need not implement.
 */
export interface CaptureResult {
  intentId: string;
  status: "captured" | "failed" | "pending" | "refunded";
  amountMinor: number | null;
  currency: Currency | null;
}

export interface PaymentProvider {
  /** Stable provider id, e.g. "tap" | "stripe". */
  readonly id: string;
  /** Create an upfront-fee payment intent (REQ-PAY-01). */
  createIntent(input: CreateIntentInput): Promise<PaymentIntent>;
  /** Verify an inbound webhook's signature and normalize the event (REQ-PAY-02). */
  verifyWebhook(req: Request): Promise<WebhookVerificationResult>;
  /** Query capture status (sketch; Phase 2). */
  getCaptureStatus?(intentId: string): Promise<CaptureResult>;
}

/**
 * Guard: amounts must be non-negative integers (minor units). Shared by providers
 * so the money rule is enforced at the boundary, not just by convention.
 */
export function assertMinorUnits(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error(
      `Payment amount must be a non-negative integer in minor units; received ${amountMinor}`,
    );
  }
}
