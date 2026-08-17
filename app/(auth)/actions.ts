"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/rate-limit";

/**
 * Auth server actions.
 *
 * Every one of these runs on the server, so the anon key and the user's
 * credentials never round-trip through client JavaScript we control. Errors
 * come back as plain strings for the form to render — never thrown, because a
 * thrown error in a server action surfaces as a generic failure.
 *
 * EVERY entry point an attacker can hammer is rate limited, by email address AND
 * by caller IP. The OTP paths matter most: a six-digit code is a million
 * combinations, which is hours of unthrottled guessing, and it is the one secret
 * here short enough to walk. See lib/rate-limit.ts.
 */

export type ActionState = { error?: string; ok?: boolean; email?: string };

const emailOf = (form: FormData) => String(form.get("email") ?? "").trim().toLowerCase();

export async function signUp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = emailOf(form);
  const password = String(form.get("password") ?? "");
  const fullName = String(form.get("name") ?? "").trim();

  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const limited = await guard("signUp", email);
  if (!limited.ok) return { error: limited.message, email };

  // Session-creating call: forward the browser's identity so the device list
  // does not show every sign-in as "Server or script".
  const supabase = await createClient(true);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) return { error: error.message, email };

  /**
   * Already registered.
   *
   * Supabase deliberately does not error here — it returns a DECOY user with a
   * fresh id, no session, and an EMPTY `identities` array, so that a stranger
   * cannot use the signup form to discover which addresses have accounts.
   * Verified against a real project: an existing address yields
   * `identities: []` while a genuinely new one yields one identity.
   *
   * Saying so out loud trades a little of that privacy for a user who would
   * otherwise sit on the verification screen waiting for a code that is never
   * coming. The trade is bounded: `guard("signUp", …)` already caps this at
   * 5 attempts an hour per address AND per IP, so it is not a practical way to
   * enumerate anybody.
   */
  if (data.user && (data.user.identities?.length ?? 0) === 0) {
    return { error: "already-registered", email };
  }

  // The profile row is created by the on_auth_user_created trigger, so there is
  // nothing to insert here — and nothing to go wrong if this request dies.
  redirect(`/verify?email=${encodeURIComponent(email)}&flow=signup`);
}

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = emailOf(form);
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/dashboard");

  const limited = await guard("signIn", email);
  if (!limited.ok) return { error: limited.message, email };

  const supabase = await createClient(true);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague: saying "no account with that email" tells an attacker
    // which addresses are registered.
    return { error: "That email and password don't match.", email };
  }

  redirect(next.startsWith("/") ? next : "/dashboard");
}

export async function verifyOtp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = emailOf(form);
  const token = String(form.get("token") ?? "").replace(/\D/g, "");

  // The tightest limit in the app: this is the only secret short enough to guess.
  const limited = await guard("otpVerify", email);
  if (!limited.ok) return { error: limited.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error) return { error: "That code didn't match. Try again.", email };

  redirect("/dashboard");
}

export async function resendOtp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = emailOf(form);

  // Limited hard: the cost of abuse here is somebody else's inbox and our
  // sending reputation, not just our CPU.
  const limited = await guard("otpResend", email);
  if (!limited.ok) return { error: limited.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return error ? { error: error.message, email } : { ok: true, email };
}

/* ── Password recovery ────────────────────────────────────────────────────── */

export async function requestPasswordReset(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = emailOf(form);
  if (!email) return { error: "Enter your email address." };

  const limited = await guard("passwordReset", email);
  if (!limited.ok) return { error: limited.message, email };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);

  /**
   * Deliberately no error branch and no "no account found".
   *
   * Reporting whether an address is registered turns this form into an account
   * enumeration oracle — an attacker submits a list and learns who banks here.
   * The user is told a code was sent either way.
   */
  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

/** Exchanges the recovery code for a session. Only then can the password change. */
export async function verifyRecovery(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = emailOf(form);
  const token = String(form.get("token") ?? "").replace(/\D/g, "");

  // A recovery code takes over an account outright, so it gets the OTP limit.
  const limited = await guard("otpVerify", `recovery:${email}`);
  if (!limited.ok) return { error: limited.message, email };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "recovery" });

  return error ? { error: "That code didn't match. Try again.", email } : { ok: true, email };
}

export async function setNewPassword(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those passwords don't match." };

  const supabase = await createClient();

  // The recovery session from verifyOtp is what authorises this. Without it
  // updateUser has no user to act on and fails — so a code cannot be skipped.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
