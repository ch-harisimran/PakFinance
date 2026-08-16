import { Breakdown } from "@/components/dashboard/Breakdown";
import { Meter } from "@/components/ui/Meter";
import { CHART } from "@/lib/chart";
import { paisaCompact, paisaFull } from "@/lib/money";
import type { NetWorthBreakdown } from "@/lib/queries-networth";

/**
 * Assets, liabilities and allocation beside the hero.
 *
 * Allocation is a stacked bar rather than a donut — a bar answers "how does 35%
 * compare to 27%" at a glance, costs a quarter of the height, and each legend
 * row carries its own proportional bar so length does the comparing rather than
 * colour.
 */
export function BalanceSheet({
  breakdown,
  loans,
}: {
  breakdown: NetWorthBreakdown;
  loans: { id: string; name: string; lender: string | null; remainingPaisa: number; repaidPct: number }[];
}) {
  const { assetsPaisa, liabilitiesPaisa, psxPaisa, fundsPaisa, cashPaisa } = breakdown;

  const allocation = [
    { key: "PSX equities", value: psxPaisa, color: CHART[0] },
    { key: "Mutual funds", value: fundsPaisa, color: CHART[1] },
    { key: "Bank & cash", value: cashPaisa, color: CHART[2] },
  ]
    .filter((a) => a.value > 0)
    .map((a) => ({
      key: a.key,
      value: a.value / 100,
      pct: assetsPaisa ? (a.value / assetsPaisa) * 100 : 0,
      color: a.color,
    }));

  const total = assetsPaisa + liabilitiesPaisa;

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
              <span data-numeric>{paisaCompact(assetsPaisa)}</span>
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
              <span data-numeric>{paisaCompact(liabilitiesPaisa)}</span>
            </div>
          </div>
        </div>

        {total > 0 && (
          <div
            className="mt-5 flex h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "var(--surface-3)" }}
          >
            <span
              className="h-full"
              style={{ width: `${(assetsPaisa / total) * 100}%`, backgroundColor: "var(--color-brass)" }}
            />
            <span
              className="h-full"
              style={{ width: `${(liabilitiesPaisa / total) * 100}%`, backgroundColor: "var(--color-loss)" }}
            />
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Asset allocation</h2>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          Where your money is
        </p>
        {allocation.length ? (
          <Breakdown items={allocation} className="mt-5" />
        ) : (
          <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
            Add a holding or an account to see your allocation.
          </p>
        )}
      </section>

      {loans.length > 0 && (
        <section className="card p-5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em]">Your liabilities</h2>
          <ul className="mt-4 flex flex-col gap-4">
            {loans.map((l) => (
              <li key={l.id}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px]">{l.name}</span>
                  <span className="flex-none text-[13px] font-semibold" data-numeric>
                    {paisaFull(l.remainingPaisa)}
                  </span>
                </div>
                <Meter value={l.repaidPct} />
                <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {l.repaidPct.toFixed(0)}% repaid{l.lender ? ` · ${l.lender}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
