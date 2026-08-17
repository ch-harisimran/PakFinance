import { desc, eq, inArray, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { runTrigger } from "@/lib/market/run-context";
import { corporateActions, fundNavs, priceLatest, syncRuns } from "@/lib/db/schema/market";
import {
  accounts,
  fundTransactions,
  loanPayments,
  loans,
  netWorthDaily,
  profiles,
  stockTransactions,
} from "@/lib/db/schema/app";
import {
  buildHoldings,
  valueHoldings,
  type Trade,
  type CorporateAction,
} from "@/lib/market/holdings";
import { buildFundPositions, valueFunds, type FundOrder } from "@/lib/market/fund-holdings";
import { karachiNow } from "@/lib/market/sessions";

/**
 * Daily net-worth snapshot.
 *
 * This is what makes the dashboard's net-worth curve possible. Bank balances
 * and NAVs cannot be reconstructed after the fact — we only ever know what they
 * are today — so if this job does not run on a given day, that day is simply
 * missing from the chart forever. It is the only irreplaceable job in the
 * system.
 *
 * Runs as the system, through Drizzle, deliberately bypassing RLS: it computes
 * for EVERY user, which no user-scoped query could do. That is exactly why this
 * module must never be reachable from a user request.
 */

export type SnapshotResult =
  | { action: "skipped"; reason: string; detail?: string }
  | { action: "written"; users: number; date: string };

export async function runSnapshot({ force = false } = {}): Promise<SnapshotResult> {
  const date = karachiNow().date;

  if (!force) {
    const [existing] = await db
      .select({ n: raw<number>`count(*)::int` })
      .from(netWorthDaily)
      .where(eq(netWorthDaily.sessionDate, date));

    if (existing.n > 0) {
      await db.insert(syncRuns).values({
        job: "snapshot",
        status: "skipped",
        trigger: runTrigger(),
        reason: "already-today",
        finishedAt: new Date(),
      });
      return { action: "skipped", reason: "already-today", detail: date };
    }
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ job: "snapshot", status: "running", trigger: runTrigger() })
    .returning({ id: syncRuns.id });

  try {
    // Everything in a handful of queries, grouped in memory. Per-user queries
    // would be N+1 across the whole user base for a job that runs unattended.
    //
    // Sequential, NOT Promise.all. Drizzle's postgres-js driver does not resume
    // queries it queues once the pool is warm: fan out wider than the client's
    // `max` (5) and the surplus queries hang forever, with no error and no
    // server-side activity to show for it. Raw postgres.js queues correctly, so
    // this is a driver bug, not a pool-size limit — but the pool is shared with
    // every request, so widening it is not the fix. These queries take about a
    // second in total; there is nothing to win by overlapping them.
    const users = await db.select({ userId: profiles.userId }).from(profiles);
    const cash = await db
      .select({ userId: accounts.userId, total: raw<number>`coalesce(sum(${accounts.balancePaisa}),0)::bigint` })
      .from(accounts)
      .where(eq(accounts.isActive, true))
      .groupBy(accounts.userId);
    const trades = await db.select().from(stockTransactions);
    const orders = await db.select().from(fundTransactions);
    const loanRows = await db.select().from(loans);
    const payments = await db.select().from(loanPayments);
    const quotes = await db
      .select({ symbol: priceLatest.symbol, price: priceLatest.price })
      .from(priceLatest);
    const navs = await db
      .selectDistinctOn([fundNavs.fundId], { fundId: fundNavs.fundId, nav: fundNavs.nav })
      .from(fundNavs)
      .orderBy(fundNavs.fundId, desc(fundNavs.sessionDate));

    // Splits and symbol changes apply to every user at once, so they are loaded
    // whole rather than per user. Without them a snapshot taken after a split
    // records the pre-split share count against post-split prices — and unlike
    // the screens, a wrong snapshot is written down permanently.
    const actionRows = await db
      .select({
        symbol: corporateActions.symbol,
        kind: corporateActions.kind,
        exDate: corporateActions.exDate,
        ratioFrom: corporateActions.ratioFrom,
        ratioTo: corporateActions.ratioTo,
        newSymbol: corporateActions.newSymbol,
      })
      .from(corporateActions)
      .where(inArray(corporateActions.kind, ["SPLIT", "SYMBOL_CHANGE", "MERGER"]));

    const actions: CorporateAction[] = actionRows.map((r) => ({
      symbol: r.symbol,
      kind: r.kind as CorporateAction["kind"],
      exDate: String(r.exDate),
      ratioFrom: r.ratioFrom === null ? null : Number(r.ratioFrom),
      ratioTo: r.ratioTo === null ? null : Number(r.ratioTo),
      newSymbol: r.newSymbol,
    }));

    const quoteMap = new Map(
      quotes.map((q) => [q.symbol, { pricePaisa: Math.round(Number(q.price) * 100), changePct: null }]),
    );
    const navMap = new Map(
      navs.map((n) => [n.fundId, { navPaisa: Math.round(Number(n.nav) * 100), date }]),
    );

    const cashByUser = new Map(cash.map((c) => [c.userId, Number(c.total)]));

    const tradesByUser = groupBy(trades, (t) => t.userId);
    const ordersByUser = groupBy(orders, (o) => o.userId);
    const loansByUser = groupBy(loanRows, (l) => l.userId);
    const paidByLoan = new Map<string, number>();
    for (const p of payments) {
      paidByLoan.set(p.loanId, (paidByLoan.get(p.loanId) ?? 0) + p.amountPaisa);
    }

    const rows = users.map(({ userId }) => {
      const holdings = valueHoldings(
        buildHoldings((tradesByUser.get(userId) ?? []).map(toTrade), actions),
        quoteMap,
      );
      const positions = valueFunds(
        buildFundPositions((ordersByUser.get(userId) ?? []).map(toOrder)),
        navMap,
      );

      const psx = holdings.reduce((s, h) => s + h.valuePaisa, 0);
      const funds = positions.reduce((s, p) => s + p.valuePaisa, 0);
      const cashPaisa = cashByUser.get(userId) ?? 0;

      const liabilities = (loansByUser.get(userId) ?? []).reduce((s, l) => {
        const paid = paidByLoan.get(l.id) ?? 0;
        return s + Math.max(0, l.principalPaisa - paid);
      }, 0);

      return {
        userId,
        sessionDate: date,
        assetsPaisa: psx + funds + cashPaisa,
        liabilitiesPaisa: liabilities,
      };
    });

    if (rows.length) {
      await db
        .insert(netWorthDaily)
        .values(rows)
        // Re-running the same day should correct the row, not duplicate or
        // ignore it — a late trade entry should be reflected.
        .onConflictDoUpdate({
          target: [netWorthDaily.userId, netWorthDaily.sessionDate],
          set: {
            assetsPaisa: raw`excluded.assets_paisa`,
            liabilitiesPaisa: raw`excluded.liabilities_paisa`,
          },
        });
    }

    await db
      .update(syncRuns)
      .set({ status: "ok", rowsWritten: rows.length, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));

    return { action: "written", users: rows.length, date };
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    await db
      .update(syncRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));
    throw e;
  }
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

type StockRow = typeof stockTransactions.$inferSelect;
type FundRow = typeof fundTransactions.$inferSelect;

const toTrade = (t: StockRow): Trade => ({
  symbol: t.symbol,
  type: t.type,
  quantity: Number(t.quantity),
  pricePaisa: t.pricePaisa,
  chargesPaisa: (t.commissionPaisa ?? 0) + (t.otherChargesPaisa ?? 0),
  tradedAt: String(t.tradedAt),
});

const toOrder = (o: FundRow): FundOrder => ({
  fundId: o.fundId,
  type: o.type,
  units: Number(o.units),
  navPaisa: o.navPaisa,
  tradedAt: String(o.tradedAt),
});
