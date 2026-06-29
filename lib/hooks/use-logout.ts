"use client";

import { useState } from "react";

import { postJson } from "@/features/auth/client";
import { useRouter } from "@/i18n/navigation";

/**
 * Shared logout action for the navbar/account menus (CLAUDE_RULES §2 — one source).
 * Clears the session via the API, then returns to the localized home and refreshes
 * server components so the new (logged-out) session is reflected.
 */
export function useLogout() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await postJson("/api/auth/logout");
    setPending(false);
    router.replace("/");
    router.refresh();
  }

  return { logout, pending };
}
