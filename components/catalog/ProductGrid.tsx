import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Catalog grid layout — 2 → 3 → 4 columns (DESIGN_RULES §4.3). Matches ProductGridSkeleton. */
export function ProductGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}
