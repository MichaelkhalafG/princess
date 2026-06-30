import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { AuthBanner } from "@/features/auth/components/AuthBanner";
import { AuthBrand } from "@/features/auth/components/AuthBrand";

/**
 * "Atelier Line" split-screen auth shell (COMPONENT_TREE §2). DOM order is
 * [form, banner]; a flex row auto-mirrors by `dir` (LTR → form left/banner right,
 * RTL → form right/banner left) — one component, no row-reverse, no duplicate
 * markup. On < lg it stacks: the banner becomes a slim decorative header strip
 * above the form. Form side is RSC; only the forms inside `children` are client.
 */
export default function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  return (
    <main className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* FORM side (order-2 on mobile so the banner strip sits on top). */}
      <section className="order-2 flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:order-none lg:w-1/2 lg:max-w-xl lg:flex-none lg:px-16 lg:py-16">
        <AuthBrand className="mb-8" />
        {children}
      </section>

      {/* BANNER side (slim strip on mobile, full half on lg). */}
      <div className="order-1 h-44 shrink-0 lg:order-none lg:h-auto lg:flex-1">
        <AuthBanner />
      </div>
    </main>
  );
}
