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

export async function updateAccountBalance(_prev: FormState, form: FormData): Promise<FormState> {
  try {
    const { supabase } = await withUser();
    const { error } = await supabase
      .from("accounts")
      .update({ balance_paisa: toPaisa(num(form, "balance")), as_of: new Date().toISOString() })
      .eq("id", str(form, "id"));
    if (error) return { error: error.message };

    revalidatePath("/dashboard/bank");
    revalidatePath("/dashboard");
    return { ok: true };
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
      due_day: str(form, "due_day") ? num(form, "due_day") : null,
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

/** Catalogue autocomplete for the order form. */
export async function lookupFunds(query: string) {
  const { userId } = await withUser();
  const { searchFunds } = await import("@/lib/queries-funds");
  return searchFunds(query, userId);
}

/* ── Deletes ──────────────────────────────────────────────────────────────── */

export async function deleteRow(table: string, id: string) {
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
  if (!allowed.has(table)) throw new Error("Unknown table.");

  const { supabase } = await withUser();
  await supabase.from(table).delete().eq("id", id);
  revalidatePath("/dashboard", "layout");
}
