import { Money } from "@/components/shared/Money";
import type { Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  amountMinor: number;
  currency: Currency;
  /** Optional "was" price — struck through when higher than the current price. */
  compareAtMinor?: number | null;
  /** `detail` uses the serif scale for product detail pages (DESIGN_RULES §3.1). */
  emphasis?: "default" | "detail";
  className?: string;
}

/**
 * Price display composing `Money` (COMPONENT_TREE Reuse map — products, rentals,
 * services, checkout). Hook-free, so it renders in server pages and client cells.
 */
export function PriceTag({
  amountMinor,
  currency,
  compareAtMinor,
  emphasis = "default",
  className,
}: PriceTagProps) {
  const showCompare = compareAtMinor != null && compareAtMinor > amountMinor;

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <Money
        amountMinor={amountMinor}
        currency={currency}
        className={cn(
          "font-medium text-foreground",
          emphasis === "detail" && "font-serif text-h3",
        )}
      />
      {showCompare ? (
        <Money
          amountMinor={compareAtMinor}
          currency={currency}
          className="text-body-sm text-muted-foreground line-through"
        />
      ) : null}
    </span>
  );
}
