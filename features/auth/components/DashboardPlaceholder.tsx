import { getTranslations } from "next-intl/server";

import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { PendingApprovalBanner } from "@/features/auth/components/PendingApprovalBanner";
import type { Profile } from "@/features/auth/queries";

/**
 * Minimal role dashboard landing (Task 0.7). The full role-aware DashboardShell
 * (sidebar, topbar, RoleGuard, widgets) lands in Task 0.10 / Phase 1 — this is
 * the redirect target after login/register and the home for the pending state.
 *
 * Pending sellers/providers (status `pending`) see the awaiting-approval banner;
 * listing actions don't exist yet, so there is nothing to disable here (REQ-AUTH-05).
 */
export async function DashboardPlaceholder({ profile }: { profile: Profile }) {
  const t = await getTranslations("dashboard");

  const isPending =
    profile.status === "pending" && (profile.role === "seller" || profile.role === "provider");
  const heading = profile.full_name
    ? t("welcome", { name: profile.full_name })
    : t("welcomeNoName");

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">
            {t(`roles.${profile.role}`)}
          </p>
          <h1 className="font-serif text-h2 text-foreground">{heading}</h1>
        </div>
        <LogoutButton />
      </header>

      {isPending ? <PendingApprovalBanner /> : null}

      <p className="text-body text-muted-foreground">{t("placeholder")}</p>
    </div>
  );
}
