import type { Database } from "@/lib/database.types";

/** App roles — mirrors the DB `user_role` enum (single source of truth). */
export type UserRole = Database["public"]["Enums"]["user_role"];

/** A role's own dashboard home: `/<locale>/dashboard/<role>`. */
export function dashboardPathForRole(locale: string, role: UserRole): string {
  return `/${locale}/dashboard/${role}`;
}

/** Login route for a locale. */
export function loginPath(locale: string): string {
  return `/${locale}/login`;
}
