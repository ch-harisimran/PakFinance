/**
 * Reconcile our symbol universe against what PSX is actually publishing.
 *
 *   npm run reconcile:psx
 *
 * The universe is discovered from the market watch feed rather than curated, so
 * "is our coverage complete" has never had an answer — only an assumption. This
 * asks the feed directly and reports four things:
 *
 *   - symbols PSX lists that we have never seen (a gap in coverage)
 *   - symbols we hold that PSX no longer lists (delisted, or renamed)
 *   - the kind breakdown, so ETFs, REITs and debt are visibly represented
 *     rather than assumed
 *   - any symbol a user holds that has fallen out of the feed, which is the
 *     only case here that costs somebody money
 *
 * Read-only. It changes nothing; the PSX sync is what writes.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { db } = await import("../lib/db/client");
  const { sql: raw } = await import("drizzle-orm");
  const { psxProvider } = await import("../lib/market/psx");

  console.log("fetching the PSX market watch…");
  const quotes = await psxProvider.getMarketWatch();
  const live = new Map(quotes.map((q) => [q.symbol, q] as const));
  console.log(`PSX lists ${live.size} symbols\n`);

  const stored = (await db.execute(
    raw`select symbol, kind::text as kind, is_active from market.securities`,
  )) as unknown as { symbol: string; kind: string; is_active: boolean }[];
  const storedSet = new Set(stored.map((s) => s.symbol));

  const missing = [...live.keys()].filter((s) => !storedSet.has(s));
  console.log(`Missing from our database: ${missing.length}`);
  if (missing.length) console.log(`  ${missing.join(", ")}`);

  const gone = stored.filter((s) => s.is_active && !live.has(s.symbol)).map((s) => s.symbol);
  console.log(`\nActive here but absent from the feed: ${gone.length}`);
  if (gone.length) {
    console.log(`  ${gone.slice(0, 40).join(", ")}${gone.length > 40 ? " …" : ""}`);
    console.log("  (delisted, suspended, or renamed — a rename needs a SYMBOL_CHANGE action)");
  }

  // Kind breakdown from the live feed, via the same classifier the sync uses.
  const byKind = new Map<string, number>();
  for (const q of live.values()) byKind.set(q.kind, (byKind.get(q.kind) ?? 0) + 1);
  console.log("\nWhat PSX is publishing, by kind:");
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind.padEnd(8)} ${n}`);
  }

  // The only part of this that can cost a user money.
  const held = (await db.execute(
    raw`select distinct symbol from public.stock_transactions`,
  )) as unknown as { symbol: string }[];

  const orphaned = held.map((h) => h.symbol).filter((s) => !live.has(s));
  console.log(`\nSymbols users hold that PSX is not currently listing: ${orphaned.length}`);
  if (orphaned.length) {
    console.log(`  ${orphaned.join(", ")}`);
    console.log("  These will not reprice. Check for a rename before assuming a delisting.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("reconcile failed:", (e as Error).message);
    process.exit(1);
  });
