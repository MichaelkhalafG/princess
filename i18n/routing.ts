import { defineRouting } from "next-intl/routing";

/**
 * i18n routing (SYSTEM_ARCHITECTURE §5, DESIGN_RULES §13).
 * Arabic-first: `ar` is the default locale; `en` is secondary. Always prefixed
 * (`/ar/...`, `/en/...`) so `/` redirects to the default locale.
 */
export const routing = defineRouting({
  locales: ["ar", "en"],
  defaultLocale: "ar",
  localePrefix: "always",
  // Arabic-first: do NOT sniff the browser's Accept-Language. Unprefixed routes
  // (e.g. `/`) always redirect to the default locale (`/ar`); `/en` stays
  // reachable explicitly. Without this, the browser's `en` header overrode `ar`.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
