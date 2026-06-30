"use client";

import { useLocale } from "next-intl";

import { formatMoney, type Money as MoneyValue } from "@/lib/money";
import { cn } from "@/lib/utils";

interface MoneyProps extends MoneyValue {
  className?: string;
}

/**
 * Renders a localized currency amount from `{ amountMinor, currency }` for the
 * active locale (tabular-nums — DESIGN_RULES §3.1). Client so it can render in
 * both server pages and client tables/cells. Reused by every price display.
 */
export function Money({ amountMinor, currency, className }: MoneyProps) {
  const locale = useLocale();
  return <span className={cn("tabular-nums", className)}>{formatMoney(amountMinor, currency, locale)}</span>;
}
