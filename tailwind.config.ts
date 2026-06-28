import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Princess design system — DESIGN_RULES.md §2 (color), §3 (type), §4 (layout/radii/shadows).
// Components reference SEMANTIC TOKENS only — never raw hex (DESIGN_RULES §15/§17).
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      // DESIGN_RULES §4.2: 16 / 24 / 32px horizontal padding; cap at 1280.
      padding: { DEFAULT: "1rem", md: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          deep: "hsl(var(--primary-deep) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          foreground: "hsl(var(--success-foreground) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning) / <alpha-value>)",
          foreground: "hsl(var(--warning-foreground) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--info) / <alpha-value>)",
          foreground: "hsl(var(--info-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        gold: "hsl(var(--gold) / <alpha-value>)",
        mist: "hsl(var(--mist) / <alpha-value>)",
      },
      borderRadius: {
        sm: "0.5rem", // 8px
        md: "0.75rem", // 12px — buttons/inputs
        lg: "1rem", // 16px — cards/dialogs
        xl: "1.5rem", // 24px
      },
      boxShadow: {
        // DESIGN_RULES §4.5 — exactly three soft, warm shadows. No pure-black.
        soft: "0 1px 2px rgba(42,34,40,0.04), 0 4px 12px rgba(183,110,121,0.06)",
        raised: "0 8px 24px rgba(42,34,40,0.08)",
        overlay: "0 16px 48px rgba(42,34,40,0.16)",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "var(--font-arabic)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        serif: ["var(--font-playfair)", "ui-serif", "Georgia", "serif"],
        arabic: ["var(--font-arabic)", "ui-sans-serif", "sans-serif"],
      },
      fontSize: {
        // DESIGN_RULES §3.2 type scale.
        display: ["clamp(3rem, 5vw, 3.75rem)", { lineHeight: "1.15", fontWeight: "700" }],
        h1: ["clamp(2.25rem, 4vw, 2.5rem)", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["clamp(1.75rem, 3vw, 2rem)", { lineHeight: "1.2", fontWeight: "600" }],
        h3: ["1.5rem", { lineHeight: "1.25", fontWeight: "600" }],
        h4: ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.8125rem", { lineHeight: "1.4", fontWeight: "500" }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
