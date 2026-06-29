/**
 * Primary navigation links (COMPONENT_TREE §8). One source of truth shared by the
 * desktop Navbar, the MobileNav drawer, and the Footer's "Shop" column — avoids
 * duplicating the link list (CLAUDE_RULES §2). `key` indexes `messages.nav.*`;
 * `href` is locale-agnostic (next-intl `Link` prepends the active locale).
 */
export interface NavLink {
  key: "home" | "products" | "rentals" | "services" | "eventPlanners";
  href: string;
}

export const NAV_LINKS: readonly NavLink[] = [
  { key: "home", href: "/" },
  { key: "products", href: "/products" },
  { key: "rentals", href: "/rentals" },
  { key: "services", href: "/services" },
  { key: "eventPlanners", href: "/event-planners" },
] as const;
