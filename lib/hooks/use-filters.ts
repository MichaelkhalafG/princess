"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

import { usePathname, useRouter } from "@/i18n/navigation";

/** Catalog sort options (must match the read query in Task 1.6 + indexes in 1.1). */
export const SORT_OPTIONS = ["newest", "price_asc", "price_desc", "top_rated"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const DEFAULT_LIMIT = 20;

export interface CatalogFilters {
  category: string | null;
  /** Single max-price ceiling (Direction A slider) → `?maxPrice=N`. */
  maxPrice: number | null;
  /** Rentable-only toggle (CR-01 §B) → `?rentable=1`. */
  rentable: boolean;
  /** Attribute facets keyed by attribute slug → selected option slugs (CR-01 §G). */
  facets: Record<string, string[]>;
  sort: SortOption;
  page: number;
  limit: number;
}

/** URL contract: `?attr_<attributeSlug>=<optionSlug>,<optionSlug>` (multi-valued). */
const FACET_PREFIX = "attr_";

function parseSort(value: string | null): SortOption {
  return (SORT_OPTIONS as readonly string[]).includes(value ?? "") ? (value as SortOption) : "newest";
}

function parseNonNegativeInt(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * Catalog filters as URL searchParams — the SINGLE source of truth (Decision D1).
 * Reads parsed/typed values; setters write via the locale-aware router. Any filter
 * change resets `page` to 1; `setPrice` is debounced 300ms (DESIGN_RULES §11).
 */
export function useFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Always read the latest params (so the debounced price write never clobbers a
  // concurrent category/sort change).
  const paramsRef = useRef(searchParams);
  paramsRef.current = searchParams;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const facets: Record<string, string[]> = {};
  searchParams.forEach((value, key) => {
    if (!key.startsWith(FACET_PREFIX) || !value) return;
    const options = value.split(",").filter(Boolean);
    if (options.length > 0) facets[key.slice(FACET_PREFIX.length)] = options;
  });

  const limitRaw = Number(searchParams.get("limit"));
  const filters: CatalogFilters = {
    category: searchParams.get("category"),
    maxPrice: parseNonNegativeInt(searchParams.get("maxPrice")),
    rentable: searchParams.get("rentable") === "1",
    facets,
    sort: parseSort(searchParams.get("sort")),
    page: ((): number => {
      const n = Number(searchParams.get("page"));
      return Number.isInteger(n) && n >= 1 ? n : 1;
    })(),
    limit: Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : DEFAULT_LIMIT,
  };

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void, resetPage = true) => {
      const params = new URLSearchParams(paramsRef.current.toString());
      mutate(params);
      if (resetPage) params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      commit((params) => {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      });
    },
    [commit],
  );

  const setCategory = useCallback((value: string | null) => setParam("category", value), [setParam]);
  // 'newest' is the default → omit from the URL for clean links.
  const setSort = useCallback(
    (value: SortOption) => setParam("sort", value === "newest" ? null : value),
    [setParam],
  );
  const setPage = useCallback(
    (page: number) => commit((params) => {
      if (page <= 1) params.delete("page");
      else params.set("page", String(page));
    }, false),
    [commit],
  );

  // Single max-price ceiling — debounced so the slider commits on settle, not per drag frame.
  const setMaxPrice = useCallback(
    (value: number | null) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit((params) => {
          if (value === null) params.delete("maxPrice");
          else params.set("maxPrice", String(value));
        });
      }, 300);
    },
    [commit],
  );

  // Toggle a single attribute-facet option (OR within an attribute; AND across
  // attributes is applied by the query). Removes the param when the last one clears.
  const toggleFacet = useCallback(
    (attributeSlug: string, optionSlug: string) => {
      commit((params) => {
        const key = `${FACET_PREFIX}${attributeSlug}`;
        const current = (params.get(key) ?? "").split(",").filter(Boolean);
        const next = current.includes(optionSlug)
          ? current.filter((slug) => slug !== optionSlug)
          : [...current, optionSlug];
        if (next.length === 0) params.delete(key);
        else params.set(key, next.join(","));
      });
    },
    [commit],
  );

  const setRentable = useCallback(
    (on: boolean) => setParam("rentable", on ? "1" : null),
    [setParam],
  );

  const clear = useCallback(() => router.replace(pathname), [router, pathname]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const isActive =
    filters.category !== null ||
    filters.maxPrice !== null ||
    filters.rentable ||
    Object.keys(filters.facets).length > 0 ||
    filters.sort !== "newest";

  return {
    ...filters,
    isActive,
    setCategory,
    setSort,
    setMaxPrice,
    setPage,
    setRentable,
    toggleFacet,
    clear,
  };
}
