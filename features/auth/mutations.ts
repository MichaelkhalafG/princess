import "server-only";

import type { Session, User } from "@supabase/supabase-js";

import { ERROR_CODES, type ErrorCode } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import type { LoginInput, RegisterInput } from "./schema";

/**
 * Auth mutations (CLAUDE_RULES §3 — feature data layer; routes stay thin).
 *
 * Results are discriminated unions rather than thrown errors so Route Handlers
 * can map cleanly to the `{ error: { code, message } }` envelope. We never write
 * to `profiles` from here — the `handle_new_user` DB trigger owns profile
 * creation and derives `status` from the role (REQ-AUTH-05).
 */
export type AuthFailure = { ok: false; code: ErrorCode; message: string; status: number };

type AuthSuccess = { ok: true; user: User | null; session: Session | null };
export type AuthResult = AuthSuccess | AuthFailure;

/** Create an auth user; role + full_name go into user metadata for the signup trigger. */
export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // `handle_new_user` reads raw_user_meta_data -> 'role' / 'full_name' (0001_foundation.sql).
      data: { role: input.role, full_name: input.full_name },
    },
  });

  if (error) {
    // Supabase surfaces an explicit error when confirmations are disabled.
    if (/already registered|already exists/i.test(error.message)) {
      return {
        ok: false,
        code: ERROR_CODES.EMAIL_TAKEN,
        message: "Email already registered",
        status: 409,
      };
    }
    return { ok: false, code: ERROR_CODES.INTERNAL, message: error.message, status: 500 };
  }

  // With email confirmations ON, Supabase obfuscates re-signups: a user is
  // returned with an empty `identities` array and no session. Treat as taken.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return {
      ok: false,
      code: ERROR_CODES.EMAIL_TAKEN,
      message: "Email already registered",
      status: 409,
    };
  }

  return { ok: true, user: data.user, session: data.session };
}

/** Email/password sign-in → sets the session cookie on the response. */
export async function signIn(input: LoginInput): Promise<AuthResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error) {
    return {
      ok: false,
      code: ERROR_CODES.INVALID_CREDENTIALS,
      message: "Invalid email or password",
      status: 401,
    };
  }

  return { ok: true, user: data.user, session: data.session };
}

/** Clear the session cookie. */
export async function signOut(): Promise<{ ok: true } | AuthFailure> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { ok: false, code: ERROR_CODES.INTERNAL, message: error.message, status: 500 };
  }
  return { ok: true };
}
