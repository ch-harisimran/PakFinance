import Link from "next/link";
import { CalendarClock, TriangleAlert, Wallet, PiggyBank, LineChart } from "lucide-react";
import { paisaFull } from "@/lib/money";

/**
 * Zone 2 — what needs you.
 *
 * Everything on this screen with a deadline attached, derived rather than
 * authored: installments coming due, goals drifting off pace, and — for an
 * empty account — the setup steps still outstanding.
 *
 * The empty case is deliberately the same component. A new user meeting a grid
 * of zeroes learns nothing; a new user meeting three things to do has a path.
 */

interface Item {
  kind: "due" | "goal" | "setup";
  title: string;
  detail: string;
  when: string;
  href: string;
  action: string;
}

const ICON = { due: CalendarClock, goal: TriangleAlert, setup: Wallet };
const TONE = {
  due: "var(--color-brass)",
  goal: "var(--color-warning)",
  setup: "var(--text-faint)",
};

/** Days until the next occurrence of a day-of-month. */
function daysUntil(dueDay: number): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (next < now) next.setMonth(next.getMonth() + 1);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 864e5));
}

export function Attention({
  loans,
  goals,
  counts,
}: {
  loans: { id: string; name: string; lender: string | null; installment_paisa: number | null; due_day: number | null; remainingPaisa: number }[];
  goals: { id: string; name: string; onTrack: boolean; monthlyNeededPaisa: number; target_date: string | null }[];
  counts: { accounts: number; trades: number; funds: number; goals: number };
}) {
  const items: Item[] = [];

  for (const l of loans) {
    if (l.remainingPaisa <= 0 || !l.due_day || !l.installment_paisa) continue;
    const days = daysUntil(l.due_day);
    if (days > 14) continue;
    items.push({
      kind: "due",
      title: `${l.name} installment`,
      detail: `${paisaFull(l.installment_paisa)}${l.lender ? ` to ${l.lender}` : ""}`,
      when: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`,
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

  if (!items.length) {
    return (
      <section className="card flex items-center gap-4 p-5">
        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px]"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <PiggyBank size={16} strokeWidth={1.7} color="var(--color-gain)" />
        </span>
        <div>
          <div className="text-[13.5px] font-medium">Nothing needs you</div>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            No installments due in the next two weeks and every goal is on pace.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Needs you</h2>
        <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          {items.length} item{items.length === 1 ? "" : "s"}
        </span>
      </div>

      <ul className="grid gap-3 lg:grid-cols-3">
        {items.slice(0, 6).map((a) => {
          const Icon = a.kind === "setup" ? LineChart : ICON[a.kind];
          return (
            <li
              key={a.title}
              className="flex items-start gap-3.5 rounded-[12px] border p-4 transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
            >
              <span
                className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[9px]"
                style={{ backgroundColor: "var(--surface-3)" }}
              >
                <Icon size={15} strokeWidth={1.7} color={TONE[a.kind]} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13.5px] font-medium">{a.title}</span>
                  <span
                    className="flex-none text-[10px] uppercase tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-mono)", color: TONE[a.kind] }}
                  >
                    {a.when}
                  </span>
                </div>
                <p className="mt-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {a.detail}
                </p>
                <Link
                  href={a.href}
                  className="mt-3 inline-block text-[12.5px] underline-offset-4 hover:underline"
                  style={{ color: "var(--brass-text)" }}
                >
                  {a.action}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
