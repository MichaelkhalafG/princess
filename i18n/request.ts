import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "@/i18n/routing";

/**
 * Per-request i18n config consumed by the next-intl plugin. Loads the message
 * catalog for the negotiated locale; falls back to the default locale for any
 * unknown value. All UI strings come from messages/* (CLAUDE_RULES §7).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
