import { eq, sql as raw } from "drizzle-orm";
// Unguarded client: shared with the standalone scheduled job, which runs under
// plain Node where `server-only` throws.
import { db } from "@/lib/db/client";
import { funds, fundNavs, syncRuns } from "@/lib/db/schema/market";
import { runTrigger } from "@/lib/market/run-context";
import { karachiNow } from "@/lib/market/sessions";
import {
  fetchCsFunds,
  fetchCsNavs,
  planNavWrites,
  CapitalStakeNotConfigured,
  type CsNav,
} from "@/lib/market/capitalstake";

/**
 * Daily NAV refresh from the Capital Stake API.
 *
 * A separate path from `runNavSync`, which parses the MUFAP report and owns the
 * fund CATALOGUE — categories, sectors, the Islamic flag, ratings. None of that
 * is in this feed, so this job only ever moves NAVs for funds already known.
 * Keeping them apart means an API outage cannot damage the catalogue, and a
 * MUFAP import cannot be mistaken for a price update.
 */

export type NavApiResult =
  | { action: "skipped"; reason: string; detail?: string }
  | {
      action: "synced";
      navsWritten: number;
      fundsCovered: number;
      ambiguous: string[];
      uncovered: number;
      mode: "bulk" | "per-fund";
      latest: string | null;
    };

/**
 * NAVs are published by 22:00 PKT on each business day, so a run before that
 * finds yesterday's. Asking for a small window rather than a single date lets a
 * missed day catch up on the next run without a separate backfill.
 */
const LOOKBACK_DAYS = 4;

export async function runNavApiSync({ force = false } = {}): Promise<NavApiResult> {
  if (!process.env.CAPITALSTAKE_TOKEN) {
    return { action: "skipped", reason: "no-token", detail: "CAPITALSTAKE_TOKEN is not set" };
  }

  const today = karachiNow().date;
  const from = new Date(new Date(today).getTime() - LOOKBACK_DAYS * 864e5)
    .toISOString()
    .slice(0, 10);

  const local = await db.select({ id: funds.id, name: funds.name }).from(funds);
  if (!local.length) {
    return {
      action: "skipped",
      reason: "empty-catalogue",
      detail: "import the MUFAP report first — this job only updates known funds",
    };
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ job: "sync-nav-api", status: "running", trigger: runTrigger() })
    .returning({ id: syncRuns.id });

  try {
    const providerFunds = await fetchCsFunds();

    /**
     * One request for the whole market if the API allows it, else one per fund.
     *
     * The docs both mark `fund_id` required and say a date range alone is
     * enough. Rather than trust either, ask for the range and fall back — the
     * difference is one request a day against several hundred, which matters for
     * a metered API. Only funds we actually hold are fetched in the fallback,
     * not the provider's whole list.
     */
    let navs: CsNav[];
    let mode: "bulk" | "per-fund" = "bulk";

    try {
      navs = await fetchCsNavs(from, today);
    } catch (bulkError) {
      mode = "per-fund";
      const wanted = new Set(local.map((f) => f.name.trim().toLowerCase()));
      const needed = providerFunds.filter((p) => wanted.has(p.name.trim().toLowerCase()));

      console.log(
        `bulk NAV request rejected (${(bulkError as Error).message.slice(0, 120)}); ` +
          `falling back to ${needed.length} per-fund requests`,
      );

      navs = [];
      // Sequential on purpose: a metered API should not be hit with hundreds of
      // parallel requests, and this job has no deadline.
      for (const p of needed) {
        navs.push(...(await fetchCsNavs(from, today, p.id)));
      }
    }

    const report = planNavWrites(providerFunds, navs, local);

    if (report.writes.length) {
      await db
        .insert(fundNavs)
        .values(
          report.writes.map((w) => ({
            fundId: w.fundId,
            nav: String(w.nav),
            sessionDate: w.sessionDate,
          })),
        )
        // A restated NAV should overwrite, not be ignored.
        .onConflictDoUpdate({
          target: [fundNavs.fundId, fundNavs.sessionDate],
          set: { nav: raw`excluded.nav` },
        });
    } else if (!force) {
      // Nothing matched at all means the feed changed shape or the catalogue is
      // unrecognisable — worth failing loudly rather than reporting success.
      throw new Error(
        `matched no funds: ${providerFunds.length} provider funds, ${local.length} local, ` +
          `${navs.length} quotes`,
      );
    }

    const latest = report.writes.reduce<string | null>(
      (d, w) => (d === null || w.sessionDate > d ? w.sessionDate : d),
      null,
    );
    const covered = new Set(report.writes.map((w) => w.fundId)).size;

    await db
      .update(syncRuns)
      .set({
        status: "ok",
        reason: mode,
        rowsWritten: report.writes.length,
        finishedAt: new Date(),
      })
      .where(eq(syncRuns.id, run.id));

    return {
      action: "synced",
      navsWritten: report.writes.length,
      fundsCovered: covered,
      ambiguous: report.ambiguous,
      uncovered: report.unmatchedLocal.length,
      mode,
      latest,
    };
  } catch (e) {
    const message =
      e instanceof CapitalStakeNotConfigured ? e.message : (e as Error).message.slice(0, 500);
    await db
      .update(syncRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));
    throw e;
  }
}
