import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

// Centered auth shell — no nav (COMPONENT_TREE §2). Forms/auth max width per
// DESIGN_RULES §4.2. Soft muted backdrop sets the calm, premium tone.
export default function AuthLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
