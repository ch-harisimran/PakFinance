/**
 * Daily net-worth snapshot — the entry point GitHub Actions calls.
 *
 *   npx tsx scripts/snapshot.ts
 *   npx tsx scripts/snapshot.ts --force   (rewrite today's row)
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Dynamic import: static imports are hoisted above dotenv, so the db client
// would read process.env before it was populated.
async function main() {
  const { runSnapshot } = await import("../lib/market/snapshot");
  const result = await runSnapshot({ force: process.argv.includes("--force") });
  console.log(JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("snapshot failed:", (e as Error).message);
    process.exit(1);
  });
