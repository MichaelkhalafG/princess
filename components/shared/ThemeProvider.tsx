"use client";

import type { ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * App theme provider (shadcn pattern over next-themes). Ships LIGHT only — dark
 * mode is Phase 2 (DESIGN_RULES §2.2). The `class` attribute strategy is wired
 * now so a dark theme can be enabled later by swapping tokens, no refactor.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
