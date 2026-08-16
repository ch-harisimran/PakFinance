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
 * the `on_auth_user_created` trigger writes it — but upsert rather than update,
 * so a profile that somehow went missing repairs itself instead of silently
 * refusing to save.
 */
export async function updateProfile(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase, userId } = await withUser();
    const fullName = str(form, "full_name");
    if (!fullName) return { error: "Your name can't be blank." };

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, full_name: fullName, phone: str(form, "phone") || null });
    if (error) return { error: error.message };

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

    const { error } = await supabase
      .from("profiles")
      .upsert({ user_id: userId, notation, theme });
    if (error) return { error: error.message };

    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
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

    const { error } = await supabase.from("profiles").upsert({ user_id: userId, avatar_url: publicUrl });
    if (error) return { error: error.message };

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

    const { error } = await supabase.from("profiles").upsert({ user_id: userId, avatar_url: null });
    if (error) return { error: error.message };

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
