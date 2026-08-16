import { paisaFull } from "@/lib/money";

/**
 * Everything the app has to tell you, derived rather than authored.
 *
 * One definition, two surfaces: the "Needs you" panel on the dashboard and the
 * notification bell in the top bar. They were never going to stay in agreement
 * as two copies, and a bell that disagreed with the panel below it is worse than
 * no bell at all.
 *
 * There is no notifications table, deliberately. These facts are already in the
 * data — an installment is due because of `due_day`, a goal is behind because of
 * its contribution pace — so storing them would mean keeping a second copy in
 * sync with the first, and inventing rules for when a stored notification is
 * stale. Deriving on read cannot drift.
 */

export type AlertKind = "due" | "goal" | "setup";

export interface Alert {
  kind: AlertKind;
  title: string;
  detail: string;
  when: string;
  href: string;
  action: string;
}

export interface AlertInput {
  loans: {
    id: string;
    name: string;
    lender: string | null;
    installment_paisa: number | null;
    due_day: number | null;
    /** Set instead of `due_day` when the loan is repaid in one go. */
    due_date: string | null;
    remainingPaisa: number;
  }[];
  goals: {
    id: string;
    name: string;
    onTrack: boolean;
    monthlyNeededPaisa: number;
    target_date: string | null;
  }[];
  /** Drives the setup prompts. Omit to skip them entirely. */
  counts?: { accounts: number; trades: number; funds: number; goals: number };
}

/** Days until the next occurrence of a day-of-month. */
export function daysUntil(dueDay: number, now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (next < now) next.setMonth(next.getMonth() + 1);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 864e5));
}

/** Days until a fixed date. Negative once it is in the past. */
function daysBetween(date: string, now = new Date()): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${date}T00:00:00`) - midnight.getTime()) / 864e5);
}

export function buildAlerts({ loans, goals, counts }: AlertInput): Alert[] {
  const items: Alert[] = [];

  for (const l of loans) {
    if (l.remainingPaisa <= 0) continue;

    // A one-off loan is due on its date; a monthly one on the next occurrence of
    // its due day. Amount follows the same split: the installment where there is
    // one, otherwise everything still owed.
    const days = l.due_date
      ? daysBetween(l.due_date)
      : l.due_day
        ? daysUntil(l.due_day)
        : null;
    if (days === null) continue;

    // Two weeks of notice. Beyond that it is not news, it is a calendar. A date
    // already past still shows — an overdue repayment is the most urgent kind.
    if (days > 14) continue;

    const amount = l.due_date ? l.remainingPaisa : l.installment_paisa;
    if (!amount) continue;

    items.push({
      kind: "due",
      title: l.due_date ? `${l.name} repayment` : `${l.name} installment`,
      detail: `${paisaFull(amount)}${l.lender ? ` to ${l.lender}` : ""}`,
      when:
        days < 0
          ? `Overdue by ${-days} day${days === -1 ? "" : "s"}`
          : days === 0
            ? "Due today"
            : `Due in ${days} day${days === 1 ? "" : "s"}`,
      href: "/dashboard/loans",
      action: "Log payment",
    });
  }

  for (const g of goals) {
    if (g.onTrack || !g.target_date) continue;
    items.push({
      kind: "goal",
      title: `${g.name} is behind schedule`,
      detail: `${paisaFull(g.monthlyNeededPaisa)}/month needed to hit ${g.target_date}`,
      when: "Off track",
      href: "/dashboard/goals",
      action: "Review goal",
    });
  }

  // Setup prompts only while the relevant thing is genuinely absent.
  if (counts) {
    if (!counts.accounts)
      items.push({
        kind: "setup",
        title: "Add a bank account",
        detail: "Track balances and cash flow alongside your investments.",
        when: "Setup",
        href: "/dashboard/bank",
        action: "Add account",
      });
    if (!counts.trades)
      items.push({
        kind: "setup",
        title: "Add your PSX holdings",
        detail: "Five years of closing prices are already loaded — past trades value correctly.",
        when: "Setup",
        href: "/dashboard/psx",
        action: "Add transaction",
      });
    if (!counts.goals)
      items.push({
        kind: "setup",
        title: "Set a savings goal",
        detail: "A target and a date, and we work out the monthly contribution.",
        when: "Setup",
        href: "/dashboard/goals",
        action: "Add goal",
      });
  }

  return items;
}
