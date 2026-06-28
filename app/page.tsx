import { Crown } from "lucide-react";

// Scaffold placeholder (Phase 0 · Task 0.1). Replaced by the localized
// marketing landing (app/[locale]/(marketing)/page.tsx) in Task 0.5.
export default function HomePage() {
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-24 text-center">
      <span
        className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-primary shadow-soft"
        aria-hidden
      >
        <Crown className="h-8 w-8" />
      </span>
      <h1 className="font-serif text-h1 text-foreground">Princess</h1>
      <p className="max-w-prose text-body text-muted-foreground">
        Foundation scaffold ready. Localized content arrives in Phase 0 · Task 0.5.
      </p>
    </main>
  );
}
