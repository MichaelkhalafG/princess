import type { Database } from "@/lib/database.types";

/**
 * Money — single source for integer MINOR-UNIT math + locale formatting
 * (CLAUDE_RULES §6: never float arithmetic for money; store numeric + currency,
 * compute in integer minor units). Reused by every price display + settlement math.
 */
export type Currency = Database["public"]["Enums"]["currency_code"]; // 'SAR' | 'EGP'

export interface Money {
  amountMinor: number;
  currency: Currency;
}

/** Decimal places per currency (SAR/EGP = 2). Minor unit = 10^decimals of major. */
const CURRENCY_DECIMALS: Record<Currency, number> = { SAR: 2, EGP: 2 };

/** Major units (e.g. 10.50) → integer minor units (e.g. 1050). */
export function toMinor(major: number, currency: Currency): number {
  return Math.round(major * 10 ** CURRENCY_DECIMALS[currency]);
}

/** Integer minor units → major units (e.g. 1050 → 10.5). */
export function fromMinor(amountMinor: number, currency: Currency): number {
  return amountMinor / 10 ** CURRENCY_DECIMALS[currency];
}

/**
 * Format minor units as a localized currency string. `Intl.NumberFormat` handles
 * the currency symbol and per-locale digit script (Arabic-Indic vs Latin) — driven
 * by the active locale ('ar' | 'en'). Fraction digits fixed to the currency's decimals.
 */
export function formatMoney(amountMinor: number, currency: Currency, locale: string): string {
  const decimals = CURRENCY_DECIMALS[currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(fromMinor(amountMinor, currency));
}
