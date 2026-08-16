import { Panel } from "@/components/dashboard/Panel";
import { Meter } from "@/components/ui/Meter";
import { RowActions } from "@/components/dashboard/RowActions";
import {
  AddBudget,
  BudgetFields,
  AddRecurring,
  RecurringFields,
} from "@/components/forms/WealthForms";
import { updateBudget, updateRecurring } from "@/app/dashboard/actions";
import { describeRecurring, type BudgetRow, type RecurringRow } from "@/lib/queries-wealth";
import { nextOccurrence } from "@/lib/recurring";
import { paisaFull } from "@/lib/money";

/**
 * Budgets and repeating entries, on the screen that owns the ledger they both
 * describe. Neither deserves a sidebar entry of its own: a budget is a line
 * drawn on your spending, and a repeating entry is a transaction you have not
 * had to type yet.
 */

export function BudgetPanel({
  budgets,
}: {
  budgets: (BudgetRow & { spentPaisa: number; remainingPaisa: number; pct: number; over: boolean })[];
}) {
  return (
    <Panel
      title="Budgets"
      subtitle={budgets.length ? "Against this month's spending" : undefined}
      action={<AddBudget />}
    >
      {budgets.length ? (
        <ul className="flex flex-col gap-4">
          {budgets.map((b) => (
            <li key={b.id}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium">{b.category}</span>
                <div className="flex flex-none items-center gap-1.5">
                  <span
                    className="text-[12.5px] font-semibold"
                    style={{ color: b.over ? "var(--color-loss)" : "var(--text-primary)" }}
                    data-numeric
                  >
                    {paisaFull(b.spentPaisa)} / {paisaFull(b.limit_paisa)}
                  </span>
                  <RowActions
                    table="budgets"
                    id={b.id}
                    name={`${b.category} budget`}
                    editTitle="Edit budget"
                    action={updateBudget}
                  >
                    <BudgetFields initial={b} />
                  </RowActions>
                </div>
              </div>

              <Meter
                value={Math.min(100, b.pct)}
                color={b.over ? "var(--color-loss)" : b.pct > 80 ? "var(--color-warning)" : "var(--color-brass)"}
              />

              <div className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-faint)" }} data-numeric>
                {b.over
                  ? `${paisaFull(-b.remainingPaisa)} over`
                  : `${paisaFull(b.remainingPaisa)} left`}
                {" · "}
                {b.pct.toFixed(0)}% used
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
          No budgets set. A limit per category turns spending into something you can
          steer rather than only review.
        </p>
      )}
    </Panel>
  );
}

export function RecurringPanel({
  rules,
  accounts,
  today,
}: {
  rules: RecurringRow[];
  accounts: { id: string; name: string }[];
  today: string;
}) {
  return (
    <Panel
      title="Repeating"
      subtitle={rules.length ? "Posted automatically when due" : undefined}
      action={<AddRecurring accounts={accounts} />}
      bodyClassName="p-0"
    >
      {rules.length ? (
        rules.map((r) => {
          const due = nextOccurrence(
            {
              cadence: r.cadence,
              dayOfPeriod: r.day_of_period,
              startDate: r.start_date,
              endDate: r.end_date,
              lastPostedOn: r.last_posted_on,
              isActive: r.is_active,
            },
            today,
          );

          return (
            <div
              key={r.id}
              className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">
                  {r.label}
                  {!r.is_active && (
                    <span className="ml-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      paused
                    </span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                  {describeRecurring(r)}
                  {r.is_active ? ` · next ${due}` : ""}
                </div>
              </div>

              <div className="flex flex-none items-center gap-1.5">
                <span
                  className="text-[13.5px] font-semibold"
                  style={{
                    color: r.amount_paisa > 0 ? "var(--color-gain)" : "var(--text-primary)",
                  }}
                  data-numeric
                >
                  {r.amount_paisa > 0 ? "+" : "−"}
                  {paisaFull(Math.abs(r.amount_paisa))}
                </span>
                <RowActions
                  table="recurring_transactions"
                  id={r.id}
                  name={r.label}
                  consequence="Entries it has already posted stay in your ledger."
                  editTitle="Edit repeating entry"
                  action={updateRecurring}
                >
                  <RecurringFields accounts={accounts} initial={r} />
                </RowActions>
              </div>
            </div>
          );
        })
      ) : (
        <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
          Nothing repeating yet. Salary, rent and utilities are the ones worth adding —
          they post themselves, and never twice for the same period.
        </p>
      )}
    </Panel>
  );
}
