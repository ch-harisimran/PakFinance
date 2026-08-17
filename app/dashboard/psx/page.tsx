import { LineChart } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Breakdown } from "@/components/dashboard/Breakdown";
import { TypeBadge } from "@/components/dashboard/TypeBadge";
import { AddTrade, TradeFields } from "@/components/forms/TradeForm";
import { RowActions } from "@/components/dashboard/RowActions";
import { NoMatches } from "@/components/dashboard/SearchBox";
import { filterBy, readQuery } from "@/lib/search";
import { getNotation } from "@/lib/queries";
import { updateTrade } from "@/app/dashboard/actions";
import { PortfolioChart } from "@/components/dashboard/PortfolioChart";
import {
  getTrades,
  getQuotes,
  getDailyBars,
  getSecurityMeta,
  getPriceAsOf,
  getCorporateActions,
} from "@/lib/queries-psx";
import { buildHoldings, valueHoldings, portfolioSeries } from "@/lib/market/holdings";
import { CHART } from "@/lib/chart";
import { paisaFull, formatPct, paisaCompact } from "@/lib/money";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "PSX Portfolio" };

/**
 * PSX Portfolio — real holdings against real prices.
 *
 * A personal tracker, not a trading terminal: no order book, no depth, no
 * candles. Cost basis is weighted average, matching how brokers report here.
 *
 * The value curve is built by replaying trades forward through the backfilled
 * daily closes, so a position bought in 2023 is valued at 2023 prices — not at
 * today's.
 */
export default async function PsxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const trades = await getTrades();
  const q = readQuery((await searchParams).q);
  const notation = await getNotation();

  if (!trades.length) {
    return (
      <div className="flex-1 px-5 py-6 sm:px-6">
        <PageHeader
          title="PSX Portfolio"
          subtitle="Weighted-average cost basis, including brokerage and CDC charges"
          actionSlot={<AddTrade />}
        />
        <EmptyState
          Icon={LineChart}
          title="No holdings yet"
          body="Add the trades you've already made — including old ones. PakFinance holds five years of PSX closing prices, so your past positions are valued at the prices that actually applied, and your portfolio curve starts from the day you first bought."
          action={<AddTrade />}
        />
      </div>
    );
  }

  const traded = [...new Set(trades.map((t) => t.symbol))];
  const firstTrade = trades.reduce((min, t) => (t.tradedAt < min ? t.tradedAt : min), trades[0].tradedAt);

  // Fetched first, and alone: a symbol change means the ticker a position ends
  // up under is not one the user ever traded, so prices have to be looked up for
  // both the traded symbols and whatever the actions rename them to.
  const actions = await getCorporateActions(traded);
  const positions = buildHoldings(trades, actions);
  const symbols = [...new Set([...traded, ...positions.map((h) => h.symbol)])];

  const [quotes, bars, meta, asOf] = await Promise.all([
    getQuotes(symbols),
    getDailyBars(symbols, firstTrade),
    getSecurityMeta(symbols),
    getPriceAsOf(),
  ]);

  const holdings = valueHoldings(positions, quotes);
  const series = portfolioSeries(trades, bars, actions);

  const marketValue = holdings.reduce((s, h) => s + h.valuePaisa, 0);
  const invested = holdings.reduce((s, h) => s + h.costPaisa, 0);
  const unrealised = marketValue - invested;
  // From `positions`, which is already built — rebuilding twice more was both
  // wasteful and, now that actions exist, a second answer to the same question.
  const realised = positions.reduce((s, h) => s + h.realisedPaisa, 0);
  const dividends = positions.reduce((s, h) => s + h.dividendPaisa, 0);

  const bySector = [...holdings.reduce((m, h) => {
    const key = meta.get(h.symbol)?.sectorName ?? "Unclassified";
    m.set(key, (m.get(key) ?? 0) + h.valuePaisa);
    return m;
  }, new Map<string, number>())]
    .map(([key, value], i) => ({
      key,
      value: value / 100,
      pct: marketValue ? (value / marketValue) * 100 : 0,
      color: CHART[i % CHART.length],
    }))
    .sort((a, b) => b.value - a.value);

  // Filtering affects the tables only. The stat row and the sector split above
  // describe the whole portfolio, and a search must not appear to shrink it.
  const shownHoldings = filterBy(holdings, q, (h) => [
    h.symbol,
    meta.get(h.symbol)?.name,
    meta.get(h.symbol)?.sectorName,
    ...(meta.get(h.symbol)?.indices ?? []),
  ]);
  const shownTrades = filterBy(trades, q, (t) => [t.symbol, t.type]);

  const freshness = asOf
    ? {
        label: `As of ${asOf.toLocaleString("en-GB", { timeZone: "Asia/Karachi", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} PKT`,
        tone: "live" as const,
      }
    : undefined;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="PSX Portfolio"
        subtitle="Weighted-average cost basis, including brokerage and CDC charges"
        freshness={freshness}
        search="Search scrips"
        actionSlot={<AddTrade />}
      />

      <StatRow
        stats={[
          { k: "Market value", v: paisaFull(marketValue) },
          { k: "Invested", v: paisaFull(invested), tone: "muted" },
          {
            k: "Unrealised",
            v: paisaFull(unrealised),
            tone: unrealised >= 0 ? "gain" : "loss",
          },
          {
            k: "Return",
            v: formatPct(invested ? (unrealised / invested) * 100 : 0),
            tone: unrealised >= 0 ? "gain" : "loss",
          },
        ]}
      />

      {series.length > 1 && (
        <div className="mb-5">
          <PortfolioChart series={series} notation={notation} />
        </div>
      )}

      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          title="Holdings"
          subtitle={
            shownHoldings.length === holdings.length
              ? `${holdings.length} scrips`
              : `${shownHoldings.length} of ${holdings.length} scrips`
          }
          bodyClassName="p-0"
        >
          <div
            className="grid grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] gap-3 px-5 py-2.5 text-[9.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            <span>Scrip</span>
            <span className="text-right">Avg cost</span>
            <span className="text-right">Last</span>
            <span className="text-right">Value</span>
            <span className="text-right">Return</span>
          </div>

          {q && shownHoldings.length === 0 && <NoMatches query={q} noun="scrips" />}

          {shownHoldings.map((h) => (
            <div
              key={h.symbol}
              className="grid grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] items-center gap-3 border-t px-5 py-3.5 transition-colors duration-200 hover:bg-[var(--surface-1)]"
              style={{ borderColor: "var(--border-subtle)" }}
              data-numeric
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {h.symbol}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {h.qty.toLocaleString("en-US")} shares
                </div>
              </div>
              <span className="text-right text-[13px]" style={{ color: "var(--text-secondary)" }}>
                {paisaFull(Math.round(h.avgCostPaisa), 2)}
              </span>
              <span className="text-right text-[13px]">
                {h.lastPaisa === null ? "—" : paisaFull(h.lastPaisa, 2)}
              </span>
              <span className="text-right text-[13px]">{paisaFull(h.valuePaisa)}</span>
              <span
                className="text-right text-[13px] font-semibold"
                style={{ color: h.unrealisedPaisa >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
              >
                {formatPct(h.returnPct)}
              </span>
            </div>
          ))}

          <div
            className="grid grid-cols-3 gap-3 border-t px-5 py-4 text-[12.5px]"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span style={{ color: "var(--text-muted)" }}>
              Realised{" "}
              <b style={{ color: realised >= 0 ? "var(--color-gain)" : "var(--color-loss)" }} data-numeric>
                {paisaFull(realised)}
              </b>
            </span>
            <span style={{ color: "var(--text-muted)" }}>
              Dividends{" "}
              <b style={{ color: "var(--color-gain)" }} data-numeric>
                {paisaFull(dividends)}
              </b>
            </span>
            <span className="text-right" style={{ color: "var(--text-faint)" }}>
              {trades.length} transactions
            </span>
          </div>
        </Panel>

        <Panel title="By sector" subtitle="Concentration across the portfolio">
          {bySector.length ? (
            <Breakdown items={bySector} notation={notation} />
          ) : (
            <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
              No sector data.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Transactions" subtitle="Your trades, dividends and corporate actions" bodyClassName="p-0">
        {shownTrades.slice(0, 20).map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <TypeBadge type={t.type} />
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {t.symbol}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {t.quantity.toLocaleString("en-US")} @ {paisaFull(t.pricePaisa, 2)} · {t.tradedAt}
                </div>
              </div>
            </div>
            <div className="flex flex-none items-center gap-1.5">
              <div className="text-right" data-numeric>
                <div className="text-[13.5px] font-semibold">
                  {paisaCompact(Math.round(t.quantity * t.pricePaisa))}
                </div>
                {t.chargesPaisa > 0 && (
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    +{paisaFull(t.chargesPaisa)} charges
                  </div>
                )}
              </div>
              <RowActions
                table="stock_transactions"
                id={t.id}
                name={`${t.type} ${t.quantity.toLocaleString("en-US")} ${t.symbol} on ${t.tradedAt}`}
                consequence="Your average cost and return for this scrip will be recalculated."
                editTitle="Edit PSX transaction"
                editDescription="Cost basis is weighted average, so a correction here re-derives every figure."
                action={updateTrade}
              >
                <TradeFields initial={t} />
              </RowActions>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}
