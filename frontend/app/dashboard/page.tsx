import { NetWorthHero } from "@/components/dashboard/NetWorthHero";
import { BalanceSheet } from "@/components/dashboard/BalanceSheet";
import { Attention } from "@/components/dashboard/Attention";
import {
  HoldingsPanel,
  FundsPanel,
  CashFlowPanel,
  ExpensesPanel,
  TransactionsPanel,
  GoalsPanel,
} from "@/components/dashboard/Panels";
import { getDashboard, getNetWorthSeries } from "@/lib/queries-networth";
import { getNotation } from "@/lib/queries";
import { getMarketState } from "@/lib/market/sessions";

/**
 * Three zones with deliberately unequal weight:
 *
 *   1  the answer      net worth at display scale, balance sheet beside it
 *   2  what needs you  the only things here with a deadline
 *   3  the detail      holdings, funds, flows — denser, lower contrast
 *
 * One round of fetching happens here and values are passed down, rather than
 * each card issuing its own queries and multiplying round trips.
 */
export default async function DashboardPage() {
  /**
   * Sequential, not Promise.all. `getDashboard()` already runs three concurrent
   * Drizzle reads internally; adding the net-worth series and the market state
   * alongside it put this page at exactly the client's pool `max` of 5, where
   * one more concurrent read would hang it forever with no error (see the
   * warning in lib/db/client.ts). Awaiting in turn caps concurrency at three and
   * gives the next person to add a panel room to breathe.
   *
   * The cost is small: these are three fast reads against a warm pool, not three
   * network calls to somewhere far away.
   */
  const data = await getDashboard();
  const series = await getNetWorthSeries();
  const market = await getMarketState();
  const notation = await getNotation();

  const { breakdown, flow, loans, goals, holdings, positions, fundMeta, txns, accounts, invested } = data;

  // Last six calendar months of flow, oldest first.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleDateString("en-GB", { month: "short" });
    const inMonth = txns.filter((t) => {
      const td = new Date(t.occurred_at);
      return td.getFullYear() === d.getFullYear() && td.getMonth() === d.getMonth();
    });
    return {
      m: label,
      income: inMonth.filter((t) => t.amount_paisa > 0).reduce((s, t) => s + t.amount_paisa, 0),
      expenses: inMonth.filter((t) => t.amount_paisa < 0).reduce((s, t) => s + Math.abs(t.amount_paisa), 0),
    };
  }).filter((m) => m.income > 0 || m.expenses > 0);

  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", hour12: false }).format(
      new Date(),
    ),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <div className="mb-6">
        <h2
          className="text-[clamp(1.5rem,2.4vw,2rem)] leading-tight tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {greeting}
        </h2>
        <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
          {market.open
            ? `PSX is open · closes ${market.reason === "open" ? "15:30" : ""} PKT`
            : market.reason === "holiday"
              ? `PSX is closed · ${market.detail}`
              : "PSX is closed"}
        </p>
      </div>

      {/* Zone 1 — the answer */}
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <NetWorthHero notation={notation} netPaisa={breakdown.netPaisa} series={series} />
        <BalanceSheet notation={notation} breakdown={breakdown} loans={loans} />
      </div>

      {/* Zone 2 — what needs you */}
      <div className="mb-5">
        <Attention
          loans={loans}
          goals={goals}
          counts={{
            accounts: accounts.length,
            trades: holdings.length,
            funds: positions.length,
            goals: goals.length,
          }}
        />
      </div>

      {/* Zone 3 — the detail */}
      <div className="grid gap-5 xl:grid-cols-3">
        <HoldingsPanel
          holdings={holdings}
          valuePaisa={breakdown.psxPaisa}
          costPaisa={invested.psxPaisa}
        />
        <FundsPanel notation={notation} positions={positions} meta={fundMeta} valuePaisa={breakdown.fundsPaisa} />
        <CashFlowPanel
          notation={notation}
          months={months}
          incomePaisa={flow.incomePaisa}
          expensesPaisa={flow.expensesPaisa}
          netPaisa={flow.netPaisa}
        />
        <ExpensesPanel categories={flow.categories} expensesPaisa={flow.expensesPaisa} />
        <TransactionsPanel txns={txns} />
        <GoalsPanel notation={notation} goals={goals} />
      </div>
    </div>
  );
}
