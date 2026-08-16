import { PiggyBank } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Breakdown } from "@/components/dashboard/Breakdown";
import { TypeBadge } from "@/components/dashboard/TypeBadge";
import { AddFundOrder, FundOrderFields } from "@/components/forms/FundOrderForm";
import { RowActions } from "@/components/dashboard/RowActions";
import { updateFundOrder } from "@/app/dashboard/actions";
import { getFundOrders, getFundMeta, getOfficialNavs } from "@/lib/queries-funds";
import { buildFundPositions, valueFunds } from "@/lib/market/fund-holdings";
import { CHART } from "@/lib/chart";
import { paisaFull, paisaCompact, formatPct, formatFull } from "@/lib/money";

/**
 * Mutual Funds.
 *
 * NAVs are published once daily by MUFAP, so every value carries the date it
 * was priced. Until the MUFAP sync exists, that price comes from the user's own
 * orders — which is the same number, since you transact at the published NAV.
 * The chip says which, because implying a live feed we do not have would be a
 * claim the product cannot keep.
 */
export default async function FundsPage() {
  const orders = await getFundOrders();

  if (!orders.length) {
    return (
      <div className="flex-1 px-5 py-6 sm:px-6">
        <PageHeader
          title="Mutual Funds"
          subtitle="Units, NAV and allocation across every AMC you hold"
          actionSlot={<AddFundOrder />}
        />
        <EmptyState
          Icon={PiggyBank}
          title="No fund holdings yet"
          body="Record what you've bought — units and the NAV you bought at. PakFinance tracks your units, average NAV and allocation across Islamic and conventional funds, and can filter to Shariah-compliant only."
          action={<AddFundOrder />}
        />
      </div>
    );
  }

  const ids = [...new Set(orders.map((o) => o.fundId))];
  const [meta, official] = await Promise.all([getFundMeta(ids), getOfficialNavs(ids)]);

  const positions = valueFunds(buildFundPositions(orders), official);

  const totalValue = positions.reduce((s, p) => s + p.valuePaisa, 0);
  const invested = positions.reduce((s, p) => s + p.costPaisa, 0);
  const gain = totalValue - invested;
  const realised = buildFundPositions(orders).reduce((s, p) => s + p.realisedPaisa, 0);

  const islamicValue = positions
    .filter((p) => meta.get(p.fundId)?.isIslamic)
    .reduce((s, p) => s + p.valuePaisa, 0);

  const byCategory = [...positions.reduce((m, p) => {
    const key = meta.get(p.fundId)?.category ?? "Other";
    m.set(key, (m.get(key) ?? 0) + p.valuePaisa);
    return m;
  }, new Map<string, number>())]
    .map(([key, value], i) => ({
      key,
      value: value / 100,
      pct: totalValue ? (value / totalValue) * 100 : 0,
      color: CHART[i % CHART.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Newest priced date across the portfolio, and whether any of it is official.
  const newest = positions.reduce<string | null>(
    (d, p) => (p.navDate && (!d || p.navDate > d) ? p.navDate : d),
    null,
  );
  const anyOfficial = positions.some((p) => p.navSource === "official");

  const freshness = newest
    ? {
        label: anyOfficial ? `NAV as of ${newest}` : `Your NAV · ${newest}`,
        tone: anyOfficial ? ("daily" as const) : ("manual" as const),
      }
    : undefined;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Mutual Funds"
        subtitle="Units, NAV and allocation across every AMC you hold"
        freshness={freshness}
        search="Search funds"
        actionSlot={<AddFundOrder />}
      />

      <StatRow
        stats={[
          { k: "Total value", v: paisaFull(totalValue) },
          { k: "Invested", v: paisaFull(invested), tone: "muted" },
          { k: "Gain", v: paisaFull(gain), tone: gain >= 0 ? "gain" : "loss" },
          {
            k: "Shariah-compliant",
            v: totalValue ? `${((islamicValue / totalValue) * 100).toFixed(0)}%` : "0%",
            tone: "muted",
          },
        ]}
      />

      {!anyOfficial && (
        <p
          className="mb-5 rounded-[12px] border px-4 py-3 text-[12.5px]"
          style={{
            borderColor: "var(--border-subtle)",
            backgroundColor: "var(--surface-1)",
            color: "var(--text-muted)",
          }}
        >
          Valued at the NAV you recorded on your most recent order. Once the MUFAP
          daily sync is connected, these switch to published NAVs automatically —
          no re-entry needed.
        </p>
      )}

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Your funds" subtitle={`${positions.length} held`} bodyClassName="p-0">
          <div
            className="grid grid-cols-[2fr_repeat(3,minmax(0,1fr))] gap-3 px-5 py-2.5 text-[9.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            <span>Fund</span>
            <span className="text-right">Units</span>
            <span className="text-right">NAV</span>
            <span className="text-right">Value</span>
          </div>

          {positions.map((p) => {
            const m = meta.get(p.fundId);
            return (
              <div
                key={p.fundId}
                className="grid grid-cols-[2fr_repeat(3,minmax(0,1fr))] items-center gap-3 border-t px-5 py-3.5 transition-colors duration-200 hover:bg-[var(--surface-1)]"
                style={{ borderColor: "var(--border-subtle)" }}
                data-numeric
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{m?.name ?? "Unknown fund"}</div>
                  <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                    {m?.amc} · {m?.category}
                    {m?.isIslamic ? " · Shariah" : ""}
                  </div>
                </div>
                <span className="text-right text-[13px]" style={{ color: "var(--text-secondary)" }}>
                  {p.units.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </span>
                <div className="text-right">
                  <div className="text-[13px]">
                    {p.navPaisa === null ? "—" : formatFull(p.navPaisa / 100, 2)}
                  </div>
                  <div className="mt-0.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                    {p.navDate ?? "no price"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-semibold">{paisaFull(p.valuePaisa)}</div>
                  <div
                    className="mt-0.5 text-[11px]"
                    style={{ color: p.gainPaisa >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
                  >
                    {formatPct(p.returnPct)}
                  </div>
                </div>
              </div>
            );
          })}

          <div
            className="flex items-baseline justify-between border-t px-5 py-3.5 text-[12.5px]"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span style={{ color: "var(--text-muted)" }}>Realised on redemptions</span>
            <span
              className="font-semibold"
              style={{ color: realised >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
              data-numeric
            >
              {paisaFull(realised)}
            </span>
          </div>
        </Panel>

        <Panel title="By category" subtitle="Risk spread across your funds">
          {byCategory.length ? (
            <Breakdown items={byCategory} />
          ) : (
            <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
              No category data.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Orders" subtitle="Purchases, redemptions and reinvested dividends" bodyClassName="p-0">
        {orders.slice(0, 20).map((o) => {
          const m = meta.get(o.fundId);
          return (
            <div
              key={o.id}
              className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <TypeBadge type={o.type} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{m?.name ?? "Unknown fund"}</div>
                  <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                    {o.units.toLocaleString("en-US", { maximumFractionDigits: 4 })} units
                    {o.navPaisa > 0 ? ` @ NAV ${formatFull(o.navPaisa / 100, 2)}` : ""} · {o.tradedAt}
                  </div>
                </div>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                <span className="text-[13.5px] font-semibold" data-numeric>
                  {o.amountPaisa > 0 ? paisaCompact(o.amountPaisa) : "—"}
                </span>
                <RowActions
                  table="fund_transactions"
                  id={o.id}
                  name={`${o.type} ${o.units.toLocaleString("en-US", { maximumFractionDigits: 4 })} units of ${m?.name ?? "this fund"}`}
                  consequence="Your units and average NAV for this fund will be recalculated."
                  editTitle="Edit fund order"
                  editDescription={`${m?.name ?? "This fund"} — to move units to a different fund, delete this and add it again.`}
                  action={updateFundOrder}
                >
                  <FundOrderFields initial={o} />
                </RowActions>
              </div>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
