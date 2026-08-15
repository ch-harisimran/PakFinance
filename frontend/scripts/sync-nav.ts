/**
 * Scheduled MUFAP NAV sync — the entry point GitHub Actions calls.
 *
 *   npx tsx scripts/sync-nav.ts
 *   npx tsx scripts/sync-nav.ts --force
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/**
 * Dynamic import, as in sync-psx: static imports are hoisted above every
 * statement here, so the db client would read process.env before dotenv had
 * populated it.
 */
async function main() {
  const { runNavSync } = await import("../lib/market/sync-nav");
  const result = await runNavSync({ force: process.argv.includes("--force") });
  console.log(JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("nav sync failed:", (e as Error).message);
    process.exit(1);
  });
