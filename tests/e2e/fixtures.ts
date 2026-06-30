import { test as base, expect } from "@playwright/test";

import arMessages from "../../messages/ar.json" with { type: "json" };
import enMessages from "../../messages/en.json" with { type: "json" };

export type AppLocale = "ar" | "en";

/**
 * The subset of message keys the E2E assertions read. Declaring the shape we use
 * (instead of `typeof arMessages`) keeps typing robust regardless of how TS
 * widens the JSON, and lets both locale catalogs satisfy one type. Tests assert
 * against these real strings so no UI copy is hardcoded in the suite.
 */
export interface AuthMessages {
  auth: {
    login: { title: string; subtitle: string; submit: string };
    register: { title: string; submit: string };
    roles: {
      placeholder: string;
      customer: { label: string };
      seller: { label: string };
      provider: { label: string };
    };
    pending: { title: string };
    errors: { INVALID_CREDENTIALS: string; EMAIL_TAKEN: string };
  };
  products: { title: string; empty: string };
  filters: { sort: { newest: string; price_asc: string } };
  status: { active: string };
  seller: { products: string };
}

const catalogs: Record<AppLocale, AuthMessages> = { ar: arMessages, en: enMessages };

/** Project-level option, set per project in playwright.config.ts. */
export type AuthOptions = { appLocale: AppLocale };
type AuthFixtures = { messages: AuthMessages };

export const test = base.extend<AuthOptions & AuthFixtures>({
  appLocale: ["ar", { option: true }],
  messages: async ({ appLocale }, use) => {
    await use(catalogs[appLocale]);
  },
});

export { expect };

/** Password used for all created users (satisfies the 8-char minimum). */
export const TEST_PASSWORD = "Princess12345";

/**
 * Unique, recognizable email per run so reruns never collide on EMAIL_TAKEN and
 * teardown is a single `LIKE` query. Domain `@e2e.princess.test` is the cleanup key.
 */
export function uniqueEmail(locale: AppLocale): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `e2e-${locale}-${Date.now()}-${rand}@e2e.princess.test`;
}
