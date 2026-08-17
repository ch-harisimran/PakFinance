/**
 * One-time backfill of ~5 years of daily closes into market.prices_daily.
 *
 *   npx tsx scripts/backfill-eod.ts            full run
 *   npx tsx scripts/backfill-eod.ts --limit 5  smoke test
 *   npx tsx scripts/backfill-eod.ts --delay 3000
 *
 * A script rather than a cron route: it runs for ~20 minutes, which no
 * serverless function will tolerate, and it only ever needs to run once.
 *
 * Resumable by design. Symbols that already have rows are skipped, so a failure
 * partway through costs nothing — rerun and it continues. Sequential with a
 * deliberate delay: ~495 requests is the most conspicuous thing this project
 * will ever do to PSX, and there is no reason to be in a hurry.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { psxProvider } from "../lib/market/psx";

const args = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const LIMIT = flag("limit", Infinity);
const DELAY = flag("delay", 2000);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = postgres(url, { max: 1, idle_timeout: 20, connect_timeout: 20 });

  console.log("fetching market watch …");
  const quotes = await psxProvider.getMarketWatch();
  console.log(`  ${quotes.length} symbols`);

  // Securities first — prices_daily has a foreign key to it.
  for (const q of quotes) {
    await sql`
      insert into market.securities (symbol, name, kind, sector, board, last_seen_at)
      values (${q.symbol}, ${q.symbol}, ${q.kind}, ${q.sectorCode}, ${q.indices.join(",") || null}, now())
      on conflict (symbol) do update
        set kind = excluded.kind,
            sector = excluded.sector,
            board = excluded.board,
            is_active = true,
            last_seen_at = now()`;
  }
  console.log(`  upserted ${quotes.length} securities`);

  const done = await sql<{ symbol: string }[]>`
    select distinct symbol from market.prices_daily`;
  const already = new Set(done.map((r) => r.symbol));
  const todo = quotes.map((q) => q.symbol).filter((s) => !already.has(s)).slice(0, LIMIT);

  console.log(`\n${already.size} symbols already backfilled · ${todo.length} to go`);
  console.log(`delay ${DELAY}ms → about ${Math.ceil((todo.length * DELAY) / 60000)} min\n`);

  let ok = 0;
  let failed = 0;
  let bars = 0;

  for (const [i, symbol] of todo.entries()) {
    try {
      const history = await psxProvider.getDailyHistory(symbol);
      if (history.length) {
        // One statement per symbol rather than per bar — ~1,200 round trips
        // each would take hours.
        await sql`
          insert into market.prices_daily ${sql(
            history.map((b) => ({
              symbol,
              session_date: b.date,
              close: String(b.close),
              volume: b.volume === null ? null : Math.round(b.volume),
            })),
            "symbol",
            "session_date",
            "close",
            "volume",
          )}
          on conflict (symbol, session_date) do nothing`;
        bars += history.length;
      }
      ok++;
      const pct = (((i + 1) / todo.length) * 100).toFixed(0);
      console.log(
        `[${String(i + 1).padStart(3)}/${todo.length}] ${pct.padStart(3)}%  ${symbol.padEnd(10)} ${String(history.length).padStart(5)} bars`,
      );
    } catch (e) {
      failed++;
      console.log(`[${String(i + 1).padStart(3)}/${todo.length}]      ${symbol.padEnd(10)} FAILED ${(e as Error).message}`);
    }
    if (i < todo.length - 1) await sleep(DELAY);
  }

  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count from market.prices_daily`;
  console.log(`\ndone · ${ok} ok · ${failed} failed · ${bars} bars written · ${count} rows total`);

  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
