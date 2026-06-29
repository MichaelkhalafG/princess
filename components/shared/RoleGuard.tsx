import { ShieldAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { getSessionProfile } from "@/features/auth/queries";
import type { UserRole } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";

interface RoleGuardProps {
  /** Roles permitted to see `children`. */
  allow: UserRole[];
  children: ReactNode;
}

/**
 * App-layer role gate (REQ-NFR-03) — defense-in-depth behind RLS + middleware,
 * NOT the primary control. Renders children only when the session role is
 * allowed; otherwise a localized "forbidden" EmptyState with a way back.
 */
export async function RoleGuard({ allow, children }: RoleGuardProps) {
  const profile = await getSessionProfile();

  if (profile && allow.includes(profile.role)) {
    return <>{children}</>;
  }

  const t = await getTranslations("common.forbidden");
  return (
    <EmptyState
      icon={ShieldAlert}
      title={t("title")}
      description={t("description")}
      action={
        <Button asChild>
          <Link href="/">{t("cta")}</Link>
        </Button>
      }
    />
  );
}
