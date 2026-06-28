import { Crown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";

// Scaffold landing (Phase 0 · Task 0.5). Every string comes from messages/*
// (CLAUDE_RULES §7 — zero hardcoded UI text). Server component by default.
export default async function HomePage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-24 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary shadow-soft"
        aria-hidden
      >
        <Crown className="h-8 w-8" />
      </span>
      <h1 className="font-serif text-h1 text-foreground">{t("brand")}</h1>
      <p className="text-body-lg text-foreground">{t("tagline")}</p>
      <p className="max-w-prose text-body text-muted-foreground">{t("description")}</p>
      <Button size="lg">{t("cta")}</Button>
    </main>
  );
}
