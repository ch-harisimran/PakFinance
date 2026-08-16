import { and, desc, eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { fundNavs, funds, syncRuns } from "@/lib/db/schema/market";
import { deriveAmc, fetchNavReport, parseNavReport, type NavRow } from "@/lib/market/mufap";

/**
 * MUFAP NAV sync.
 *
 * Once a day, after the close. Unlike PSX there are no trading sessions to
 * respect — NAVs are published when they are published — so the only guard is
 * "have we already got today's report".
 *
 * Every fund carries its OWN validity date. Some are days or weeks stale
 * (matured fixed-term plans, suspended funds), so a single sync-wide "as of"
 * would be a lie. `fund_navs` is keyed on (fund_id, session_date), which stores
 * that faithfully and makes re-running the sync idempotent.
 */

/** Skip a re-sync if the last successful one was under this many hours ago. */
const MIN_INTERVAL_HOURS = 12;

export type NavSyncResult =
  | { action: "skipped"; reason: string; detail?: string }
  | { action: "synced"; funds: number; navs: number; newFunds: number; latest: string };

export async function runNavSync({
  force = false,
  html,
}: {
  force?: boolean;
  /**
   * Pre-fetched report HTML, bypassing the network entirely.
   *
   * MUFAP sits behind a Cloudflare JavaScript challenge, so no server-side
   * fetch can reach it — the response is an interstitial, not the report. The
   * supported path is therefore a file you saved from your own browser, which
   * this ingests through exactly the same parser and upserts.
   */
  html?: string;
} = {}): Promise<NavSyncResult> {
  /**
   * The interval guard only applies to network syncs.
   *
   * Its whole purpose is to avoid re-requesting MUFAP's report. When `html` is
   * supplied there is no request to throttle — someone has deliberately saved a
   * file and asked for it to be ingested, and refusing that is obstruction
   * rather than protection.
   */
  if (!force && !html) {
    const [last] = await db
      .select({ startedAt: syncRuns.startedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.job, "sync-nav"), eq(syncRuns.status, "ok")))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    if (last) {
      const hours = (Date.now() - last.startedAt.getTime()) / 36e5;
      if (hours < MIN_INTERVAL_HOURS) {
        await db.insert(syncRuns).values({
          job: "sync-nav",
          status: "skipped",
          reason: "too-soon",
          finishedAt: new Date(),
        });
        return {
          action: "skipped",
          reason: "too-soon",
          detail: `${hours.toFixed(1)}h of ${MIN_INTERVAL_HOURS}h`,
        };
      }
    }
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ job: "sync-nav", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const rows = html ? parseNavReport(html) : await fetchNavReport();
    if (!rows.length) throw new Error("report parsed to zero rows");
    const before = await db.select({ n: raw<number>`count(*)::int` }).from(funds);

    await upsertFunds(rows);
    const navCount = await upsertNavs(rows);

    const after = await db.select({ n: raw<number>`count(*)::int` }).from(funds);
    const latest = rows.reduce((d, r) => (r.navDate > d ? r.navDate : d), rows[0].navDate);

    await db
      .update(syncRuns)
      .set({ status: "ok", rowsWritten: navCount, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));

    return {
      action: "synced",
      funds: rows.length,
      navs: navCount,
      newFunds: after[0].n - before[0].n,
      latest,
    };
  } catch (e) {
    const message = (e as Error).message.slice(0, 500);
    await db
      .update(syncRuns)
      .set({ status: "error", error: message, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));
    throw e;
  }
}

/**
 * Upsert the catalogue on (lower(name), category) — the compound identity that
 * keeps VPS sub-funds apart.
 *
 * `created_by` is deliberately not touched: a fund a user added by hand keeps
 * its owner, and simply gains the official metadata once MUFAP lists it.
 */
async function upsertFunds(rows: NavRow[]) {
  /**
   * Raw SQL, deliberately: the unique index is on the EXPRESSION
   * `(lower(name), category)`, and Drizzle's onConflictDoUpdate target only
   * accepts plain columns. Writing it out is preferable to weakening the index
   * to plain `(name, category)`, which would let a capitalisation change in
   * MUFAP's report silently duplicate every fund.
   */
  const tuples = rows.map(
    (r) =>
      raw`(${r.name}, ${deriveAmc(r.name)}, ${r.category}, ${r.isIslamic}, ${r.sector}, ${r.rating}, true)`,
  );

  await db.execute(raw`
    insert into market.funds (name, amc, category, is_islamic, sector, rating, is_active)
    values ${raw.join(tuples, raw`, `)}
    on conflict (lower(name), category) do update set
      amc        = excluded.amc,
      is_islamic = excluded.is_islamic,
      sector     = excluded.sector,
      rating     = excluded.rating,
      is_active  = true
  `);
}

async function upsertNavs(rows: NavRow[]): Promise<number> {
  // Resolve ids by the same compound key the catalogue is stored under.
  const existing = await db
    .select({ id: funds.id, name: funds.name, category: funds.category })
    .from(funds);

  const byKey = new Map(existing.map((f) => [`${f.name.toLowerCase()}|${f.category}`, f.id]));

  const values = rows
    .map((r) => {
      const id = byKey.get(`${r.name.toLowerCase()}|${r.category}`);
      return id ? { fundId: id, nav: String(r.nav), sessionDate: r.navDate } : null;
    })
    .filter((v): v is { fundId: string; nav: string; sessionDate: string } => v !== null);

  if (!values.length) return 0;

  await db
    .insert(fundNavs)
    .values(values)
    // A restated NAV should overwrite, not be ignored.
    .onConflictDoUpdate({
      target: [fundNavs.fundId, fundNavs.sessionDate],
      set: { nav: raw`excluded.nav` },
    });

  return values.length;
}
