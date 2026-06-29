import "server-only";

import type { PaymentProvider } from "./PaymentProvider";
import { StripeProvider } from "./stripe";
import { TapProvider } from "./tap";

/**
 * Payment provider factory (REQ-PAY-07; CLAUDE_RULES §3). Feature code calls
 * `getPaymentProvider()` and works against the `PaymentProvider` interface —
 * never `new TapProvider()` directly. Active gateway defaults to Tap; override
 * with `PAYMENT_PROVIDER=stripe` (future). Memoized per server instance.
 */
let instance: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (instance) return instance;

  const choice = (process.env.PAYMENT_PROVIDER ?? "tap").toLowerCase();
  instance = choice === "stripe" ? new StripeProvider() : new TapProvider();
  return instance;
}

// Re-export the interface surface so feature code imports types from one place.
export type {
  CaptureResult,
  CreateIntentInput,
  Currency,
  PaymentIntent,
  PaymentProvider,
  PaymentTarget,
  PaymentTargetType,
  WebhookEvent,
  WebhookEventType,
  WebhookVerificationResult,
} from "./PaymentProvider";
