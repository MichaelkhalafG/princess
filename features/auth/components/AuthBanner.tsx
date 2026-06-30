import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { cn } from "@/lib/utils";

/**
 * "Atelier Line" auth banner — entirely code-drawn (no photos): a warm token
 * gradient (`.auth-banner`), a gold filigree whisper, fine line-art roses, and a
 * centerpiece (logo + gold rule + tagline). The decorative layer mirrors as one
 * unit in RTL (`rtl:-scale-x-100`) so the florals always hug the outer edge; the
 * centerpiece text stays upright. Server component.
 */
export async function AuthBanner() {
  const locale = await getLocale();
  const t = await getTranslations("home");
  const tb = await getTranslations("auth.banner");

  // Arabic uses the Arabic UI font; English uses the serif italic (DESIGN_RULES §3.1).
  const taglineFont = locale === "ar" ? "font-arabic font-bold" : "font-serif italic";

  return (
    <div className="auth-banner relative h-full w-full overflow-hidden">
      {/* Line-art symbol library (defined once, referenced via <use>). */}
      <svg aria-hidden className="absolute h-0 w-0" width="0" height="0">
        <defs>
          <symbol id="line-rose" viewBox="0 0 100 100">
            <g fill="none" stroke="currentColor" strokeWidth="1.7">
              <ellipse cx="50" cy="27" rx="11" ry="22" />
              <ellipse cx="50" cy="27" rx="11" ry="22" transform="rotate(60 50 50)" />
              <ellipse cx="50" cy="27" rx="11" ry="22" transform="rotate(120 50 50)" />
              <ellipse cx="50" cy="27" rx="11" ry="22" transform="rotate(180 50 50)" />
              <ellipse cx="50" cy="27" rx="11" ry="22" transform="rotate(240 50 50)" />
              <ellipse cx="50" cy="27" rx="11" ry="22" transform="rotate(300 50 50)" />
              <ellipse cx="50" cy="39" rx="7" ry="13" transform="rotate(30 50 50)" />
              <ellipse cx="50" cy="39" rx="7" ry="13" transform="rotate(90 50 50)" />
              <ellipse cx="50" cy="39" rx="7" ry="13" transform="rotate(150 50 50)" />
              <ellipse cx="50" cy="39" rx="7" ry="13" transform="rotate(210 50 50)" />
              <ellipse cx="50" cy="39" rx="7" ry="13" transform="rotate(270 50 50)" />
              <ellipse cx="50" cy="39" rx="7" ry="13" transform="rotate(330 50 50)" />
              <circle cx="50" cy="50" r="5.5" />
            </g>
          </symbol>
          <symbol id="line-stem" viewBox="0 0 120 220">
            <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M62 214 C 60 170 57 130 63 92 C 67 64 75 44 88 26" />
              <path d="M60 166 C 41 160 27 166 19 182 C 39 186 54 182 60 166 Z" />
              <path d="M63 124 C 82 116 98 122 106 138 C 86 144 69 140 63 124 Z" />
            </g>
          </symbol>
        </defs>
      </svg>

      {/* Decorative composition — authored for LTR, mirrored as a unit in RTL. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rtl:-scale-x-100">
        <svg
          viewBox="0 0 600 720"
          preserveAspectRatio="xMidYMax slice"
          fill="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* Gold filigree (a whisper). */}
          <path
            d="M-20 150 C 160 70 280 200 440 120 C 520 80 560 100 620 70"
            className="stroke-gold"
            strokeWidth={1.4}
            strokeOpacity={0.5}
          />
          <path
            d="M-10 630 C 160 580 270 660 440 600"
            className="stroke-gold"
            strokeWidth={1.4}
            strokeOpacity={0.32}
          />
          {/* Stem + roses clustered in the outer-bottom corner. */}
          <g className="max-lg:hidden text-primary-deep" opacity={0.5} transform="translate(348 352) rotate(-8)">
            <use href="#line-stem" width={120} height={220} />
          </g>
          <g className="text-primary-deep" opacity={0.92} transform="translate(424 472) scale(1.8)">
            <use href="#line-rose" width={100} height={100} />
          </g>
          <g className="text-primary" opacity={0.8} transform="translate(372 300) scale(1.05)">
            <use href="#line-rose" width={100} height={100} />
          </g>
          <g className="max-lg:hidden text-primary" opacity={0.5} transform="translate(64 64) scale(0.72)">
            <use href="#line-rose" width={100} height={100} />
          </g>
        </svg>
      </div>

      {/* Centerpiece — not mirrored; text stays upright in both directions. */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex items-center gap-3">
          <Image src="/icon.svg" alt="" aria-hidden width={36} height={36} unoptimized className="h-8 w-8 lg:h-9 lg:w-9" />
          <span className="font-serif text-h3 font-semibold text-foreground">{t("brand")}</span>
        </div>
        <span aria-hidden className="block h-px w-9 bg-gradient-to-r from-transparent via-gold to-transparent" />
        <p className={cn("max-w-xs text-body lg:text-h3", taglineFont, "text-foreground")}>{tb("tagline")}</p>
      </div>
    </div>
  );
}
