import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";

/**
 * Retention.
 *
 * Two tables grow forever and nothing was trimming them. `market.prices` gains a
 * row per symbol per sync — roughly 500 rows every thirty minutes through the
 * trading day — and its usefulness collapses within days: nobody asks what OGDC
 * cost at 11:30 on a Tuesday three months ago. `market.sync_runs` gains a row per
 * job run and exists to answer "is the pipeline healthy", which is a question
 * about the recent past.
 *
 * WHAT IS DELIBERATELY NEVER PRUNED, and must not be added here:
 *
 *   market.prices_daily   the five-year backfill and every close since. This is
 *                         the entire historical record; a deleted bar cannot be
 *                         refetched once PSX rotates it out.
 *   net_worth_daily       one row per user per day, and unreconstructable —
 *                         bank balances and NAVs are only knowable on the day.
 *   loan_reminders_sent   the ledger that stops a reminder being emailed twice.
 *
 * Deletes are chunked. A single unbounded DELETE on a table with hundreds of
 * thousands of rows holds locks long enough to stall the sync running beside it.
 */

export interface PruneResult {
  intradayDeleted: number;
  syncRunsDeleted: number;
  rateLimitsDeleted: number;
  intradayRemaining: number;
}

const INTRADAY_RETENTION_DAYS = 90;
const SYNC_RUN_RETENTION_DAYS = 90;
const CHUNK = 20_000;

export async function runPrune(): Promise<PruneResult> {
  let intradayDeleted = 0;

  // Loop until a pass deletes less than a full chunk, i.e. nothing is left.
  for (;;) {
    const rows = (await db.execute(
      raw`delete from market.prices
           where ctid in (
             select ctid from market.prices
              where as_of < now() - ${`${INTRADAY_RETENTION_DAYS} days`}::interval
              limit ${CHUNK}
           )
       returning 1`,
    )) as unknown as unknown[];

    intradayDeleted += rows.length;
    if (rows.length < CHUNK) break;
  }

  const runs = (await db.execute(
    raw`delete from market.sync_runs
         where started_at < now() - ${`${SYNC_RUN_RETENTION_DAYS} days`}::interval
     returning 1`,
  )) as unknown as unknown[];

  /**
   * Spent rate-limit counters.
   *
   * A row is only meaningful while its window or its lockout is live; after that
   * it is a key nobody will ask about again. Left alone the table grows by one
   * row per (action, email) and per (action, IP) forever — and under an actual
   * attack, by one per address tried.
   */
  const limits = (await db.execute(
    raw`delete from rate_limits
         where window_start < now() - interval '2 days'
           and (blocked_until is null or blocked_until < now())
     returning 1`,
  )) as unknown as unknown[];

  const [{ n }] = (await db.execute(
    raw`select count(*)::int as n from market.prices`,
  )) as unknown as { n: number }[];

  return {
    intradayDeleted,
    syncRunsDeleted: runs.length,
    rateLimitsDeleted: limits.length,
    intradayRemaining: n,
  };
}
