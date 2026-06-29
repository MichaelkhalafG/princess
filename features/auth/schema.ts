import { z } from "zod";

/**
 * Auth validation schemas (CLAUDE_RULES §5 — server-side Zod on every route;
 * §2 — one source of truth for validation). Shared by the Route Handlers and the
 * client forms so the rules can never drift.
 *
 * Schemas are built via a factory that takes a translator so messages are
 * localized on the client (next-intl) while the server passes an identity
 * function (the raw key) — the server returns its own `{ error: { code } }`
 * envelope, so its messages only ever appear in `details`.
 */
export type TranslateFn = (key: string) => string;

/** Self-registerable roles. `admin` is intentionally excluded (REQ-AUTH: admins are not self-registerable). */
export const REGISTER_ROLES = ["customer", "seller", "provider"] as const;
export type RegisterRole = (typeof REGISTER_ROLES)[number];

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt hard limit — reject before the gateway does.
const NAME_MIN = 2;
const NAME_MAX = 80;

export function buildLoginSchema(t: TranslateFn) {
  return z.object({
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
    password: z.string().min(1, t("passwordRequired")),
  });
}

export type LoginInput = z.infer<ReturnType<typeof buildLoginSchema>>;

export function buildRegisterSchema(t: TranslateFn) {
  return z.object({
    full_name: z.string().trim().min(NAME_MIN, t("fullNameMin")).max(NAME_MAX, t("fullNameMax")),
    email: z.string().min(1, t("emailRequired")).email(t("emailInvalid")),
    password: z.string().min(PASSWORD_MIN, t("passwordMin")).max(PASSWORD_MAX, t("passwordMax")),
    role: z.enum(REGISTER_ROLES, { message: t("roleRequired") }),
  });
}

export type RegisterInput = z.infer<ReturnType<typeof buildRegisterSchema>>;

/** Identity translator for the server — validation messages become their raw keys. */
export const rawKey: TranslateFn = (key) => key;
