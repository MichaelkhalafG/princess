import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

// Minimal dashboard wrapper (Task 0.7). The role-aware DashboardShell — sidebar,
// topbar, RoleGuard — is Task 0.10; RBAC is already enforced in middleware.ts.
export default function DashboardLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(params.locale);

  return (
    <main className="min-h-screen bg-background">
      <div className="container py-12">{children}</div>
    </main>
  );
}
