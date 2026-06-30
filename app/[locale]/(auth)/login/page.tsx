import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LoginForm } from "@/features/auth/components/LoginForm";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "auth.login" });
  return { title: t("title") };
}

export default async function LoginPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations("auth.login");

  // Arabic headings use the Arabic font; English uses the serif (DESIGN_RULES §3.1).
  const titleFont = params.locale === "ar" ? "font-arabic font-bold" : "font-serif";

  return (
    <div className="w-full">
      <h1 className={cn("text-h2 text-foreground", titleFont)}>{t("title")}</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8">
        <LoginForm />
      </div>

      <p className="mt-6 text-center text-body-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-primary hover:text-primary-deep">
          {t("registerLink")}
        </Link>
      </p>
    </div>
  );
}
