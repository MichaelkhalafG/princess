"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { Link, usePathname } from "@/i18n/navigation";

interface PaginationProps {
  page: number;
  /** Total item count (server-provided). */
  total: number;
  limit: number;
  className?: string;
}

/** Page list with ellipsis: 1 … cur-1 cur cur+1 … last (all shown when ≤ 7). */
function pageList(current: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

const cellBase =
  "inline-flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-body-sm transition-colors";

/**
 * Server-driven, URL-based pagination (Decisions D1/D2). Builds page links by
 * merging the current searchParams (so filters/sort persist) and updating `page`;
 * next-intl `Link` keeps the locale prefix. Chevrons mirror in RTL. a11y:
 * `aria-current` on the active page, labeled prev/next, disabled bounds as spans.
 */
export function Pagination({ page, total, limit, className }: PaginationProps) {
  const t = useTranslations("pagination");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / limit));
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    return `${pathname}?${params.toString()}`;
  };

  const atStart = page <= 1;
  const atEnd = page >= totalPages;

  return (
    <nav aria-label={t("label")} className={cn("flex items-center justify-center gap-1", className)}>
      {atStart ? (
        <span className={cn(cellBase, "text-mist")} aria-disabled>
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </span>
      ) : (
        <Link href={hrefFor(page - 1)} aria-label={t("previous")} className={cn(cellBase, "text-foreground hover:bg-accent")}>
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      )}

      {pageList(page, totalPages).map((entry, index) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${index}`} className={cn(cellBase, "text-muted-foreground")} aria-hidden>
            …
          </span>
        ) : entry === page ? (
          <span key={entry} aria-current="page" className={cn(cellBase, "bg-primary font-medium text-primary-foreground shadow-soft")}>
            {entry}
          </span>
        ) : (
          <Link key={entry} href={hrefFor(entry)} aria-label={t("goToPage", { page: entry })} className={cn(cellBase, "text-foreground hover:bg-accent")}>
            {entry}
          </Link>
        ),
      )}

      {atEnd ? (
        <span className={cn(cellBase, "text-mist")} aria-disabled>
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </span>
      ) : (
        <Link href={hrefFor(page + 1)} aria-label={t("next")} className={cn(cellBase, "text-foreground hover:bg-accent")}>
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
