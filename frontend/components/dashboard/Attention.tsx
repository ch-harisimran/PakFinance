import { CalendarClock, TriangleAlert, RefreshCw } from "lucide-react";
import { ATTENTION } from "@/lib/dashboard-data";

/**
 * Zone 2 — what needs you.
 *
 * This band does not exist in the reference, and it is the difference between a
 * dashboard you look at and one you act on. Obligations, drifting goals and
 * stale prices are the only things on this screen with a deadline attached.
 *
 * When the account is empty this is also where onboarding lives, so a new user
 * sees a next step instead of a grid of zeroes.
 */

const ICON = {
  due: CalendarClock,
  goal: TriangleAlert,
  data: RefreshCw,
};

const TONE = {
  due: "var(--color-brass)",
  goal: "var(--color-warning)",
  data: "var(--text-faint)",
};

export function Attention() {
  return (
    <section className="card p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Needs you</h2>
        <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          {ATTENTION.length} items
        </span>
      </div>

      <ul className="grid gap-3 lg:grid-cols-3">
        {ATTENTION.map((a) => {
          const Icon = ICON[a.kind];
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
                <button
                  className="mt-3 text-[12.5px] underline-offset-4 hover:underline"
                  style={{ color: "var(--brass-text)" }}
                >
                  {a.action}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
