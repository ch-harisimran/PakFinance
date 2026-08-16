import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profile";
import type { Notation } from "@/lib/money";

/**
 * Reads for user-owned data.
 *
 * All of these go through the Supabase client, which carries the signed-in
 * user's JWT — so the RLS policies from migration 0003 apply and a forgotten
 * filter cannot leak another user's rows. Drizzle is deliberately not used
 * here: it connects as `postgres`, which bypasses RLS entirely.
 *
 * Derived figures (loan outstanding, goal progress) are computed here rather
 * than stored, so a ledger and its total can never disagree.
 *
 * Every read is wrapped in React's `cache()`, which dedupes by arguments for the
 * duration of one request. The dashboard layout needs loans and goals for the
 * notification bell and the page beneath it needs the same rows — without this,
 * every screen would fetch them twice.
 */

/**
 * The signed-in user's identity.
 *
 * Falls back to `user_metadata.full_name` — signup writes the name there, and a
 * trigger copies it into `profiles`. If that trigger ever fails, the header
 * should still show a name rather than an empty space.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("full_name,phone,avatar_url,notation,theme")
    .eq("user_id", user.id)
    .maybeSingle();

  const meta = user.user_metadata as { full_name?: string } | undefined;

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: data?.full_name ?? meta?.full_name ?? null,
    phone: data?.phone ?? user.phone ?? null,
    avatarUrl: data?.avatar_url ?? null,
    notation: data?.notation === "subcontinental" ? "subcontinental" : "international",
    theme: data?.theme ?? "dark",
    lastSignInAt: user.last_sign_in_at ?? null,
  };
});

/**
 * The signed-in user's number notation, for the compact formatters.
 *
 * Threaded through as an explicit prop rather than read from a context or an
 * ambient store: half the components that format money are server components and
 * half are client components, and a prop is the one mechanism both understand.
 * Cached, so asking for it on every screen costs nothing after the first call.
 */
export const getNotation = cache(async (): Promise<Notation> => {
  const profile = await getProfile();
  return profile?.notation ?? "international";
});

export interface AccountRow {
  id: string;
  name: string;
  kind: string;
  masked_number: string | null;
  balance_paisa: number;
  as_of: string;
}

export interface TransactionRow {
  id: string;
  label: string;
  category: string | null;
  amount_paisa: number;
  occurred_at: string;
  account_id: string | null;
}

export interface LoanRow {
  id: string;
  name: string;
  lender: string | null;
  kind: string;
  direction: string;
  principal_paisa: number;
  markup_rate: string | null;
  installment_paisa: number | null;
  tenure_months: number | null;
  start_date: string;
  due_day: number | null;
  due_date: string | null;
  reminder_enabled: boolean;
  reminder_days_before: number;
  is_settled: boolean;
  loan_payments: { id: string; amount_paisa: number; principal_paisa: number | null; markup_paisa: number | null; paid_at: string }[];
}

export interface GoalRow {
  id: string;
  name: string;
  category: string | null;
  target_paisa: number;
  target_date: string | null;
  status: string;
  goal_contributions: { id: string; amount_paisa: number; occurred_at: string }[];
}

export const getAccounts = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id,name,kind,masked_number,balance_paisa,as_of")
    .eq("is_active", true)
    .order("created_at");
  return (data ?? []) as AccountRow[];
});

export const getTransactions = cache(async (limit = 50) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("id,label,category,amount_paisa,occurred_at,account_id")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as TransactionRow[];
});

export const getLoans = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("loans")
    .select(
      "id,name,lender,kind,direction,principal_paisa,markup_rate,installment_paisa,tenure_months,start_date,due_day,due_date,reminder_enabled,reminder_days_before,is_settled,loan_payments(id,amount_paisa,principal_paisa,markup_paisa,paid_at)",
    )
    .order("created_at");
  return (data ?? []) as LoanRow[];
});

export const getGoals = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("goals")
    .select(
      "id,name,category,target_paisa,target_date,status,goal_contributions(id,amount_paisa,occurred_at)",
    )
    .order("created_at");
  return (data ?? []) as GoalRow[];
});

/* ── Derivations ──────────────────────────────────────────────────────────── */

export function loanOutstanding(loan: LoanRow) {
  const repaid = loan.loan_payments.reduce((s, p) => s + p.amount_paisa, 0);
  const remaining = Math.max(0, loan.principal_paisa - repaid);
  return {
    repaidPaisa: repaid,
    remainingPaisa: remaining,
    repaidPct: loan.principal_paisa ? (repaid / loan.principal_paisa) * 100 : 0,
  };
}

export function goalProgress(goal: GoalRow) {
  const saved = goal.goal_contributions.reduce((s, c) => s + c.amount_paisa, 0);
  const pct = goal.target_paisa ? Math.min(100, (saved / goal.target_paisa) * 100) : 0;

  // Contribution needed each month to still land on the target date. This is
  // the number that turns a wish into a plan, so it drives the on-track flag
  // rather than progress alone — a goal can be 90% funded and still behind.
  let monthlyNeeded = 0;
  let onTrack = true;
  if (goal.target_date) {
    const months = Math.max(
      1,
      Math.round((new Date(goal.target_date).getTime() - Date.now()) / (30.44 * 864e5)),
    );
    monthlyNeeded = Math.max(0, Math.ceil((goal.target_paisa - saved) / months));
    const paceSoFar = goal.goal_contributions.length
      ? saved / goal.goal_contributions.length
      : 0;
    onTrack = saved >= goal.target_paisa || paceSoFar >= monthlyNeeded * 0.9;
  }

  return { savedPaisa: saved, pct, monthlyNeededPaisa: monthlyNeeded, onTrack };
}

/** Cash-flow totals for a calendar month, from the transaction ledger. */
export function cashFlow(txns: TransactionRow[], month = new Date()) {
  const y = month.getFullYear();
  const m = month.getMonth();
  const inMonth = txns.filter((t) => {
    const d = new Date(t.occurred_at);
    return d.getFullYear() === y && d.getMonth() === m;
  });
  const income = inMonth.filter((t) => t.amount_paisa > 0).reduce((s, t) => s + t.amount_paisa, 0);
  const expenses = inMonth
    .filter((t) => t.amount_paisa < 0)
    .reduce((s, t) => s + Math.abs(t.amount_paisa), 0);

  const byCategory = new Map<string, number>();
  for (const t of inMonth) {
    if (t.amount_paisa >= 0) continue;
    const key = t.category?.trim() || "Other";
    byCategory.set(key, (byCategory.get(key) ?? 0) + Math.abs(t.amount_paisa));
  }

  return {
    incomePaisa: income,
    expensesPaisa: expenses,
    netPaisa: income - expenses,
    count: inMonth.length,
    categories: [...byCategory.entries()]
      .map(([key, value]) => ({ key, value, pct: expenses ? (value / expenses) * 100 : 0 }))
      .sort((a, b) => b.value - a.value),
  };
}
