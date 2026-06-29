"use client";

import { ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLogout } from "@/lib/hooks/use-logout";
import type { UserRole } from "@/lib/rbac";
import { Link } from "@/i18n/navigation";

interface AuthMenuProps {
  role: UserRole | null;
  userName: string | null;
}

/**
 * Role-aware account control (DESIGN_RULES §5 Navigation). Logged out: ghost
 * Login + the single rose-gold primary CTA (Register — the view's one primary,
 * §2.3). Logged in: an account dropdown (dashboard + logout).
 */
export function AuthMenu({ role, userName }: AuthMenuProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth.logout");
  const { logout, pending } = useLogout();

  if (!role) {
    return (
      <div className="flex items-center gap-3">
        <Button
          asChild
          variant="ghost"
          className="h-11 px-2 text-body-sm font-medium text-foreground hover:bg-transparent hover:text-primary-deep"
        >
          <Link href="/login">{t("login")}</Link>
        </Button>
        {/* The view's single rose-gold focal action (§2.3): rounded-full pill with a
            whisper-of-gold inset rim and a subtle hover lift (§7). */}
        <Button
          asChild
          className="h-11 rounded-full px-6 text-body-sm shadow-soft ring-1 ring-inset ring-gold/30 transition hover:-translate-y-px hover:bg-primary-deep motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Link href="/register">{t("register")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-2 hover:bg-accent/60">
          {/* Rose-gold avatar = the logged-in focal accent (§2.3). */}
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft"
            aria-hidden
          >
            <UserRound className="h-5 w-5" />
          </span>
          <span className="hidden max-w-[10ch] truncate text-body-sm font-medium text-foreground sm:inline">
            {userName ?? t("account")}
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 shadow-raised">
        <DropdownMenuLabel className="truncate">{userName ?? t("account")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer gap-2">
          <Link href={`/dashboard/${role}`}>
            <LayoutDashboard className="h-4 w-4" aria-hidden />
            {t("dashboard")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void logout();
          }}
          disabled={pending}
          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          {tAuth("action")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
