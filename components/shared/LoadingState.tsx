"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface LoadingStateProps {
  /** Override the default "Loading…" label. */
  label?: string;
  className?: string;
}

/**
 * Inline loading indicator (DESIGN_RULES §5 — spinners for short waits/actions;
 * prefer skeletons for content). Announces itself via `role="status"`.
 */
export function LoadingState({ label, className }: LoadingStateProps) {
  const t = useTranslations("common");
  const text = label ?? t("loading");

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
      <span className="text-body-sm">{text}</span>
    </div>
  );
}
