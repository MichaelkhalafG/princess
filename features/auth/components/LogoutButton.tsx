"use client";

import { Loader2, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { postJson } from "@/features/auth/client";
import { useToast } from "@/lib/hooks/use-toast";
import { useRouter } from "@/i18n/navigation";

/** Logs out via POST /api/auth/logout, then returns to the login page. */
export function LogoutButton() {
  const t = useTranslations("auth.logout");
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    const result = await postJson("/api/auth/logout");
    setPending(false);
    if (!result.ok) return;
    toast({ description: t("success") });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="outline" onClick={onLogout} disabled={pending} data-testid="logout-button">
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
      {t("action")}
    </Button>
  );
}
