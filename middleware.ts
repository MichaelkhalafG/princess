import { createServerClient } from "@supabase/ssr";
import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import type { Database } from "@/lib/database.types";
import { dashboardPathForRole, loginPath } from "@/lib/rbac";

// next-intl locale handler (locale negotiation + prefixing).
const intlMiddleware = createMiddleware(routing);

/**
 * Composed middleware (SYSTEM_ARCHITECTURE §5/§7, CLAUDE_RULES §5):
 *   1. next-intl locale handling (base response — may redirect/rewrite).
 *   2. Supabase session refresh (anon key + user cookies; service-role NEVER here).
 *   3. App-layer RBAC for /<locale>/dashboard/* (RLS remains the PRIMARY guard).
 *
 * This is the second RBAC layer; the DB's RLS policies are authoritative.
 */
export default async function middleware(request: NextRequest) {
  // 1) Locale negotiation — base response we attach refreshed auth cookies to.
  const response = intlMiddleware(request);

  // 2) Supabase session refresh. Uses the ANON key + the user's cookies only.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase public env vars in middleware: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // @supabase/ssr: call getUser() immediately after creating the client — no logic
  // in between — so the token refresh is never accidentally skipped.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3) RBAC guard for /<locale>/dashboard/*.
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const maybeLocale = segments[0];
  const isDashboard = hasLocale(routing.locales, maybeLocale ?? "") && segments[1] === "dashboard";

  if (isDashboard && maybeLocale) {
    const locale = maybeLocale;

    // Unauthenticated → login (locale preserved).
    if (!user) {
      return redirectTo(request, response, loginPath(locale));
    }

    // Read the role from the DB (RLS self-select) — NEVER trust a client cookie/claim.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;
    if (!role) {
      return redirectTo(request, response, loginPath(locale));
    }

    // Segment after "dashboard" must equal the user's role; otherwise send them
    // to their own dashboard (covers missing/foreign/unknown areas).
    const area = segments[2];
    if (area !== role) {
      return redirectTo(request, response, dashboardPathForRole(locale, role));
    }
  }

  return response;
}

/** Redirect while preserving the locale + the refreshed auth cookies from `base`. */
function redirectTo(request: NextRequest, base: NextResponse, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  base.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  // Process all app routes EXCEPT Next internals, Vercel internals, API routes
  // (including the un-gated Tap webhook at /api/payments/webhook), and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
