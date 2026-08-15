import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Meter } from "@/components/ui/Meter";
import { FRESH, LIABILITIES, TOTAL_LIABILITIES, LOAN_SCHEDULE } from "@/lib/dashboard-data";
import { formatFull } from "@/lib/money";

/**
 * Loans.
 *
 * The amortization schedule is the reason this screen exists: seeing how much
 * of each installment is principal versus markup is the single most useful
 * thing a borrower can know, and no bank statement shows it plainly.
 */
export default function LoansPage() {
  const monthly = LIABILITIES.reduce((s, l) => s + l.installment, 0);
  const markupThisYear = LOAN_SCHEDULE.reduce((s, r) => s + r.markup, 0);

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Loans"
        subtitle="Principal and markup split for every installment"
        freshness={FRESH.manual}
        search="Search loans"
        action="Add loan"
      />

      <StatRow
        stats={[
          { k: "Total outstanding", v: formatFull(TOTAL_LIABILITIES) },
          { k: "Monthly obligation", v: formatFull(monthly), tone: "muted" },
          { k: "Markup ahead (6m)", v: formatFull(markupThisYear), tone: "loss" },
          { k: "Debt-free", v: "Mar 2029", tone: "gain" },
        ]}
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        {LIABILITIES.map((l) => {
          const repaid = ((l.principal - l.remaining) / l.principal) * 100;
          return (
            <section key={l.name} className="card p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{l.name}</h3>
                  <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                    {l.lender} · original {formatFull(l.principal)}
                  </p>
                </div>
                <span
                  className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
                  style={{
                    fontFamily: "var(--font-mono)",
                    borderColor: "var(--border-subtle)",
                    color: l.dueInDays <= 7 ? "var(--color-brass)" : "var(--text-faint)",
                  }}
                >
                  Due in {l.dueInDays}d
                </span>
              </div>

              <div className="flex items-baseline text-[26px] font-semibold leading-none tracking-[-0.025em]">
                <span className="currency">PKR</span>
                <span data-numeric>{formatFull(l.remaining)}</span>
              </div>
              <div className="mt-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                remaining · {formatFull(l.installment)}/month
              </div>

              <Meter value={repaid} className="mt-5" />
              <div className="mt-2 text-[11.5px]" style={{ color: "var(--text-faint)" }} data-numeric>
                {repaid.toFixed(0)}% repaid
              </div>

              <div
                className="mt-5 flex gap-4 border-t pt-4 text-[12.5px]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <button className="underline-offset-4 hover:underline" style={{ color: "var(--brass-text)" }}>
                  Log payment
                </button>
                <button className="underline-offset-4 hover:underline" style={{ color: "var(--text-faint)" }}>
                  Payoff simulator
                </button>
              </div>
            </section>
          );
        })}
      </div>

      <Panel
        title="Amortization · Car loan"
        subtitle="Next six installments"
        bodyClassName="p-0"
      >
        <div
          className="grid grid-cols-[auto_1.2fr_repeat(3,minmax(0,1fr))] gap-3 px-5 py-2.5 text-[9.5px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
        >
          <span>#</span>
          <span>Due</span>
          <span className="text-right">Principal</span>
          <span className="text-right">Markup</span>
          <span className="text-right">Balance</span>
        </div>

        {LOAN_SCHEDULE.map((r, i) => (
          <div
            key={r.n}
            className="grid grid-cols-[auto_1.2fr_repeat(3,minmax(0,1fr))] items-center gap-3 border-t px-5 py-3 transition-colors duration-200 hover:bg-[var(--surface-1)]"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor: i === 0 ? "var(--surface-1)" : undefined,
            }}
            data-numeric
          >
            <span
              className="text-[12px]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              {r.n}
            </span>
            <span className="text-[13px]">
              {r.due}
              {i === 0 && (
                <span className="ml-2 text-[11px]" style={{ color: "var(--color-brass)" }}>
                  next
                </span>
              )}
            </span>
            <span className="text-right text-[13px]">{formatFull(r.principal)}</span>
            <span className="text-right text-[13px]" style={{ color: "var(--color-loss)" }}>
              {formatFull(r.markup)}
            </span>
            <span className="text-right text-[13px] font-semibold">{formatFull(r.balance)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
