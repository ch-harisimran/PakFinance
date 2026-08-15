import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Breakdown } from "@/components/dashboard/Breakdown";
import { TypeBadge } from "@/components/dashboard/TypeBadge";
import { FRESH, FUNDS, FUNDS_VALUE, FUND_CATEGORIES, FUND_ORDERS } from "@/lib/dashboard-data";
import { formatFull } from "@/lib/money";

/**
 * Mutual Funds.
 *
 * MUFAP publishes NAVs once a day, after the close. Every value on this screen
 * carries the date it was priced — implying live pricing here would be a claim
 * the product cannot keep.
 */
export default function FundsPage() {
  const invested = 508000;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Mutual Funds"
        subtitle="NAVs published daily by MUFAP · values stamped with pricing date"
        freshness={FRESH.nav}
        search="Search funds"
        action="Add investment"
      >
        <label
          className="flex cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 py-2 text-[12.5px]"
          style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
        >
          <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-brass)]" />
          Shariah-compliant only
        </label>
      </PageHeader>

      <StatRow
        stats={[
          { k: "Total value", v: formatFull(FUNDS_VALUE) },
          { k: "Invested", v: formatFull(invested), tone: "muted" },
          { k: "Gain", v: formatFull(FUNDS_VALUE - invested), tone: "gain" },
          { k: "Funds held", v: String(FUNDS.length) },
        ]}
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Your funds" bodyClassName="p-0">
          <div
            className="grid grid-cols-[2fr_repeat(3,minmax(0,1fr))] gap-3 px-5 py-2.5 text-[9.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            <span>Fund</span>
            <span className="text-right">Units</span>
            <span className="text-right">NAV</span>
            <span className="text-right">Value</span>
          </div>

          {FUNDS.map((f) => (
            <div
              key={f.name}
              className="grid grid-cols-[2fr_repeat(3,minmax(0,1fr))] items-center gap-3 border-t px-5 py-3.5 transition-colors duration-200 hover:bg-[var(--surface-1)]"
              style={{ borderColor: "var(--border-subtle)" }}
              data-numeric
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{f.name}</div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {f.amc} · {f.cat}
                </div>
              </div>
              <span className="text-right text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {formatFull(f.units)}
              </span>
              <div className="text-right">
                <div className="text-[13px]">{formatFull(f.nav, 2)}</div>
                <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                  14 Aug
                </div>
              </div>
              <span className="text-right text-[13px] font-semibold">{formatFull(f.value)}</span>
            </div>
          ))}
        </Panel>

        <Panel title="By category" subtitle="Risk spread across your funds">
          <Breakdown items={FUND_CATEGORIES} />
        </Panel>
      </div>

      <Panel title="Orders" subtitle="Purchases and redemptions" bodyClassName="p-0">
        {FUND_ORDERS.map((o, i) => (
          <div
            key={`${o.fund}-${i}`}
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <TypeBadge type={o.type} />
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium">{o.fund}</div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {formatFull(o.units)} units @ NAV {formatFull(o.nav, 2)} · {o.date}
                </div>
              </div>
            </div>
            <span className="flex-none text-[13.5px] font-semibold" data-numeric>
              {formatFull(Math.round(o.units * o.nav))}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
