/**
 * Shared "Atelier Line" field styling for the auth forms (CLAUDE_RULES §2 — one
 * source). 44px inputs on a pearl surface with a warm hairline border and a soft
 * rose-gold focus ring; the submit is the single rose-gold focal with a whisper
 * gold inset rim. Semantic tokens only.
 */
export const authInputClass =
  "h-11 rounded-md border-input bg-card text-body-sm shadow-none placeholder:text-mist focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20";

export const authLabelClass = "text-caption font-semibold text-muted-foreground";

export const authSubmitClass =
  "mt-2 h-12 w-full rounded-md text-body-sm shadow-soft ring-1 ring-inset ring-gold/30 transition hover:-translate-y-px hover:bg-primary-deep motion-reduce:transition-none motion-reduce:hover:translate-y-0";
