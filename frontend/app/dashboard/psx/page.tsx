import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Breakdown } from "@/components/dashboard/Breakdown";
import { TypeBadge } from "@/components/dashboard/TypeBadge";
import {
  FRESH,
  HOLDINGS,
  PSX_VALUE,
  PSX_COST,
  PSX_GAIN_PCT,
  SECTORS,
  TRADES,
} from "@/lib/dashboard-data";
import { formatFull, formatPct, formatSigned } from "@/lib/money";

/**
 * PSX Portfolio.
 *
 * A personal tracker, not a trading terminal — no order book, no depth, no
 * candles. Cost basis is weighted average, which is how Pakistani brokers
 * report, and charges are shown because they are the difference between the
 * price you saw and the price you paid.
 */
export default function PsxPage() {
  const gain = PSX_VALUE - PSX_COST;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="PSX Portfolio"
        subtitle="Weighted-average cost basis, including brokerage and CDC charges"
        freshness={FRESH.psx}
        search="Search scrips"
        action="Add transaction"
      />

      <StatRow
        stats={[
          { k: "Market value", v: formatFull(PSX_VALUE) },
          { k: "Invested", v: formatFull(PSX_COST), tone: "muted" },
          { k: "Unrealised", v: formatSigned(gain), tone: "gain" },
          { k: "Return", v: formatPct(PSX_GAIN_PCT), tone: "gain" },
        ]}
      />

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Holdings" subtitle={`${HOLDINGS.length} scrips`} bodyClassName="p-0">
          <div
            className="grid grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] gap-3 px-5 py-2.5 text-[9.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            <span>Scrip</span>
            <span className="text-right">Avg cost</span>
            <span className="text-right">Last</span>
            <span className="text-right">Value</span>
            <span className="text-right">Unrealised</span>
          </div>

          {HOLDINGS.map((h) => (
            <div
              key={h.sym}
              className="grid grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] items-center gap-3 border-t px-5 py-3.5 transition-colors duration-200 hover:bg-[var(--surface-1)]"
              style={{ borderColor: "var(--border-subtle)" }}
              data-numeric
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {h.sym}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {h.name} · {formatFull(h.qty)} sh
                </div>
              </div>
              <span className="text-right text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {formatFull(h.avg, 2)}
              </span>
              <span className="text-right text-[13px]">{formatFull(h.last, 2)}</span>
              <span className="text-right text-[13px]">{formatFull(h.value)}</span>
              <span
                className="text-right text-[13px] font-semibold"
                style={{ color: h.gain >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
              >
                {formatPct(h.pct)}
              </span>
            </div>
          ))}
        </Panel>

        <Panel title="By sector" subtitle="Concentration across the portfolio">
          <Breakdown items={SECTORS} />
        </Panel>
      </div>

      <Panel title="Recent activity" subtitle="Trades, dividends and corporate actions" bodyClassName="p-0">
        {TRADES.map((t, i) => (
          <div
            key={`${t.sym}-${i}`}
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <TypeBadge type={t.type} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {t.sym}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {formatFull(t.qty)} @ {formatFull(t.price, 2)} · {t.date}
                </div>
              </div>
            </div>
            <div className="text-right" data-numeric>
              <div className="text-[13.5px] font-semibold">{formatFull(t.qty * t.price)}</div>
              {t.charges > 0 && (
                <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                  +{formatFull(t.charges)} charges
                </div>
              )}
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
