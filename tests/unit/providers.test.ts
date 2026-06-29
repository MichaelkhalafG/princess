import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getNotificationService } from "@/lib/notifications";
import { ResendEmailChannel } from "@/lib/notifications/resend";
import { getPaymentProvider } from "@/lib/payments";
import { assertMinorUnits } from "@/lib/payments/PaymentProvider";
import { buildTapHashString, TapProvider, toTapAmount } from "@/lib/payments/tap";

/** Build a fake `fetch` returning a Tap-shaped charge response. */
function mockTapFetch(charge: Record<string, unknown>, status = 201) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(charge), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

describe("payment provider factory", () => {
  it("returns a PaymentProvider (Tap by default) behind the interface", () => {
    const provider = getPaymentProvider();
    expect(provider.id).toBe("tap");
    expect(typeof provider.createIntent).toBe("function");
    expect(typeof provider.verifyWebhook).toBe("function");
  });

  it("is memoized (same instance per server)", () => {
    expect(getPaymentProvider()).toBe(getPaymentProvider());
  });
});

describe("Tap amount conversion (minor units → Tap major units)", () => {
  it("converts SAR/EGP (2 decimals) exactly", () => {
    expect(toTapAmount(100, "SAR")).toBe(1);
    expect(toTapAmount(1000, "SAR")).toBe(10);
    expect(toTapAmount(150, "SAR")).toBe(1.5);
    expect(toTapAmount(12345, "EGP")).toBe(123.45);
  });

  it("rejects non-integer minor units (money rule)", () => {
    expect(() => toTapAmount(10.5, "SAR")).toThrow();
  });
});

describe("Tap createIntent (real call, fetch mocked)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const charge = {
    id: "chg_test_create_1",
    status: "INITIATED",
    amount: 1,
    currency: "SAR",
    transaction: { url: "https://sandbox.payments.tap.company/redirect/chg_test_create_1" },
    reference: { payment: "pay_1" },
  };

  it("maps a Tap charge to PaymentIntent and exposes the raw response", async () => {
    process.env.TAP_SECRET_KEY = "sk_test_dummy";
    vi.stubGlobal("fetch", mockTapFetch(charge));
    const provider = new TapProvider();

    const intent = await provider.createIntent({
      target: { type: "order", id: "order_1" },
      amountMinor: 100,
      currency: "SAR",
      idempotencyKey: "idem_1",
    });

    expect(intent.intentId).toBe("chg_test_create_1");
    expect(intent.clientToken).toBe(charge.transaction.url);
    expect(intent.amountMinor).toBe(100);
    expect(intent.currency).toBe("SAR");
    expect(intent.raw).toEqual(charge);
  });

  it("sends amount in Tap major units and accepts an optional destination", async () => {
    process.env.TAP_SECRET_KEY = "sk_test_dummy";
    let sentUrl = "";
    let sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown, init?: RequestInit) => {
        sentUrl = String(input);
        sentBody = typeof init?.body === "string" ? init.body : "";
        return new Response(JSON.stringify({ ...charge, currency: "EGP", amount: 20 }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const provider = new TapProvider();

    await provider.createIntent({
      target: { type: "order", id: "order_2" },
      amountMinor: 2000,
      currency: "EGP",
      idempotencyKey: "idem_2",
      destination: { vendorAccountId: "acct_vendor_1" },
    });

    expect(sentUrl).toContain("/v2/charges");
    // Body sent to Tap carries the MAJOR-unit amount (2000 piastres → 20.00).
    const parsedBody = JSON.parse(sentBody) as { amount: number; currency: string };
    expect(parsedBody.amount).toBe(20);
    expect(parsedBody.currency).toBe("EGP");
  });

  it("throws (no secret) without hitting the network", async () => {
    delete process.env.TAP_SECRET_KEY;
    const provider = new TapProvider();
    await expect(
      provider.createIntent({
        target: { type: "order", id: "order_3" },
        amountMinor: 100,
        currency: "SAR",
        idempotencyKey: "idem_3",
      }),
    ).rejects.toThrow(/TAP_SECRET_KEY/);
  });
});

describe("Tap webhook hashstring verification", () => {
  const secret = "whsec_test_123";

  /** A representative Tap charge payload + its correct hashstring header. */
  function signedRequest(charge: Record<string, unknown>, headerHash?: string): Request {
    const hash = headerHash ?? createHmac("sha256", secret).update(buildTapHashString(charge)).digest("hex");
    return new Request("https://example.com/api/payments/webhook", {
      method: "POST",
      headers: { hashstring: hash, "content-type": "application/json" },
      body: JSON.stringify(charge),
    });
  }

  const charge = {
    id: "chg_test_1",
    amount: 10,
    currency: "SAR",
    status: "CAPTURED",
    gateway: { reference: "gw_1" },
    reference: { payment: "pay_1" },
    transaction: { created: "1700000000000" },
  };

  it("verifies a correctly-hashed webhook and normalizes the event", async () => {
    process.env.TAP_WEBHOOK_SECRET = secret;
    const provider = new TapProvider();

    const result = await provider.verifyWebhook(signedRequest(charge));

    expect(result.verified).toBe(true);
    expect(result.event?.type).toBe("payment.captured");
    expect(result.event?.intentId).toBe("chg_test_1");
    expect(result.event?.amountMinor).toBe(1000);
    expect(result.event?.currency).toBe("SAR");
  });

  it("fails closed when the payload is tampered (hash mismatch)", async () => {
    process.env.TAP_WEBHOOK_SECRET = secret;
    const provider = new TapProvider();

    // Compute the hash for the original charge, then send a different status.
    const validHash = createHmac("sha256", secret).update(buildTapHashString(charge)).digest("hex");
    const result = await provider.verifyWebhook(
      signedRequest({ ...charge, status: "FAILED" }, validHash),
    );

    expect(result.verified).toBe(false);
    expect(result.event).toBeNull();
  });

  it("fails closed when the hashstring is missing", async () => {
    process.env.TAP_WEBHOOK_SECRET = secret;
    const provider = new TapProvider();

    const req = new Request("https://example.com/api/payments/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(charge),
    });

    const result = await provider.verifyWebhook(req);
    expect(result.verified).toBe(false);
  });
});

describe("minor-units guard", () => {
  it("accepts non-negative integers", () => {
    expect(() => assertMinorUnits(0)).not.toThrow();
    expect(() => assertMinorUnits(1500)).not.toThrow();
  });

  it("rejects floats and negatives (money rule)", () => {
    expect(() => assertMinorUnits(10.5)).toThrow();
    expect(() => assertMinorUnits(-1)).toThrow();
  });
});

describe("notification channel", () => {
  it("constructs the Resend email channel without env", () => {
    const channel = new ResendEmailChannel();
    expect(channel.channel).toBe("email");
    expect(typeof channel.send).toBe("function");
  });

  it("factory returns a NotificationService", () => {
    const service = getNotificationService();
    expect(service.channel).toBe("email");
    expect(typeof service.send).toBe("function");
  });
});
