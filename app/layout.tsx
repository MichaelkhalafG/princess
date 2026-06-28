import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans_Arabic, Inter, Playfair_Display } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

// DESIGN_RULES §3.1 — Inter (body), Playfair Display (serif headings),
// IBM Plex Sans Arabic (Arabic). Self-hosted via next/font (no FOUT — §11).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Princess", template: "%s · Princess" },
  description: "Princess — all-in-one women's marketplace: shop, rent, and book beauty services.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#B76E79",
};

// NOTE: locale + dir (Arabic-first RTL) are introduced in Phase 0 · Task 0.5.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          inter.variable,
          playfair.variable,
          arabic.variable,
          "min-h-screen bg-background font-sans antialiased",
        )}
      >
        {children}
      </body>
    </html>
  );
}
