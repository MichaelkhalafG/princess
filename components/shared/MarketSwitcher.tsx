"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Fragment, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { MARKETS, type Market } from "@/lib/markets";
import { cn } from "@/lib/utils";

interface MarketSwitcherProps {
  /** The active market (server-resolved), used to mark the pressed segment. */
  market: Market;
  className?: string;
}

/**
 * Segmented market toggle (sibling to `LocaleSwitcher`, DESIGN_RULES §13). Sets the
 * `market` cookie via `POST /api/market` then refreshes the route so Server
 * Components re-read the active market and re-price. **Market is orthogonal to
 * locale** — this uses the plain `next/navigation` router (no locale/path change).
 */
export function MarketSwitcher({ market, className }: MarketSwitcherProps) {
  const t = useTranslations("market");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const select = (next: Market) => {
    if (next === market || pending) return;
    startTransition(async () => {
      await fetch("/api/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ market: next }),
      });
      router.refresh();
    });
  };

  return (
    <div role="group" aria-label={t("switch")} className={cn("flex items-center gap-1", className)}>
      {MARKETS.map((value, index) => (
        <Fragment key={value}>
          {index > 0 ? (
            <span aria-hidden className="text-mist">
              |
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            aria-pressed={value === market}
            disabled={pending}
            onClick={() => select(value)}
            className={cn(
              "h-auto min-w-0 rounded-sm px-2 py-1 text-caption font-semibold hover:bg-accent/50",
              value === market
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`name.${value}`)}
          </Button>
        </Fragment>
      ))}
    </div>
  );
}
