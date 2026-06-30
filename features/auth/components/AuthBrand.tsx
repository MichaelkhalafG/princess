import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

/** Brand lockup for the auth form side: Rose-Jewel mark (public/icon.svg) + serif wordmark. */
export async function AuthBrand({ className }: { className?: string }) {
  const t = await getTranslations("home");

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Image src="/icon.svg" alt="" aria-hidden width={32} height={32} unoptimized className="h-8 w-8" />
      <span className="font-serif text-h4 font-semibold text-foreground">{t("brand")}</span>
    </div>
  );
}
