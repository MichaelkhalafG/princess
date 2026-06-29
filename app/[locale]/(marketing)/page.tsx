import { Crown, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Landing hero (Phase 0). Premium, spacious, layered (DESIGN_RULES §1/§4): a warm
// peach→ivory wash, the brand emblem, a serif display headline, and a single
// rose-gold primary CTA (§2.3) beside a secondary. All copy from messages/*.
export default async function HomePage({ params }: { params: { locale: string } }) {
  setRequestLocale(params.locale);
  const t = await getTranslations("home");

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-muted to-background">
      <div className="container flex flex-col items-center gap-8 py-24 text-center lg:py-32">
        <span
          className="grid h-20 w-20 place-items-center rounded-full bg-secondary text-primary shadow-soft"
          aria-hidden
        >
          <Crown className="h-10 w-10" />
        </span>

        <span className="inline-flex items-center gap-2 text-caption uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-4 w-4 text-gold" aria-hidden />
          {t("eyebrow")}
        </span>

        <h1 className="max-w-3xl font-serif text-display text-foreground">{t("tagline")}</h1>

        <p className="max-w-xl text-body-lg text-muted-foreground">{t("description")}</p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="shadow-soft">
            <Link href="/products">{t("cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/services">{t("explore")}</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
