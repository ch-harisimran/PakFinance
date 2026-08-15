import { Breakdown } from "@/components/dashboard/Breakdown";
import { Meter } from "@/components/ui/Meter";
import { ALLOCATION, TOTAL_ASSETS, TOTAL_LIABILITIES, LIABILITIES } from "@/lib/dashboard-data";
import { formatCompact, formatFull } from "@/lib/money";

/**
 * Assets, liabilities and allocation in one column beside the hero.
 *
 * Allocation is a stacked bar rather than a donut. The reference carried three
 * donuts, two of which printed the same total. A bar answers "how does 35%
 * compare to 27%" at a glance, costs a quarter of the height, and labels
 * itself — a ring makes you match colours to a legend.
 */
export function BalanceSheet() {
  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.13em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              Total assets
            </div>
            <div className="flex items-baseline text-[21px] font-semibold leading-none tracking-[-0.025em]">
              <span className="currency">PKR</span>
              <span data-numeric>{formatCompact(TOTAL_ASSETS)}</span>
            </div>
          </div>
          <div>
            <div
              className="mb-2 text-[10px] uppercase tracking-[0.13em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              Total liabilities
            </div>
            <div className="flex items-baseline text-[21px] font-semibold leading-none tracking-[-0.025em]">
              <span className="currency">PKR</span>
              <span data-numeric>{formatCompact(TOTAL_LIABILITIES)}</span>
            </div>
          </div>
        </div>

        {/* Assets vs liabilities, to scale. */}
        <div className="mt-5 flex h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "var(--surface-3)" }}>
          <span
            className="h-full"
            style={{
              width: `${(TOTAL_ASSETS / (TOTAL_ASSETS + TOTAL_LIABILITIES)) * 100}%`,
              backgroundColor: "var(--color-brass)",
            }}
          />
          <span
            className="h-full"
            style={{
              width: `${(TOTAL_LIABILITIES / (TOTAL_ASSETS + TOTAL_LIABILITIES)) * 100}%`,
              backgroundColor: "var(--color-loss)",
            }}
          />
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Asset allocation</h2>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          Where your money is
        </p>

        <Breakdown items={ALLOCATION} className="mt-5" />
      </section>

      <section className="card p-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Your liabilities</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {LIABILITIES.map((l) => {
            const repaid = ((l.principal - l.remaining) / l.principal) * 100;
            return (
              <li key={l.name}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px]">{l.name}</span>
                  <span className="flex-none text-[13px] font-semibold" data-numeric>
                    {formatFull(l.remaining)}
                  </span>
                </div>
                <Meter value={repaid} />
                <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {repaid.toFixed(0)}% repaid · {l.lender}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
