import { createNavigation } from "next-intl/navigation";

import { routing } from "@/i18n/routing";

/**
 * Locale-aware navigation APIs (use these instead of next/link & next/navigation
 * so the active locale prefix is preserved). Consumed by Navbar/LocaleSwitcher (Task 0.10).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
