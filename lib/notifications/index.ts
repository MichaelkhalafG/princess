import "server-only";

import type { NotificationService } from "./NotificationService";
import { ResendEmailChannel } from "./resend";

/**
 * Notification factory (REQ-NOT-01; CLAUDE_RULES §3). Feature code calls
 * `getNotificationService()` and works against the `NotificationService`
 * interface. Active channel is email (Resend) now; SMS (Twilio) is Phase 2
 * (C5). Memoized per server instance.
 */
let instance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!instance) instance = new ResendEmailChannel();
  return instance;
}

export type {
  NotificationData,
  NotificationLocale,
  NotificationRecipient,
  NotificationService,
  NotificationTemplate,
  SendResult,
} from "./NotificationService";
