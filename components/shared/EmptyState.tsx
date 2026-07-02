import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Primary CTA (e.g. a Button) — never leave an empty state without a next step (§5). */
  action?: ReactNode;
  className?: string;
}

/**
 * Empty/zero state (DESIGN_RULES §5) — never a bare "No data". A Lucide icon in a
 * peach circle, a serif headline, one guidance line, and a primary CTA. Strings
 * are passed in (localized by the caller — no hardcoded copy).
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      <span
        className="grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-muted to-secondary text-primary shadow-soft"
        aria-hidden
      >
        <Icon className="h-9 w-9" />
      </span>
      <div className="flex flex-col gap-2">
        <p className="font-serif text-h4 text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-body-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
