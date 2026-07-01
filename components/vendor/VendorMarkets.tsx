"use client";

import { BadgeCheck, Clock, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { MARKETS, type Market } from "@/lib/markets";
import { cn } from "@/lib/utils";

interface VendorMarketsProps {
  markets: { market: Market; isApproved: boolean }[];
}

/**
 * Seller market declaration (CR-01 §B, REQ-PROD-08). Shows declared markets with their
 * approval state and lets the seller declare any not-yet-declared market (POST →
 * pending; admin approves in Phase 1.6, seed pre-approves in dev). Copy via messages/*.
 */
export function VendorMarkets({ markets }: VendorMarketsProps) {
  const t = useTranslations("vendorMarkets");
  const tMarket = useTranslations("market");
  const router = useRouter();
  const [pending, setPending] = useState<Market | null>(null);

  const declared = new Set(markets.map((entry) => entry.market));
  const undeclared = MARKETS.filter((market) => !declared.has(market));

  const declare = async (market: Market) => {
    setPending(market);
    const response = await fetch("/api/vendor/markets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ market }),
    });
    setPending(null);
    if (response.ok) router.refresh();
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-h4 text-foreground">{t("title")}</h3>
        <p className="text-body-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {markets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {markets.map((entry) => (
            <span
              key={entry.market}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium",
                entry.isApproved
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-warning/30 bg-warning/10 text-warning",
              )}
            >
              {entry.isApproved ? (
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Clock className="h-3.5 w-3.5" aria-hidden />
              )}
              {tMarket(`name.${entry.market}`)} · {entry.isApproved ? t("approved") : t("pending")}
            </span>
          ))}
        </div>
      ) : null}

      {undeclared.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {undeclared.map((market) => (
            <Button
              key={market}
              type="button"
              variant="outline"
              size="sm"
              disabled={pending === market}
              onClick={() => declare(market)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              {t("declare", { market: tMarket(`name.${market}`) })}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
