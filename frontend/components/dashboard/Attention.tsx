import Link from "next/link";
import { CalendarClock, TriangleAlert, Wallet, PiggyBank, LineChart } from "lucide-react";
import { buildAlerts, type AlertInput } from "@/lib/alerts";

/**
 * Zone 2 — what needs you.
 *
 * Everything on this screen with a deadline attached, derived rather than
 * authored: installments coming due, goals drifting off pace, and — for an
 * empty account — the setup steps still outstanding.
 *
 * The derivation itself lives in lib/alerts.ts, shared with the notification
 * bell, so the two can never disagree about what needs attention.
 *
 * The empty case is deliberately the same component. A new user meeting a grid
 * of zeroes learns nothing; a new user meeting three things to do has a path.
 */

const ICON = { due: CalendarClock, goal: TriangleAlert, setup: Wallet };
const TONE = {
  due: "var(--color-brass)",
  goal: "var(--color-warning)",
  setup: "var(--text-faint)",
};

export function Attention({
  loans,
  goals,
  counts,
}: {
  loans: AlertInput["loans"];
  goals: AlertInput["goals"];
  counts: NonNullable<AlertInput["counts"]>;
}) {
  const items = buildAlerts({ loans, goals, counts });

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
