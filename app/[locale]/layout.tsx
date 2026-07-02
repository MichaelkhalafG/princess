import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { El_Messiri, Marcellus } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import { ThemeProvider } from "@/components/shared/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import "../globals.css";

// DESIGN_RULES §3.1 — the app uses EXACTLY TWO fonts: Marcellus for ALL Latin text
// (headings, body, UI, prices, wordmark) and El Messiri for ALL Arabic text. Nothing else.
// Self-hosted via next/font (no FOUT — §11). Marcellus is regular-weight ONLY (400):
// emphasis comes from size + tracking, and `font-synthesis-weight: none` (globals.css) keeps
// any requested bold from faux-bolding it. El Messiri (Arabic) keeps real 400–700 weights.
const marcellus = Marcellus({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
  display: "swap",
});
const arabic = El_Messiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Princess", template: "%s · Princess" },
  description: "Princess — all-in-one women's marketplace: shop, rent, and book beauty services.",
  manifest: "/manifest.webmanifest",
  // Brand favicon (Version C — Rose Jewel, 16px-safe). Navbar/Footer lockups = Task 0.10.
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#B76E79",
};

// Statically render both locales.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  // Reject unknown locales (deny-by-default for the route segment).
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  // Enable static rendering for this locale.
  setRequestLocale(locale);
  const messages = await getMessages();

  // DESIGN_RULES §13 — Arabic-first RTL; dir flips per locale.
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={cn(
          marcellus.variable,
          arabic.variable,
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider>
            {children}
            <Toaster />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
