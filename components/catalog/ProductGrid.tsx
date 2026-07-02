import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Catalog grid — 2 → 3 → 4 columns with the Direction-A reference gutters (exact px:
 * 18/14 mobile → 26/22 from sm up; 4 cols at xl ≈ the reference's 1180px). Matches
 * ProductGridSkeleton so there's zero layout shift. DESIGN_RULES §4.3.
 */
export function ProductGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-[14px] gap-y-[18px] sm:grid-cols-3 sm:gap-x-[22px] sm:gap-y-[26px] xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
