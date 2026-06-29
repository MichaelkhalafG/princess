import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * "Awaiting admin approval" banner for pending sellers/providers (REQ-AUTH-05).
 * The icon is wrapped (not a direct `>svg` child) so the Alert's absolute icon
 * layout doesn't apply — keeping the flow RTL-safe via logical flex (§13).
 */
export async function PendingApprovalBanner() {
  const t = await getTranslations("auth.pending");

  return (
    <Alert variant="warning" data-testid="pending-banner">
      <div className="flex items-start gap-3">
        <Clock className="mt-1 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <AlertTitle>{t("title")}</AlertTitle>
          <AlertDescription className="text-foreground/80">{t("description")}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
