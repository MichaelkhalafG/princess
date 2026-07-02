import { Money } from "@/components/shared/Money";
import type { Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

interface PriceTagProps {
  amountMinor: number;
  currency: Currency;
  /** Optional "was" price — struck through when higher than the current price. */
  compareAtMinor?: number | null;
  /**
   * Visual scale (DESIGN_RULES §3.1/§4.5):
   *  - `detail` — large serif for product detail pages.
   *  - `card`   — serif ~20px / 600 / tabular for catalog cards (Direction A `.pcard__price`).
   */
  emphasis?: "default" | "detail" | "card";
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
          emphasis === "card" && "font-serif text-h4 font-semibold",
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
