import type { NotificationService } from "./NotificationService";

/**
 * SMS channel placeholder (REQ-NOT-02; C5 — Twilio is **Phase 2**). Interface
 * only, so feature code stays channel-agnostic today and a Twilio implementation
 * drops in behind `NotificationService` later with no feature changes. No
 * implementation yet by design.
 */
export interface SmsChannel extends NotificationService {
  readonly channel: "sms";
}
