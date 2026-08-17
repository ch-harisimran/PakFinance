import "server-only";

import { cache } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { netWorthDaily } from "@/lib/db/schema/app";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getTransactions, getLoans, getGoals, loanOutstanding, goalProgress, cashFlow } from "@/lib/queries";
import { getTrades, getQuotes, getCorporateActions } from "@/lib/queries-psx";
import { getFundOrders, getFundMeta, getOfficialNavs } from "@/lib/queries-funds";
import { buildHoldings, valueHoldings } from "@/lib/market/holdings";
import { buildFundPositions, valueFunds } from "@/lib/market/fund-holdings";
import { getAssets, getCommittees, committeesWithPosition } from "@/lib/queries-wealth";

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
  /** Gold, property, crypto — anything on the Other Assets screen. */
  otherPaisa: number;
  /** Committee money paid in but not yet collected. */
  committeesPaisa: number;
  liabilitiesPaisa: number;
  assetsPaisa: number;
  netPaisa: number;
}

export async function getDashboard() {
  const [accounts, txns, loans, goals, trades, fundOrders, assets, committees] = await Promise.all([
    getAccounts(),
    getTransactions(60),
    getLoans(),
    getGoals(),
    getTrades(),
    getFundOrders(),
    getAssets(),
    getCommittees(),
  ]);

  // Market data needs the symbol/fund lists first, so it is a second wave.
  //
  // Three concurrent reads, against a pool of five. That headroom is deliberate
  // and load-bearing: Drizzle never resumes queries it queues beyond `max`, so
  // anything added here must keep the total under it. See lib/db/client.ts.
  const traded = [...new Set(trades.map((t) => t.symbol))];
  const fundIds = [...new Set(fundOrders.map((o) => o.fundId))];

  // Actions first, on their own: a symbol change moves a position onto a ticker
  // the user never traded, and that ticker is the one needing a price.
  const actions = await getCorporateActions(traded);
  const stockPositions = buildHoldings(trades, actions);
  const symbols = [...new Set([...traded, ...stockPositions.map((h) => h.symbol)])];

  const [quotes, fundMeta, navs] = await Promise.all([
    getQuotes(symbols),
    getFundMeta(fundIds),
    getOfficialNavs(fundIds),
  ]);

  const holdings = valueHoldings(stockPositions, quotes);
  const positions = valueFunds(buildFundPositions(fundOrders), navs);

  const psxPaisa = holdings.reduce((s, h) => s + h.valuePaisa, 0);
  const psxCostPaisa = holdings.reduce((s, h) => s + h.costPaisa, 0);
  const fundsPaisa = positions.reduce((s, p) => s + p.valuePaisa, 0);
  const fundsCostPaisa = positions.reduce((s, p) => s + p.costPaisa, 0);
  const cashPaisa = accounts.reduce((s, a) => s + a.balance_paisa, 0);

  const loanRows = loans.map((l) => ({ ...l, ...loanOutstanding(l) }));

  // Committees sit on both sides: what you have paid in and not yet collected is
  // an asset, and once you have taken the pot the months still owed are a debt.
  const { rows: committeeRows, assetPaisa: committeesPaisa, liabilityPaisa: committeeDebt } =
    committeesWithPosition(committees, new Date().toISOString().slice(0, 10));

  const otherPaisa = assets.reduce((s, a) => s + a.value_paisa, 0);
  const liabilitiesPaisa =
    loanRows.reduce((s, l) => s + l.remainingPaisa, 0) + committeeDebt;

  const assetsPaisa = psxPaisa + fundsPaisa + cashPaisa + otherPaisa + committeesPaisa;

  const breakdown: NetWorthBreakdown = {
    psxPaisa,
    fundsPaisa,
    cashPaisa,
    otherPaisa,
    committeesPaisa,
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
    assets,
    committees: committeeRows,
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
export async function getNetWorthSeries(days = 365) {
  /**
   * The user is derived here, never passed in.
   *
   * This reads through Drizzle, which connects as `postgres` and therefore
   * BYPASSES row-level security — the database will not catch a mistake in this
   * function. A previous signature took `userId: string`, which was safe only
   * because every caller happened to pass a verified id; one careless
   * `getNetWorthSeries(searchParams.user)` would have served another person's
   * entire net-worth history.
   *
   * Taking no argument makes that class of bug unwritable.
   */
  const userId = await currentUserId();
  if (!userId) return [];

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

/**
 * The signed-in user's id, verified against Supabase rather than decoded from a
 * cookie. Cached, so asking repeatedly within one request is free.
 */
export const currentUserId = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});
