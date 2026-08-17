"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { guard } from "@/lib/rate-limit";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_HOURS,
  isAdminEmail,
  setAdminPassword,
  unlockAdmin,
  lockAdmin,
  hasAdminSession,
} from "@/lib/admin/auth";

/**
 * Admin console actions.
 *
 * Every one of these re-establishes both facts from scratch — the signed-in
 * email matches ADMIN_EMAIL, and (except when setting the password) a console
 * session is open. Nothing trusts a prior check or anything the form sends: a
 * server action is a public HTTP endpoint, so "the page only renders for the
 * admin" is not a control.
 */

export type AdminActionState = { error?: string; ok?: boolean };

/** The signed-in user, but only if they are the configured admin. */
async function requireAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

async function setCookie(token: string) {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    // Strict, not Lax: nothing should ever navigate into the console from
    // another site carrying this.
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_SESSION_HOURS * 3600,
  });
}

export async function setPasswordAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const user = await requireAdminUser();
  if (!user) return { error: "Not available." };

  const limited = await guard("adminUnlock", user.id);
  if (!limited.ok) return { error: limited.message };

  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  const current = String(form.get("current") ?? "") || undefined;

  if (next !== confirm) return { error: "Those two didn't match." };

  const result = await setAdminPassword(user.id, next, current);
  if (!result.ok) return { error: result.error };

  await setCookie(result.token);
  revalidatePath("/admin");
  return { ok: true };
}

export async function unlockAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const user = await requireAdminUser();
  if (!user) return { error: "Not available." };

  const limited = await guard("adminUnlock", user.id);
  if (!limited.ok) return { error: limited.message };

  const result = await unlockAdmin(user.id, String(form.get("password") ?? ""));
  if (!result.ok) return { error: result.error };

  await setCookie(result.token);
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Passed straight to `<form action>`, so it resolves to void — a form action may
 * not return a value. Locking has nothing to report anyway: the page re-renders
 * into the gate.
 */
export async function lockAction(): Promise<void> {
  const user = await requireAdminUser();
  if (!user) return;

  await lockAdmin(user.id);
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  revalidatePath("/admin");
}

/**
 * Import a saved MUFAP report.
 *
 * The file arrives through a server action rather than a route handler so the
 * console session cookie — scoped to /admin — is what authorises it.
 */
export async function importNavAction(
  _prev: AdminActionState,
  form: FormData,
): Promise<AdminActionState> {
  const user = await requireAdminUser();
  if (!user) return { error: "Not available." };

  const jar = await cookies();
  if (!(await hasAdminSession(user.id, jar.get(ADMIN_COOKIE)?.value))) {
    return { error: "The console session has expired. Unlock again." };
  }

  const file = form.get("report");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose the saved .html file." };
  // Matches `serverActions.bodySizeLimit` in next.config.ts and stays under
  // Vercel's 4.5 MB request cap, so an oversized file is reported here rather
  // than rejected upstream where nothing of ours can explain it.
  if (file.size > 4 * 1024 * 1024) {
    return { error: `That file is ${(file.size / 1048576).toFixed(1)} MB; the limit is 4 MB.` };
  }

  const html = await file.text();
  if (!html.trim()) return { error: "That file was empty." };

  try {
    const { runNavSync } = await import("@/lib/market/sync-nav");
    // `force`: the 12-hour guard exists to stop the scheduled job hammering
    // MUFAP. Someone who has just saved the report has already decided.
    const result = await runNavSync({ force: true, html });

    revalidatePath("/admin");
    revalidatePath("/dashboard/funds");
    revalidatePath("/dashboard");

    return result.action === "synced"
      ? {
          ok: true,
          error: undefined,
        }
      : { error: `Skipped: ${result.reason}` };
  } catch (e) {
    // The parser throws on a page that is not the report — the wrong tab saved,
    // or the Cloudflare challenge page itself.
    return { error: `Could not read that as a MUFAP report: ${(e as Error).message.slice(0, 200)}` };
  }
}
