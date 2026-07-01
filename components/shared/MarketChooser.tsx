"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MARKETS, type Market } from "@/lib/markets";
import { cn } from "@/lib/utils";

interface MarketChooserProps {
  /** Geo guess used to pre-highlight a card (DC-1) — not committed until confirmed. */
  geoHint: Market;
}

/**
 * First-visit market chooser (CR-01 §A, Q-A; DC-1). A lightweight **blocking** modal
 * shown only when no market is resolved yet: the visitor picks EG/SA (geo-highlighted)
 * then clicks Confirm — geo never auto-commits. Dismissal is disabled (no close/ESC/
 * backdrop); confirming sets the cookie and refreshes, after which the server stops
 * rendering this. All copy via `messages/*`, RTL via logical props.
 *
 * NOTE: the whole body is wrapped in a single `<div>` so the ONLY direct-child
 * `<button>` of `DialogContent` is Radix's built-in close "✕" — that is what
 * `[&>button]:hidden` targets. Without the wrapper it would also hide the Confirm
 * button (both are direct children), which is the bug this structure prevents.
 */
export function MarketChooser({ geoHint }: MarketChooserProps) {
  const t = useTranslations("market");
  const locale = useLocale();
  const router = useRouter();
  // Geo pre-highlights a card (DC-1) — usually non-null, so Confirm is enabled at once,
  // but nothing is committed until the visitor clicks Confirm. `null` disables Confirm.
  const [selected, setSelected] = useState<Market | null>(geoHint);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    if (!selected) return;
    const market = selected;
    startTransition(async () => {
      await fetch("/api/market", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ market }),
      });
      router.refresh();
    });
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        data-testid="market-chooser"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        className="max-w-md rounded-lg shadow-overlay [&>button]:hidden"
      >
        <div className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle
              className={cn("text-h3 text-foreground", locale === "ar" ? "font-arabic" : "font-serif")}
            >
              {t("chooser.title")}
            </DialogTitle>
            <DialogDescription className="text-body-sm text-muted-foreground">
              {t("chooser.description")}
            </DialogDescription>
          </DialogHeader>

          <div role="radiogroup" aria-label={t("chooser.title")} className="grid grid-cols-2 gap-3">
            {MARKETS.map((value) => {
              const active = value === selected;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(value)}
                  className={cn(
                    "relative flex flex-col items-start gap-1 rounded-lg border p-4 text-start transition-colors",
                    active ? "border-primary bg-muted" : "border-border hover:bg-accent/40",
                  )}
                >
                  <span className="text-body font-semibold text-foreground">{t(`name.${value}`)}</span>
                  <span className="text-caption text-muted-foreground">{t(`currency.${value}`)}</span>
                  {active ? (
                    <Check aria-hidden className="absolute end-3 top-3 h-4 w-4 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <Button
            type="button"
            onClick={confirm}
            disabled={!selected || pending}
            data-testid="market-chooser-confirm"
            className="w-full shadow-soft"
          >
            {t("chooser.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
