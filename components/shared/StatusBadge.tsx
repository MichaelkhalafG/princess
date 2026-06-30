"use client";

import { CheckCircle2, Circle, EyeOff, type LucideIcon, PencilLine, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type StatusTone = "success" | "warning" | "destructive" | "info" | "neutral";

// Functional 10%-tint variants (DESIGN_RULES §2.3) — never color-only (icon + text, §10).
const TONE_CLASS: Record<StatusTone, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  destructive: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

/**
 * Status → tone + icon. Covers `listing_status` now; extend this map (+ a
 * `status.*` message) for order/booking/rental/request statuses later — callers
 * don't change. Label comes from `messages.status.<status>`.
 */
const STATUS_CONFIG: Record<string, { tone: StatusTone; Icon: LucideIcon }> = {
  active: { tone: "success", Icon: CheckCircle2 },
  draft: { tone: "neutral", Icon: PencilLine },
  inactive: { tone: "warning", Icon: EyeOff },
  rejected: { tone: "destructive", Icon: XCircle },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const t = useTranslations("status");
  const config = STATUS_CONFIG[status] ?? { tone: "neutral" as const, Icon: Circle };
  const label = status in STATUS_CONFIG ? t(status) : status;
  const { Icon } = config;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-caption font-medium",
        TONE_CLASS[config.tone],
        className,
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </span>
  );
}
