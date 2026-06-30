import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { RegisterForm } from "@/features/auth/components/RegisterForm";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "auth.register" });
  return { title: t("title") };
}

export default async function RegisterPage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations("auth.register");

  // Arabic headings use the Arabic font; English uses the serif (DESIGN_RULES §3.1).
  const titleFont = params.locale === "ar" ? "font-arabic font-bold" : "font-serif";

  return (
    <div className="w-full">
      <h1 className={cn("text-h2 text-foreground", titleFont)}>{t("title")}</h1>
      <p className="mt-2 text-body-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8">
        <RegisterForm />
      </div>

      <p className="mt-6 text-center text-body-sm text-muted-foreground">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-primary hover:text-primary-deep">
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
