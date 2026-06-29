/**
 * Notification abstraction (REQ-NOT-01; PROJECT_ANALYSIS Recommended Decision 5,
 * Conflict C5). Channel-agnostic: feature code calls `send(template, to, data)`
 * and never touches Resend/Twilio directly (CLAUDE_RULES §3). Email ships now
 * (Resend); SMS (Twilio) is Phase 2 behind the same interface (REQ-NOT-02/C5).
 */

/** Template keys (API_MAP Notifications). Same keys fan out to SMS in Phase 2. */
export type NotificationTemplate =
  | "order_confirmed"
  | "booking_confirmed"
  | "payment_received"
  | "new_event_request"
  | "booking_reminder";

export type NotificationLocale = "ar" | "en";

export interface NotificationRecipient {
  email?: string;
  phone?: string;
  name?: string;
  /** Drives template language (Arabic-first — DESIGN_RULES §13). */
  locale?: NotificationLocale;
}

/** Template variables. Primitives only — keeps payloads serializable, no `any`. */
export type NotificationData = Record<string, string | number | boolean | null>;

export interface SendResult {
  ok: boolean;
  /** Provider message id when sent. */
  id?: string;
  /** True when the channel had nothing to do (e.g. no email for this recipient). */
  skipped?: boolean;
  error?: string;
}

export interface NotificationService {
  /** Stable channel id, e.g. "email" | "sms". */
  readonly channel: string;
  send(
    template: NotificationTemplate,
    to: NotificationRecipient,
    data: NotificationData,
  ): Promise<SendResult>;
}
