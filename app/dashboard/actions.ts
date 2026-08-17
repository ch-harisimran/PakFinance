"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { toPaisa } from "@/lib/money";

/**
 * Writes for user-owned data.
 *
 * Every insert stamps `user_id` from the verified session — never from the
 * form. A client-supplied owner id is the oldest privilege-escalation bug
 * there is, and RLS would reject it anyway, but the server should not be
 * offering it up in the first place.
 */

export type FormState = { error?: string; ok?: boolean };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k).replace(/,/g, ""));

/**
 * Repayment shape and reminder settings, shared by the add and edit paths.
 *
 * A loan is repaid monthly OR in one go, never both, so whichever date field
 * does not apply is explicitly nulled — otherwise switching an existing loan
 * from monthly to one-off would leave a stale `due_day` behind and the reminder
 * job would have two candidate dates to choose between.
 */
function repaymentFields(form: FormData) {
  const monthly = str(form, "repayment") !== "once";
  const daysBefore = num(form, "reminder_days_before");

  return {
    due_day: monthly && str(form, "due_day") ? num(form, "due_day") : null,
    due_date: !monthly && str(form, "due_date") ? str(form, "due_date") : null,
    reminder_enabled: form.get("reminder_enabled") === "1",
    reminder_days_before: Number.isFinite(daysBefore) && daysBefore >= 0 ? daysBefore : 3,
  };
}

async function withUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return { supabase, userId: user.id };
}

function fail(e: unknown): FormState {
  const message = e instanceof Error ? e.message : "Something went wrong.";
  return { error: message };
}

/**
 * Shared tail of every update.
 *
 * Scoped by `user_id` as well as `id`. RLS already makes it impossible to touch
 * another user's row, but a query that says what it means is worth more than a
 * policy you have to go and look up — and if the policy is ever loosened, this
 * still holds.
 *
 * `.select("id")` is what turns a silent no-op into an error: an UPDATE that
 * matches nothing succeeds with zero rows, so without this the dialog would
 * close on a record that was deleted in another tab and report success.
 */
async function applyUpdate(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  paths: string[],
): Promise<FormState> {
  const { supabase, userId } = await withUser();
  if (!id) return { error: "Missing record id." };

  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "That record no longer exists." };

  for (const p of paths) revalidatePath(p);
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ── Profile and preferences ──────────────────────────────────────────────── */

/**
 * `profiles` is keyed by `user_id`, not `id`, so it does not go through
 * `applyUpdate`. It is also the one table where the row is guaranteed to exist —
 * the `on_auth_user_created` trigger writes it.
 */

/**
 * Write fields onto the caller's own profile row.
 *
 * An UPDATE, falling back to an INSERT only when the row is genuinely absent.
 * This used to be a single `upsert`, which PostgREST issues as
 * `INSERT ... ON CONFLICT DO UPDATE` — and that needs privileges the client no
 * longer holds: migration 0014 revoked table-wide INSERT so the PIN verifier
 * could never be written from a browser, and per-column grants do not satisfy
 * an upsert. Verified: plain UPDATE and plain INSERT both pass, upsert returns
 * 42501.
 *
 * The two steps keep exactly what the upsert was there for — a profile that
 * somehow went missing repairs itself rather than silently refusing to save.
 */
async function saveProfile(
  supabase: Awaited<ReturnType<typeof withUser>>["supabase"],
  userId: string,
  fields: Record<string, string | null>,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("user_id", userId)
    .select("user_id");

  if (error) return { error: error.message };
  if ((data ?? []).length > 0) return {};

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ user_id: userId, ...fields });
  return insertError ? { error: insertError.message } : {};
}

export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const fullName = str(form, "full_name");
    if (!fullName) return { error: "Your name can't be blank." };

    const { error } = await saveProfile(supabase, userId, {
      full_name: fullName,
      phone: str(form, "phone") || null,
    });
    if (error) return { error };

    // The name is also carried in the auth token's metadata, which is what the
    // app falls back to. Leaving it stale would make the header disagree with
    // the settings screen after a token refresh.
    await supabase.auth.updateUser({ data: { full_name: fullName } });

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePreferences(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const notation = str(form, "notation") === "subcontinental" ? "subcontinental" : "international";
    const theme = ["light", "dark", "system"].includes(str(form, "theme"))
      ? str(form, "theme")
      : "dark";

    const { error } = await saveProfile(supabase, userId, { notation, theme });
    if (error) return { error };

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Change the address the account signs in with.
 *
 * Supabase sends a confirmation to BOTH addresses when "Secure email change" is
 * on, and the change only lands once they are followed. Nothing here updates the
 * email directly — this only starts the flow, which is why the UI says "pending"
 * rather than "changed".
 *
 * The password is re-checked first. An email address is the account's recovery
 * route: whoever controls it can reset the password and take everything.
 */
export async function requestEmailChange(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await withUser();
    const next = str(form, "email").toLowerCase();
    const password = str(form, "password");

    if (!next || !next.includes("@")) return { error: "Enter a valid email address." };
    if (!password) return { error: "Enter your password to confirm." };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Not signed in." };
    if (next === user.email.toLowerCase()) {
      return { error: "That is already your email address." };
    }

    const { error: wrong } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (wrong) return { error: "That password isn't right." };

    const { error } = await supabase.auth.updateUser(
      { email: next },
      { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard/settings` },
    );
    if (error) return { error: error.message };

    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Sign one other device out. */
export async function revokeSession(sessionId: string): Promise<FormState> {
  try {
    await withUser();
    // Derives the owner itself; see the note in lib/queries-sessions.ts.
    const { revokeSession: revoke } = await import("@/lib/queries-sessions");

    const removed = await revoke(sessionId);
    if (!removed) return { error: "That session has already ended." };

    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Where confirmation links should come back to.
 *
 * Behind a proxy the request host is the only thing that knows the public
 * origin, so it wins; NEXT_PUBLIC_SITE_URL is the fallback for contexts with no
 * request, and localhost is the last resort for development.
 */
async function siteOrigin(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

const AVATAR_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Profile photo.
 *
 * Stored at `avatars/<user id>/<file>`; the Storage policies in migration 0006
 * key on that first path segment, so a user can only write inside their own
 * folder. The size and type checks here are a courtesy that produces a readable
 * message — the bucket enforces both regardless of what this code does.
 *
 * The filename carries a timestamp rather than being a fixed `avatar.png`,
 * because the public URL would otherwise stay identical after a change and every
 * cache between here and the browser would keep serving the old face.
 */
export async function uploadAvatar(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const file = form.get("avatar");

    if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
    if (file.size > AVATAR_MAX_BYTES) return { error: "That image is over 2 MB — pick a smaller one." };

    const ext = AVATAR_TYPES[file.type];
    if (!ext) return { error: "Use a PNG, JPEG or WebP image." };

    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upload } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upload) return { error: upload.message };

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error } = await saveProfile(supabase, userId, { avatar_url: publicUrl });
    if (error) return { error };

    // Sweep the previous photos. Without this every change leaves a file behind
    // that nothing references and nobody will ever look for.
    const { data: existing } = await supabase.storage.from("avatars").list(userId);
    const stale = (existing ?? [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== path);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeAvatar(): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();

    const { data: existing } = await supabase.storage.from("avatars").list(userId);
    if (existing?.length) {
      await supabase.storage.from("avatars").remove(existing.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await saveProfile(supabase, userId, { avatar_url: null });
    if (error) return { error };

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Change password.
 *
 * Supabase would let a live session set a new password without proving the old
 * one. That is a real risk on a shared or unlocked machine, so the current
 * password is verified first by signing in with it.
 */
export async function changePassword(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await withUser();
    const current = str(form, "current_password");
    const next = str(form, "new_password");
    const confirm = str(form, "confirm_password");

    if (!current) return { error: "Enter your current password." };
    if (next.length < 8) return { error: "The new password must be at least 8 characters." };
    if (next !== confirm) return { error: "The two new passwords don't match." };
    if (next === current) return { error: "The new password is the same as the old one." };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Not signed in." };

    // An unlocked laptop is the realistic threat here, and the current-password
    // check is what stands in the way — so it gets the same throttling as the
    // login form rather than unlimited guesses from inside a live session.
    const { guard } = await import("@/lib/rate-limit");
    const limited = await guard("passwordChange", user.email);
    if (!limited.ok) return { error: limited.message };

    const { error: wrong } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (wrong) return { error: "That current password isn't right." };

    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) return { error: error.message };

    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Delete the account and everything in it. There is no undo.
 *
 * Two gates, both required. The typed email proves the user knows which account
 * they are on — the mistake this prevents is deleting the wrong one on a shared
 * machine. The password proves it is actually them, which matters because an
 * unlocked laptop is the realistic threat and a session cookie alone is not
 * proof of anything.
 *
 * Order matters. Storage objects go first, because `storage.objects.owner` does
 * not cascade — deleting the auth user would orphan the avatar files with no
 * owner left to attribute them to. Every `public` table DOES cascade from
 * `auth.users` (migration 0003), so removing the auth user takes the accounts,
 * transactions, loans, goals, trades and orders with it in one statement.
 */
export async function deleteAccount(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) return { error: "Not signed in." };

    const typed = str(form, "confirm_email").toLowerCase();
    if (typed !== user.email.toLowerCase()) {
      return { error: "That email doesn't match the account you're signed in to." };
    }

    const password = str(form, "password");
    if (!password) return { error: "Enter your password to confirm." };

    const { error: wrong } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });
    if (wrong) return { error: "That password isn't right." };

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    const { data: files } = await admin.storage.from("avatars").list(userId);
    if (files?.length) {
      await admin.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
    }

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { error: error.message };

    // The session now points at a user that no longer exists; clear it rather
    // than leaving a cookie that fails confusingly on the next request.
    await supabase.auth.signOut();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ── Accounts ─────────────────────────────────────────────────────────────── */

export async function addAccount(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const name = str(form, "name");
    if (!name) return { error: "Give the account a name." };

    const { error } = await supabase.from("accounts").insert({
      user_id: userId,
      name,
      kind: str(form, "kind") || "CURRENT",
      // Last four digits only — we never store a full account number.
      masked_number: str(form, "masked") ? str(form, "masked").slice(-4) : null,
      balance_paisa: toPaisa(num(form, "balance") || 0),
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/bank");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAccount(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const name = str(form, "name");
    if (!name) return { error: "Give the account a name." };

    const balancePaisa = toPaisa(num(form, "balance") || 0);
    // `as_of` means "when the user last confirmed this balance", so renaming an
    // account must not make a stale balance look freshly checked. Only a change
    // to the number itself moves the date.
    const changed = balancePaisa !== Number(str(form, "original_balance_paisa"));

    return await applyUpdate(
      "accounts",
      str(form, "id"),
      {
        name,
        kind: str(form, "kind") || "CURRENT",
        masked_number: str(form, "masked") ? str(form, "masked").slice(-4) : null,
        balance_paisa: balancePaisa,
        ...(changed ? { as_of: new Date().toISOString() } : {}),
      },
      ["/dashboard/bank"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── Transactions ─────────────────────────────────────────────────────────── */

export async function addTransaction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const label = str(form, "label");
    const amount = num(form, "amount");
    if (!label) return { error: "What was it for?" };
    if (!amount) return { error: "Enter an amount." };

    // The form asks for a positive number plus a direction, rather than
    // expecting the user to type a minus sign.
    const signed = str(form, "direction") === "out" ? -Math.abs(amount) : Math.abs(amount);

    const { error } = await supabase.from("transactions").insert({
      user_id: userId,
      account_id: str(form, "account_id") || null,
      label,
      category: str(form, "category") || null,
      amount_paisa: toPaisa(signed),
      occurred_at: new Date(str(form, "occurred_at") || Date.now()).toISOString(),
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard/bank");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTransaction(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const label = str(form, "label");
    const amount = num(form, "amount");
    if (!label) return { error: "What was it for?" };
    if (!amount) return { error: "Enter an amount." };

    const signed = str(form, "direction") === "out" ? -Math.abs(amount) : Math.abs(amount);

    return await applyUpdate(
      "transactions",
      str(form, "id"),
      {
        account_id: str(form, "account_id") || null,
        label,
        category: str(form, "category") || null,
        amount_paisa: toPaisa(signed),
        occurred_at: new Date(str(form, "occurred_at") || Date.now()).toISOString(),
      },
      ["/dashboard/transactions", "/dashboard/bank"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── Loans ────────────────────────────────────────────────────────────────── */

export async function addLoan(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const name = str(form, "name");
    const principal = num(form, "principal");
    if (!name) return { error: "Give the loan a name." };
    if (!principal) return { error: "Enter the principal amount." };

    const { error } = await supabase.from("loans").insert({
      user_id: userId,
      name,
      lender: str(form, "lender") || null,
      kind: str(form, "kind") || "PERSONAL",
      direction: str(form, "direction") || "BORROWED",
      principal_paisa: toPaisa(principal),
      markup_rate: str(form, "markup") ? String(num(form, "markup")) : null,
      tenure_months: str(form, "tenure") ? num(form, "tenure") : null,
      installment_paisa: str(form, "installment") ? toPaisa(num(form, "installment")) : null,
      start_date: str(form, "start_date") || new Date().toISOString().slice(0, 10),
      ...repaymentFields(form),
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addLoanPayment(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const amount = num(form, "amount");
    if (!amount) return { error: "Enter the payment amount." };

    const { error } = await supabase.from("loan_payments").insert({
      user_id: userId,
      loan_id: str(form, "loan_id"),
      amount_paisa: toPaisa(amount),
      principal_paisa: str(form, "principal") ? toPaisa(num(form, "principal")) : null,
      markup_paisa: str(form, "markup") ? toPaisa(num(form, "markup")) : null,
      paid_at: str(form, "paid_at") || new Date().toISOString().slice(0, 10),
      note: str(form, "note") || null,
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/loans");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLoan(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const name = str(form, "name");
    const principal = num(form, "principal");
    if (!name) return { error: "Give the loan a name." };
    if (!principal) return { error: "Enter the principal amount." };

    return await applyUpdate(
      "loans",
      str(form, "id"),
      {
        name,
        lender: str(form, "lender") || null,
        kind: str(form, "kind") || "PERSONAL",
        principal_paisa: toPaisa(principal),
        markup_rate: str(form, "markup") ? String(num(form, "markup")) : null,
        tenure_months: str(form, "tenure") ? num(form, "tenure") : null,
        installment_paisa: str(form, "installment") ? toPaisa(num(form, "installment")) : null,
        start_date: str(form, "start_date") || undefined,
        ...repaymentFields(form),
      },
      ["/dashboard/loans"],
    );
  } catch (e) {
    return fail(e);
  }
}

export async function updateLoanPayment(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const amount = num(form, "amount");
    if (!amount) return { error: "Enter the payment amount." };

    return await applyUpdate(
      "loan_payments",
      str(form, "id"),
      {
        amount_paisa: toPaisa(amount),
        principal_paisa: str(form, "principal") ? toPaisa(num(form, "principal")) : null,
        markup_paisa: str(form, "markup") ? toPaisa(num(form, "markup")) : null,
        paid_at: str(form, "paid_at") || undefined,
      },
      ["/dashboard/loans"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── Goals ────────────────────────────────────────────────────────────────── */

export async function addGoal(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const name = str(form, "name");
    const target = num(form, "target");
    if (!name) return { error: "Give the goal a name." };
    if (!target) return { error: "Enter a target amount." };

    const { error } = await supabase.from("goals").insert({
      user_id: userId,
      name,
      category: str(form, "category") || null,
      target_paisa: toPaisa(target),
      target_date: str(form, "target_date") || null,
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addContribution(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const amount = num(form, "amount");
    if (!amount) return { error: "Enter an amount." };

    const { error } = await supabase.from("goal_contributions").insert({
      user_id: userId,
      goal_id: str(form, "goal_id"),
      amount_paisa: toPaisa(amount),
      occurred_at: str(form, "occurred_at") || new Date().toISOString().slice(0, 10),
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/goals");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateGoal(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const name = str(form, "name");
    const target = num(form, "target");
    if (!name) return { error: "Give the goal a name." };
    if (!target) return { error: "Enter a target amount." };

    return await applyUpdate(
      "goals",
      str(form, "id"),
      {
        name,
        category: str(form, "category") || null,
        target_paisa: toPaisa(target),
        target_date: str(form, "target_date") || null,
      },
      ["/dashboard/goals"],
    );
  } catch (e) {
    return fail(e);
  }
}

export async function updateContribution(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const amount = num(form, "amount");
    if (!amount) return { error: "Enter an amount." };

    return await applyUpdate(
      "goal_contributions",
      str(form, "id"),
      {
        amount_paisa: toPaisa(amount),
        occurred_at: str(form, "occurred_at") || undefined,
      },
      ["/dashboard/goals"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── PSX trades ───────────────────────────────────────────────────────────── */

export async function addTrade(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const symbol = str(form, "symbol").toUpperCase();
    const quantity = num(form, "quantity");
    const price = num(form, "price");
    const type = str(form, "type") || "BUY";

    if (!symbol) return { error: "Pick a scrip." };
    if (!quantity || quantity <= 0) return { error: "Enter a quantity." };
    // Bonus shares arrive free, so a zero price is legitimate there and only
    // there — everything else needs a price to compute cost basis from.
    if (type !== "BONUS" && (!price || price <= 0)) return { error: "Enter a price." };

    const { error } = await supabase.from("stock_transactions").insert({
      user_id: userId,
      symbol,
      type,
      quantity: String(quantity),
      price_paisa: toPaisa(price || 0),
      commission_paisa: toPaisa(num(form, "commission") || 0),
      other_charges_paisa: toPaisa(num(form, "charges") || 0),
      traded_at: str(form, "traded_at") || new Date().toISOString().slice(0, 10),
      note: str(form, "note") || null,
    });

    if (error) {
      // The FK to market.securities is what rejects a symbol PSX has never
      // listed — a typo, rather than a database fault.
      return {
        error: error.message.includes("foreign key")
          ? `${symbol} isn't a listed PSX symbol.`
          : error.message,
      };
    }

    revalidatePath("/dashboard/psx");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateTrade(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const symbol = str(form, "symbol").toUpperCase();
    const quantity = num(form, "quantity");
    const price = num(form, "price");
    const type = str(form, "type") || "BUY";

    if (!symbol) return { error: "Pick a scrip." };
    if (!quantity || quantity <= 0) return { error: "Enter a quantity." };
    if (type !== "BONUS" && (!price || price <= 0)) return { error: "Enter a price." };

    const result = await applyUpdate(
      "stock_transactions",
      str(form, "id"),
      {
        symbol,
        type,
        quantity: String(quantity),
        price_paisa: toPaisa(price || 0),
        commission_paisa: toPaisa(num(form, "commission") || 0),
        other_charges_paisa: toPaisa(num(form, "charges") || 0),
        traded_at: str(form, "traded_at") || undefined,
      },
      ["/dashboard/psx"],
    );

    // Same FK as the insert path: a symbol PSX never listed is a typo, not a
    // database fault.
    if (result.error?.includes("foreign key")) {
      return { error: `${symbol} isn't a listed PSX symbol.` };
    }
    return result;
  } catch (e) {
    return fail(e);
  }
}

/** Symbol autocomplete for the trade form. */
export async function lookupSymbols(query: string) {
  await withUser();
  const { searchSecurities } = await import("@/lib/queries-psx");
  return searchSecurities(query);
}

/* ── Mutual funds ─────────────────────────────────────────────────────────── */

export async function addFundOrder(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const { createFund, findFundByName } = await import("@/lib/queries-funds");

    let fundId = str(form, "fund_id");

    // "Add a fund" path: the catalogue is a starter list, not exhaustive, so a
    // user whose fund is missing must not be stuck.
    if (!fundId) {
      const name = str(form, "new_name");
      if (!name) return { error: "Pick a fund, or add a new one." };
      fundId =
        (await findFundByName(name)) ??
        (await createFund({
          name,
          amc: str(form, "new_amc") || "Unknown",
          category: str(form, "new_category") || "Other",
          isIslamic: form.get("new_islamic") === "1",
          userId,
        }));
    }

    const units = num(form, "units");
    const nav = num(form, "nav");
    const type = str(form, "type") || "BUY";

    if (!units || units <= 0) return { error: "Enter the number of units." };
    // A reinvested dividend arrives as units at no cost, so NAV may be blank
    // there and only there.
    if (type !== "DIVIDEND" && (!nav || nav <= 0)) return { error: "Enter the NAV." };

    const { error } = await supabase.from("fund_transactions").insert({
      user_id: userId,
      fund_id: fundId,
      type,
      units: String(units),
      nav_paisa: toPaisa(nav || 0),
      amount_paisa: toPaisa((nav || 0) * units),
      traded_at: str(form, "traded_at") || new Date().toISOString().slice(0, 10),
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/funds");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Edit a fund order. The fund itself is not editable — an order against a
 * different fund is a different order, and silently moving units between funds
 * would corrupt both positions' cost basis. Delete and re-enter instead.
 */
export async function updateFundOrder(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const units = num(form, "units");
    const nav = num(form, "nav");
    const type = str(form, "type") || "BUY";

    if (!units || units <= 0) return { error: "Enter the number of units." };
    if (type !== "DIVIDEND" && (!nav || nav <= 0)) return { error: "Enter the NAV." };

    return await applyUpdate(
      "fund_transactions",
      str(form, "id"),
      {
        type,
        units: String(units),
        nav_paisa: toPaisa(nav || 0),
        amount_paisa: toPaisa((nav || 0) * units),
        traded_at: str(form, "traded_at") || undefined,
      },
      ["/dashboard/funds"],
    );
  } catch (e) {
    return fail(e);
  }
}

/** Catalogue autocomplete for the order form. */
export async function lookupFunds(query: string) {
  const { userId } = await withUser();
  const { searchFunds } = await import("@/lib/queries-funds");
  return searchFunds(query, userId);
}

/* ── Other assets ─────────────────────────────────────────────────────────── */

export async function addAsset(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const name = str(form, "name");
    if (!name) return { error: "Give it a name." };

    const { error } = await supabase.from("assets").insert({
      user_id: userId,
      kind: str(form, "kind") || "OTHER",
      name,
      quantity: str(form, "quantity") ? String(num(form, "quantity")) : null,
      unit: str(form, "unit") || null,
      cost_paisa: str(form, "cost") ? toPaisa(num(form, "cost")) : null,
      value_paisa: toPaisa(num(form, "value") || 0),
      as_of: str(form, "as_of") || new Date().toISOString().slice(0, 10),
      zakatable: form.get("zakatable") === "1",
      note: str(form, "note") || null,
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/assets");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAsset(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const name = str(form, "name");
    if (!name) return { error: "Give it a name." };

    return await applyUpdate(
      "assets",
      str(form, "id"),
      {
        kind: str(form, "kind") || "OTHER",
        name,
        quantity: str(form, "quantity") ? String(num(form, "quantity")) : null,
        unit: str(form, "unit") || null,
        cost_paisa: str(form, "cost") ? toPaisa(num(form, "cost")) : null,
        value_paisa: toPaisa(num(form, "value") || 0),
        as_of: str(form, "as_of") || undefined,
        zakatable: form.get("zakatable") === "1",
        note: str(form, "note") || null,
      },
      ["/dashboard/assets"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── Budgets ──────────────────────────────────────────────────────────────── */

export async function addBudget(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const category = str(form, "category");
    const limit = num(form, "limit");
    if (!category) return { error: "Which category?" };
    if (!limit || limit <= 0) return { error: "Enter a monthly limit." };

    /**
     * One budget per category — setting a limit twice adjusts it rather than
     * creating a second, invisible ceiling.
     *
     * Resolved here rather than with `upsert`, because the unique index is on
     * the EXPRESSION `(user_id, lower(category))` and PostgREST's `onConflict`
     * only names plain columns: `ON CONFLICT (user_id, category)` matches no
     * index and Postgres rejects the statement outright, which made it
     * impossible to create a budget at all. Weakening the index instead would
     * let "Groceries" and "groceries" become two ceilings on one category,
     * while `budgetStatus` — which lowercases before matching spend — would
     * only ever fill one of them. Same trade-off as `upsertFunds` in
     * lib/market/sync-nav.ts, which keeps its expression index too.
     *
     * The read is RLS-scoped like every other user-facing query, so it can only
     * ever see this user's rows; matching in JS avoids `ilike`, which would
     * treat a category containing % or _ as a pattern.
     */
    const { data: mine, error: readError } = await supabase
      .from("budgets")
      .select("id,category")
      .eq("user_id", userId);
    if (readError) return { error: readError.message };

    const key = category.trim().toLowerCase();
    const existing = (mine ?? []).find((b) => String(b.category).trim().toLowerCase() === key);

    const { error } = existing
      ? await supabase
          .from("budgets")
          .update({ category, limit_paisa: toPaisa(limit), is_active: true })
          .eq("id", existing.id)
      : await supabase
          .from("budgets")
          .insert({ user_id: userId, category, limit_paisa: toPaisa(limit), is_active: true });

    // 23505 is the unique index rejecting a duplicate that appeared between the
    // read and the write — two submits racing. Say what happened rather than
    // showing the raw constraint name.
    if (error) {
      return {
        error:
          error.code === "23505"
            ? "You already have a budget for that category."
            : error.message,
      };
    }

    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateBudget(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const limit = num(form, "limit");
    if (!limit || limit <= 0) return { error: "Enter a monthly limit." };

    return await applyUpdate(
      "budgets",
      str(form, "id"),
      { category: str(form, "category"), limit_paisa: toPaisa(limit) },
      ["/dashboard/transactions"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── Recurring transactions ───────────────────────────────────────────────── */

function recurringFields(form: FormData) {
  const amount = Math.abs(num(form, "amount"));
  const signed = str(form, "direction") === "in" ? amount : -amount;

  return {
    account_id: str(form, "account_id") || null,
    label: str(form, "label"),
    category: str(form, "category") || null,
    amount_paisa: toPaisa(signed),
    cadence: str(form, "cadence") || "MONTHLY",
    day_of_period: num(form, "day_of_period") || 1,
    start_date: str(form, "start_date") || new Date().toISOString().slice(0, 10),
    end_date: str(form, "end_date") || null,
  };
}

export async function addRecurring(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const fields = recurringFields(form);
    if (!fields.label) return { error: "What is it for?" };
    if (!fields.amount_paisa) return { error: "Enter an amount." };

    const { error } = await supabase
      .from("recurring_transactions")
      .insert({ user_id: userId, ...fields });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/transactions");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateRecurring(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const fields = recurringFields(form);
    if (!fields.label) return { error: "What is it for?" };
    if (!fields.amount_paisa) return { error: "Enter an amount." };

    return await applyUpdate(
      "recurring_transactions",
      str(form, "id"),
      { ...fields, is_active: form.get("is_active") !== "0" },
      ["/dashboard/transactions"],
    );
  } catch (e) {
    return fail(e);
  }
}

/* ── Committees ───────────────────────────────────────────────────────────── */

function committeeFields(form: FormData) {
  return {
    name: str(form, "name"),
    organiser: str(form, "organiser") || null,
    members: num(form, "members"),
    monthly_paisa: toPaisa(num(form, "monthly")),
    start_month: str(form, "start_month") || new Date().toISOString().slice(0, 10),
    payout_position: str(form, "payout_position") ? num(form, "payout_position") : null,
    payout_received: form.get("payout_received") === "1",
    payout_date: str(form, "payout_date") || null,
  };
}

export async function addCommittee(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const fields = committeeFields(form);

    if (!fields.name) return { error: "Give the committee a name." };
    if (!fields.members || fields.members < 2) return { error: "A committee needs at least 2 members." };
    if (!fields.monthly_paisa) return { error: "Enter the monthly contribution." };
    if (fields.payout_position && fields.payout_position > fields.members) {
      return { error: `Your turn cannot be after member ${fields.members}.` };
    }

    const { error } = await supabase.from("committees").insert({ user_id: userId, ...fields });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/committees");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateCommittee(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const fields = committeeFields(form);
    if (!fields.name) return { error: "Give the committee a name." };
    if (fields.payout_position && fields.payout_position > fields.members) {
      return { error: `Your turn cannot be after member ${fields.members}.` };
    }

    return await applyUpdate("committees", str(form, "id"), fields, ["/dashboard/committees"]);
  } catch (e) {
    return fail(e);
  }
}

export async function addCommitteePayment(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const amount = num(form, "amount");
    if (!amount) return { error: "Enter the amount paid." };

    const { error } = await supabase.from("committee_payments").insert({
      user_id: userId,
      committee_id: str(form, "committee_id"),
      amount_paisa: toPaisa(amount),
      paid_at: str(form, "paid_at") || new Date().toISOString().slice(0, 10),
      note: str(form, "note") || null,
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/committees");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ── Zakat ────────────────────────────────────────────────────────────────── */

/**
 * Record an assessment.
 *
 * The nisab is stored as it was on the day, not recomputed later: it tracks the
 * metal price, so re-deriving an old year against today's would give a different
 * answer to the one the user acted on.
 */
export async function saveZakatAssessment(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();

    const { error } = await supabase.from("zakat_assessments").insert({
      user_id: userId,
      assessed_on: str(form, "assessed_on") || new Date().toISOString().slice(0, 10),
      nisab_paisa: num(form, "nisab_paisa") || 0,
      assets_paisa: num(form, "assets_paisa") || 0,
      deductions_paisa: num(form, "deductions_paisa") || 0,
      zakatable_paisa: num(form, "zakatable_paisa") || 0,
      due_paisa: num(form, "due_paisa") || 0,
      paid_paisa: str(form, "paid") ? toPaisa(num(form, "paid")) : 0,
      note: str(form, "note") || null,
    });
    if (error) return { error: error.message };

    revalidatePath("/dashboard/zakat");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ── Deletes ──────────────────────────────────────────────────────────────── */

/**
 * Delete one user-owned row.
 *
 * Two deletes cascade, and the confirm dialogs say so before the user commits:
 * removing a loan takes its payment history with it, and removing a goal takes
 * its contributions. Deleting an account is the gentler case — `transactions`
 * references it with ON DELETE SET NULL, so the money movements survive and
 * merely lose their account label.
 */
export async function deleteRow(table: string, id: string): Promise<FormState> {
  const allowed = new Set([
    "accounts",
    "transactions",
    "loans",
    "loan_payments",
    "goals",
    "goal_contributions",
    "stock_transactions",
    "fund_transactions",
    "assets",
    "budgets",
    "recurring_transactions",
    "committees",
    "committee_payments",
    "zakat_assessments",
  ]);
  // Never interpolate a caller-supplied table name without an allowlist.
  if (!allowed.has(table)) return { error: "Unknown table." };

  try {
    const { supabase, userId } = await withUser();
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id");

    if (error) return { error: error.message };
    if (!data?.length) return { error: "That record no longer exists." };

    // Deletes ripple further than edits do — an account removal changes the
    // dashboard, the bank screen and every transaction's label — so the whole
    // dashboard subtree is revalidated rather than a guessed list of paths.
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
