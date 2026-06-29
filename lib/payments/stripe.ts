import "server-only";

import type {
  PaymentIntent,
  PaymentProvider,
  WebhookVerificationResult,
} from "./PaymentProvider";

/**
 * Stripe provider stub (REQ-PAY-07 — future scalability). Stripe is deferred
 * (Tap is primary for SA/EG — C1/Decision 3); this exists so the factory can
 * switch gateways without feature changes. Every method throws NotImplemented.
 */
class StripeNotImplementedError extends Error {
  constructor(method: string) {
    super(`StripeProvider.${method} is not implemented — Stripe is deferred (use Tap).`);
    this.name = "StripeNotImplementedError";
  }
}

export class StripeProvider implements PaymentProvider {
  readonly id = "stripe";

  // Params omitted intentionally — these stubs throw; TS still satisfies the
  // interface (an implementation may take fewer parameters).
  createIntent(): Promise<PaymentIntent> {
    throw new StripeNotImplementedError("createIntent");
  }

  verifyWebhook(): Promise<WebhookVerificationResult> {
    throw new StripeNotImplementedError("verifyWebhook");
  }
}
