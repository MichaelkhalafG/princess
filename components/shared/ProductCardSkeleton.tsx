import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholder matching the ProductCard shape exactly (DESIGN_RULES §11 —
 * no layout shift): portrait media + title/meta/price lines, same card chrome
 * (rounded-lg, border, shadow-soft). ProductCard (Task 1.6) is built to match.
 */
export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-soft", className)}
    >
      <Skeleton className="aspect-[3/4] w-full rounded-none bg-muted" />
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-4 w-3/4 bg-muted" />
        <Skeleton className="h-3 w-1/2 bg-muted" />
        <Skeleton className="mt-1 h-4 w-1/3 bg-muted" />
      </div>
    </div>
  );
}

/** Generic grid of card skeletons (2→3→4 cols, matching the catalog grid §4.3). */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-busy
      className="grid grid-cols-2 gap-x-[14px] gap-y-[18px] sm:grid-cols-3 sm:gap-x-[22px] sm:gap-y-[26px] xl:grid-cols-4"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}
