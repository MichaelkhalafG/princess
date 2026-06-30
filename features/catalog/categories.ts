import { unstable_cache } from "next/cache";

import type { Tables } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/public";

export type Category = Tables<"categories">;
export type CategoryKind = Category["kind"]; // 'product' | 'service' (text check in DB)

/**
 * Cached public read of categories (DATABASE.md §3.2 — public SELECT via RLS).
 * Wrapped in `unstable_cache` tagged `categories` (Decision D5): catalog reads stay
 * fast, and `PUT /api/admin/categories` busts it with `revalidateTag('categories')`.
 * Uses the cookie-less public client (safe inside `unstable_cache`).
 */
const fetchCategories = unstable_cache(
  async (kind: CategoryKind | "all"): Promise<Category[]> => {
    const supabase = createPublicClient();
    const base = supabase.from("categories").select("*").order("sort_order", { ascending: true });
    const { data } = kind === "all" ? await base : await base.eq("kind", kind);
    return data ?? [];
  },
  ["categories"],
  { tags: ["categories"] },
);

export function getCategories(options?: { kind?: CategoryKind }): Promise<Category[]> {
  return fetchCategories(options?.kind ?? "all");
}
