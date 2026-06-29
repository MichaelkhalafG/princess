import "server-only";

import type {
  NotificationData,
  NotificationRecipient,
  NotificationService,
  NotificationTemplate,
  SendResult,
} from "./NotificationService";

/**
 * Resend email channel (REQ-NOT-01; C5 — email now, SMS Phase 2). Reads
 * RESEND_API_KEY + RESEND_FROM_EMAIL from env, server-only (CLAUDE_RULES §5).
 * Constructor never throws (so it can be constructed in tests/at import); `send`
 * fails clearly if unconfigured. Template bodies are stubs for now — real
 * localized templates land with the notification work in Phase 2/5.
 */
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "Princess <onboarding@resend.dev>";

/** Minimal stub subject per template (placeholder copy — localized later). */
const SUBJECTS: Record<NotificationTemplate, string> = {
  order_confirmed: "Your Princess order is confirmed",
  booking_confirmed: "Your Princess booking is confirmed",
  payment_received: "We received your payment",
  new_event_request: "You have a new event request",
  booking_reminder: "Reminder: your upcoming booking",
};

export class ResendEmailChannel implements NotificationService {
  readonly channel = "email";

  private readonly apiKey: string | undefined;
  private readonly from: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM;
  }

  async send(
    template: NotificationTemplate,
    to: NotificationRecipient,
    data: NotificationData,
  ): Promise<SendResult> {
    // No email address → nothing for this channel to do (a future SmsChannel
    // would handle the same recipient by phone).
    if (!to.email) return { ok: true, skipped: true };

    if (!this.apiKey) {
      return { ok: false, error: "RESEND_API_KEY is not configured" };
    }

    const { subject, text } = renderTemplate(template, to, data);

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to: [to.email], subject, text }),
    });

    if (!response.ok) {
      return { ok: false, error: `Resend responded ${response.status}` };
    }

    const json: unknown = await response.json().catch(() => null);
    const id =
      typeof json === "object" && json !== null && "id" in json
        ? String((json as { id: unknown }).id)
        : undefined;

    return { ok: true, id };
  }
}

/** Stub renderer — subject from the registry + a minimal text body. */
function renderTemplate(
  template: NotificationTemplate,
  to: NotificationRecipient,
  data: NotificationData,
): { subject: string; text: string } {
  const greeting = to.name ? `Hi ${to.name},` : "Hi,";
  const details = Object.entries(data)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("\n");
  return {
    subject: SUBJECTS[template],
    // TODO(Phase 2/5): replace with localized (ar/en) templates per `to.locale`.
    text: `${greeting}\n\n${SUBJECTS[template]}.\n\n${details}`,
  };
}
