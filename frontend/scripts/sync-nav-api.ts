/**
 * Daily NAV refresh from the Capital Stake API.
 *
 *   npm run sync:nav:api
 *
 * Needs CAPITALSTAKE_TOKEN. Exits 0 with "skipped: no-token" when it is absent,
 * so a scheduled run is a no-op rather than a failure until the token exists.
 *
 * This updates NAVs for funds already in the catalogue. The catalogue itself
 * still comes from the MUFAP report — see scripts/sync-nav.ts --file.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  // Dynamic import so dotenv has populated the environment before
  // lib/db/client reads DATABASE_POOL_URL at module scope.
  const { runNavApiSync } = await import("../lib/market/sync-nav-api");
  const result = await runNavApiSync({ force: process.argv.includes("--force") });
  console.log(JSON.stringify(result));

  if (result.action === "synced" && result.ambiguous.length) {
    console.log(
      `\n${result.ambiguous.length} fund name(s) matched several sub-plans and were SKIPPED:`,
    );
    for (const n of result.ambiguous) console.log("  ", n);
    console.log("Their NAVs stay stale rather than being written to the wrong plan.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("nav api sync failed:", (e as Error).message);
    process.exit(1);
  });
