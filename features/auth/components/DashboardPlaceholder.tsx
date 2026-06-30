import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { LogoutButton } from "@/features/auth/components/LogoutButton";
import { PendingApprovalBanner } from "@/features/auth/components/PendingApprovalBanner";
import type { Profile } from "@/features/auth/queries";

/**
 * Role dashboard shell — header (welcome + logout) + body. Pending sellers/providers
 * see the awaiting-approval banner and nothing else (REQ-AUTH-05). Active roles get
 * `children` (e.g. the seller ProductManager); roles without dashboard content yet
 * fall back to the placeholder line.
 */
export async function DashboardPlaceholder({
  profile,
  children,
}: {
  profile: Profile;
  children?: ReactNode;
}) {
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

      {isPending ? (
        <PendingApprovalBanner />
      ) : (
        children ?? <p className="text-body text-muted-foreground">{t("placeholder")}</p>
      )}
    </div>
  );
}
