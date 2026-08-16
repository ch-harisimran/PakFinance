import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { netWorthDaily } from "@/lib/db/schema/app";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getTransactions, getLoans, getGoals, loanOutstanding, goalProgress, cashFlow } from "@/lib/queries";
import { getTrades, getQuotes } from "@/lib/queries-psx";
import { getFundOrders, getFundMeta, getOfficialNavs } from "@/lib/queries-funds";
import { buildHoldings, valueHoldings } from "@/lib/market/holdings";
import { buildFundPositions, valueFunds } from "@/lib/market/fund-holdings";

/**
 * The whole financial picture, assembled once for the dashboard.
 *
 * Every figure here is derived from ledgers the user actually entered — there
 * are no stored totals to drift out of date. The cost is one round of parallel
 * queries per page load, which is why the dashboard fetches once and passes
 * values down rather than each card fetching for itself.
 */

export interface NetWorthBreakdown {
  psxPaisa: number;
  fundsPaisa: number;
  cashPaisa: number;
  liabilitiesPaisa: number;
  assetsPaisa: number;
  netPaisa: number;
}

export async function getDashboard() {
  const [accounts, txns, loans, goals, trades, fundOrders] = await Promise.all([
    getAccounts(),
    getTransactions(60),
    getLoans(),
    getGoals(),
    getTrades(),
    getFundOrders(),
  ]);

  // Market data needs the symbol/fund lists first, so it is a second wave.
  const symbols = [...new Set(trades.map((t) => t.symbol))];
  const fundIds = [...new Set(fundOrders.map((o) => o.fundId))];
  const [quotes, fundMeta, navs] = await Promise.all([
    getQuotes(symbols),
    getFundMeta(fundIds),
    getOfficialNavs(fundIds),
  ]);

  const holdings = valueHoldings(buildHoldings(trades), quotes);
  const positions = valueFunds(buildFundPositions(fundOrders), navs);

  const psxPaisa = holdings.reduce((s, h) => s + h.valuePaisa, 0);
  const psxCostPaisa = holdings.reduce((s, h) => s + h.costPaisa, 0);
  const fundsPaisa = positions.reduce((s, p) => s + p.valuePaisa, 0);
  const fundsCostPaisa = positions.reduce((s, p) => s + p.costPaisa, 0);
  const cashPaisa = accounts.reduce((s, a) => s + a.balance_paisa, 0);

  const loanRows = loans.map((l) => ({ ...l, ...loanOutstanding(l) }));
  const liabilitiesPaisa = loanRows.reduce((s, l) => s + l.remainingPaisa, 0);

  const assetsPaisa = psxPaisa + fundsPaisa + cashPaisa;

  const breakdown: NetWorthBreakdown = {
    psxPaisa,
    fundsPaisa,
    cashPaisa,
    liabilitiesPaisa,
    assetsPaisa,
    netPaisa: assetsPaisa - liabilitiesPaisa,
  };

  const goalRows = goals.map((g) => ({ ...g, ...goalProgress(g) }));

  return {
    breakdown,
    accounts,
    txns,
    flow: cashFlow(txns),
    loans: loanRows,
    goals: goalRows,
    holdings,
    positions,
    fundMeta,
    invested: { psxPaisa: psxCostPaisa, fundsPaisa: fundsCostPaisa },
    isEmpty:
      !accounts.length && !txns.length && !loans.length && !goals.length && !trades.length && !fundOrders.length,
  };
}

/**
 * Net-worth history, from the daily snapshot job.
 *
 * Deliberately not reconstructed from ledgers: PSX positions can be replayed
 * against historical closes, but bank balances and fund NAVs cannot — we only
 * know what they are today. Projecting today's cash balance backwards would
 * draw a confident line that never happened. The chart therefore starts when
 * snapshots start, and says so.
 */
export async function getNetWorthSeries(userId: string, days = 365) {
  const rows = await db
    .select({
      date: netWorthDaily.sessionDate,
      assets: netWorthDaily.assetsPaisa,
      liabilities: netWorthDaily.liabilitiesPaisa,
    })
    .from(netWorthDaily)
    .where(eq(netWorthDaily.userId, userId))
    .orderBy(desc(netWorthDaily.sessionDate))
    .limit(days);

  return rows
    .map((r) => ({ date: String(r.date), valuePaisa: r.assets - r.liabilities }))
    .reverse();
}

export async function currentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
