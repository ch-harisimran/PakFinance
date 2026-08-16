import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { committeePosition, committeeBalanceSheet, type Committee } from "@/lib/committees";
import { describeCadence, type Cadence } from "@/lib/recurring";

/**
 * Reads for the balance-sheet items that are not shares, funds or bank
 * balances: other assets, committees, budgets, recurring rules and Zakat.
 *
 * Through the Supabase client like every other user-owned read, so RLS applies.
 * Cached per request, so a screen and the layout above it share one fetch.
 */

export interface AssetRow {
  id: string;
  kind: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  cost_paisa: number | null;
  value_paisa: number;
  as_of: string;
  zakatable: boolean;
  note: string | null;
}

export interface BudgetRow {
  id: string;
  category: string;
  limit_paisa: number;
  is_active: boolean;
}

export interface RecurringRow {
  id: string;
  account_id: string | null;
  label: string;
  category: string | null;
  amount_paisa: number;
  cadence: Cadence;
  day_of_period: number;
  start_date: string;
  end_date: string | null;
  last_posted_on: string | null;
  is_active: boolean;
}

export interface CommitteeRow {
  id: string;
  name: string;
  organiser: string | null;
  members: number;
  monthly_paisa: number;
  start_month: string;
  payout_position: number | null;
  payout_received: boolean;
  payout_date: string | null;
  is_settled: boolean;
  committee_payments: { id: string; amount_paisa: number; paid_at: string }[];
}

export interface ZakatRow {
  id: string;
  assessed_on: string;
  nisab_paisa: number;
  assets_paisa: number;
  deductions_paisa: number;
  zakatable_paisa: number;
  due_paisa: number;
  paid_paisa: number;
}

export const getAssets = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("id,kind,name,quantity,unit,cost_paisa,value_paisa,as_of,zakatable,note")
    .order("value_paisa", { ascending: false });
  return (data ?? []) as AssetRow[];
});

/**
 * Screens want the budgets you are actually running; an export wants every row
 * you ever created, retired ones included. `cache()` keys on the argument, so
 * the two callers do not share a fetch and neither sees the other's filter.
 */
export const getBudgets = cache(async (activeOnly = true) => {
  const supabase = await createClient();
  let q = supabase.from("budgets").select("id,category,limit_paisa,is_active");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q.order("category");
  return (data ?? []) as BudgetRow[];
});

export const getRecurring = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_transactions")
    .select(
      "id,account_id,label,category,amount_paisa,cadence,day_of_period,start_date,end_date,last_posted_on,is_active",
    )
    .order("created_at");
  return (data ?? []) as RecurringRow[];
});

export const getCommittees = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("committees")
    .select(
      "id,name,organiser,members,monthly_paisa,start_month,payout_position,payout_received,payout_date,is_settled,committee_payments(id,amount_paisa,paid_at)",
    )
    .order("start_month", { ascending: false });
  return (data ?? []) as CommitteeRow[];
});

/** The screen shows a dozen years; `limit: 0` lifts the cap for the export. */
export const getZakatHistory = cache(async (limit = 12) => {
  const supabase = await createClient();
  let q = supabase
    .from("zakat_assessments")
    .select("id,assessed_on,nisab_paisa,assets_paisa,deductions_paisa,zakatable_paisa,due_paisa,paid_paisa")
    .order("assessed_on", { ascending: false });
  if (limit > 0) q = q.limit(limit);
  const { data } = await q;
  return (data ?? []) as ZakatRow[];
});

/* ── Derivations ──────────────────────────────────────────────────────────── */

/** Committee rows with their position worked out, and the balance-sheet split. */
export function committeesWithPosition(rows: CommitteeRow[], today: string) {
  const withPosition = rows.map((c) => {
    const paid = c.committee_payments.reduce((s, p) => s + p.amount_paisa, 0);
    const shape: Committee = {
      members: c.members,
      monthlyPaisa: c.monthly_paisa,
      startMonth: c.start_month,
      payoutPosition: c.payout_position,
      payoutReceived: c.payout_received,
      isSettled: c.is_settled,
    };
    return { ...c, ...committeePosition(shape, paid, today) };
  });

  const sheet = committeeBalanceSheet(
    withPosition,
    withPosition.map((c) => c.payout_received),
  );

  return { rows: withPosition, ...sheet };
}

/**
 * Budget status for the current month.
 *
 * Spend comes from the transaction ledger, matched on category, so a budget and
 * its actual can never disagree. Categories are compared case-insensitively —
 * "Rent" and "rent" are one budget, not two.
 */
export function budgetStatus(
  budgets: BudgetRow[],
  categories: { key: string; value: number }[],
) {
  const spendByCategory = new Map(categories.map((c) => [c.key.trim().toLowerCase(), c.value]));

  return budgets
    .map((b) => {
      const spentPaisa = spendByCategory.get(b.category.trim().toLowerCase()) ?? 0;
      const pct = b.limit_paisa > 0 ? (spentPaisa / b.limit_paisa) * 100 : 0;
      return {
        ...b,
        spentPaisa,
        remainingPaisa: b.limit_paisa - spentPaisa,
        pct,
        over: spentPaisa > b.limit_paisa,
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

/** Human summary of a rule, for the list. */
export function describeRecurring(r: RecurringRow): string {
  return describeCadence({ cadence: r.cadence, dayOfPeriod: r.day_of_period });
}
