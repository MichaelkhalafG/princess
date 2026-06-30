"use client";

import { Inbox } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  /** Reserved — interactive sort wires via an `onSort` prop when a table needs it. */
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getRowId?: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  pagination?: { page: number; total: number; limit: number };
  className?: string;
}

const SKELETON_ROWS = 5;

/**
 * Generic, typed `DataTable<T>` (Decision D4 — in-house, no extra dep). Stripe-style
 * (DESIGN_RULES §5 Tables): airy rows, hairline dividers, sticky `bg-muted` header
 * (caption uppercase), end-aligned numerics (`tabular-nums`), row hover; built-in
 * loading (skeleton rows), EmptyState, and Pagination slots. RTL via logical props.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  isLoading,
  emptyState,
  pagination,
  className,
}: DataTableProps<T>) {
  const t = useTranslations("common");
  const alignClass = (align?: "start" | "end") =>
    align === "end" ? "text-end tabular-nums" : "text-start";

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "text-caption uppercase tracking-wide text-muted-foreground",
                    alignClass(column.align),
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: SKELETON_ROWS }, (_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      <Skeleton className="h-4 w-24 bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  {emptyState ?? <EmptyState icon={Inbox} title={t("empty")} />}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={getRowId ? getRowId(row, index) : index} className="hover:bg-accent/40">
                  {columns.map((column) => (
                    <TableCell key={column.id} className={alignClass(column.align)}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination ? (
        <Pagination page={pagination.page} total={pagination.total} limit={pagination.limit} />
      ) : null}
    </div>
  );
}
