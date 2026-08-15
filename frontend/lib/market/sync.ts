import { and, desc, eq, sql as raw } from "drizzle-orm";
// Unguarded client: this module is shared with the standalone scheduled job,
// which runs under plain Node where `server-only` throws.
import { db } from "@/lib/db/client";
import { priceLatest, prices, pricesDaily, securities, syncRuns } from "@/lib/db/schema/market";
import { psxProvider } from "@/lib/market/psx";
import { getMarketState } from "@/lib/market/sessions";

/**
 * The PSX sync, in one place.
 *
 * Called by both the HTTP route and the scheduled job, so the two can never
 * drift apart. All scheduling policy lives here rather than in a cron
 * expression — a crontab cannot know about market holidays or Ramadan hours.
 */

const MIN_INTERVAL = Number(process.env.PSX_MIN_SYNC_INTERVAL_MINUTES ?? 180);

export type SyncResult =
  | { action: "skipped"; reason: string; detail?: string; at: string }
  | {
      action: "synced";
      symbols: number;
      dailyBarWritten: boolean;
      sessionDate: string;
      at: string;
      reason: string;
    };

export async function runPsxSync({ force = false } = {}): Promise<SyncResult> {
  const state = await getMarketState();
  const at = state.now.hhmm;
  const sessionDate = state.now.date;

  // Has today's permanent bar already been written?
  const existingDaily = state.tradingDay
    ? await db
        .select({ symbol: pricesDaily.symbol })
        .from(pricesDaily)
        .where(eq(pricesDaily.sessionDate, sessionDate))
        .limit(1)
    : [];

  // The closing snapshot: the session has ended, and today has no bar yet.
  // Deliberately not a narrow window around the bell — market watch keeps
  // showing settled closing prices afterwards, so a later snapshot is safer
  // than an earlier one and absorbs scheduler drift.
  const needsDailyBar = state.tradingDay && state.inPostClose && existingDaily.length === 0;

  if (!force && !state.open && !needsDailyBar) {
    await db.insert(syncRuns).values({
      job: "sync-psx",
      status: "skipped",
      reason: state.reason,
      finishedAt: new Date(),
    });
    return { action: "skipped", reason: state.reason, detail: state.detail, at };
  }

  // The interval guard applies only to in-session refreshes. The closing
  // snapshot ignores it: on a Friday the 16:30 close falls barely two hours
  // after the 14:30 sync, so a strict interval would skip it every week.
  if (!force && !needsDailyBar) {
    const [last] = await db
      .select({ startedAt: syncRuns.startedAt })
      .from(syncRuns)
      .where(and(eq(syncRuns.status, "ok"), eq(syncRuns.job, "sync-psx")))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

    if (last) {
      const mins = Math.round((Date.now() - last.startedAt.getTime()) / 60000);
      if (mins < MIN_INTERVAL) {
        await db.insert(syncRuns).values({
          job: "sync-psx",
          status: "skipped",
          reason: "too-soon",
          finishedAt: new Date(),
        });
        return {
          action: "skipped",
          reason: "too-soon",
          detail: `${mins}m of ${MIN_INTERVAL}m`,
          at,
        };
      }
    }
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ job: "sync-psx", status: "running" })
    .returning({ id: syncRuns.id });

  try {
    const quotes = await psxProvider.getMarketWatch();
    if (!quotes.length) throw new Error("market watch returned no rows");

    const asOf = new Date();

    await db
      .insert(securities)
      .values(
        quotes.map((q) => ({
          symbol: q.symbol,
          name: q.symbol,
          kind: q.kind,
          sector: q.sectorCode,
          board: q.indices.join(",") || null,
          lastSeenAt: asOf,
        })),
      )
      .onConflictDoUpdate({
        target: securities.symbol,
        set: {
          kind: raw`excluded.kind`,
          sector: raw`excluded.sector`,
          board: raw`excluded.board`,
          isActive: true,
          lastSeenAt: asOf,
        },
      });

    await db
      .insert(priceLatest)
      .values(
        quotes.map((q) => ({
          symbol: q.symbol,
          price: String(q.current),
          ldcp: q.ldcp === null ? null : String(q.ldcp),
          dayHigh: q.high === null ? null : String(q.high),
          dayLow: q.low === null ? null : String(q.low),
          volume: q.volume,
          changePct: q.changePct === null ? null : String(q.changePct),
          asOf,
        })),
      )
      .onConflictDoUpdate({
        target: priceLatest.symbol,
        set: {
          price: raw`excluded.price`,
          ldcp: raw`excluded.ldcp`,
          dayHigh: raw`excluded.day_high`,
          dayLow: raw`excluded.day_low`,
          volume: raw`excluded.volume`,
          changePct: raw`excluded.change_pct`,
          asOf: raw`excluded.as_of`,
        },
      });

    await db
      .insert(prices)
      .values(
        quotes.map((q) => ({ symbol: q.symbol, price: String(q.current), volume: q.volume, asOf })),
      )
      .onConflictDoNothing();

    if (needsDailyBar) {
      await db
        .insert(pricesDaily)
        .values(
          quotes.map((q) => ({
            symbol: q.symbol,
            sessionDate,
            open: q.open === null ? null : String(q.open),
            high: q.high === null ? null : String(q.high),
            low: q.low === null ? null : String(q.low),
            close: String(q.current),
            volume: q.volume,
          })),
        )
        .onConflictDoUpdate({
          target: [pricesDaily.symbol, pricesDaily.sessionDate],
          set: {
            open: raw`excluded.open`,
            high: raw`excluded.high`,
            low: raw`excluded.low`,
            close: raw`excluded.close`,
            volume: raw`excluded.volume`,
          },
        });
    }

    await db
      .update(syncRuns)
      .set({
        status: "ok",
        reason: needsDailyBar ? "close-snapshot" : state.reason,
        rowsWritten: quotes.length,
        finishedAt: new Date(),
      })
      .where(eq(syncRuns.id, run.id));

    return {
      action: "synced",
      symbols: quotes.length,
      dailyBarWritten: needsDailyBar,
      sessionDate,
      at,
      reason: needsDailyBar ? "close-snapshot" : state.reason,
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
