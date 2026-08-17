/**
 * Scheduled PSX sync — the entry point GitHub Actions calls.
 *
 * Runs exactly the same `runPsxSync` the HTTP route does, but writes to
 * Supabase directly. The schedule therefore does not depend on the app being
 * deployed anywhere: the job runs on GitHub's infrastructure and talks to
 * Postgres.
 *
 *   npx tsx scripts/sync-psx.ts
 *   npx tsx scripts/sync-psx.ts --force
 */
import { config } from "dotenv";

// Locally this loads .env.local; in CI the file is absent and dotenv no-ops,
// with the values arriving from GitHub Secrets instead.
config({ path: ".env.local", quiet: true });

/**
 * The sync is imported dynamically, and that is load-bearing.
 *
 * Static imports are hoisted and evaluated before any statement in this file,
 * so `lib/db/client` would read process.env before dotenv had populated it and
 * throw "DATABASE_POOL_URL is not set". Importing inside the function defers
 * evaluation until after config() has run.
 */
async function main() {
  const { runPsxSync } = await import("../lib/market/sync");
  const result = await runPsxSync({ force: process.argv.includes("--force") });
  console.log(JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("sync failed:", (e as Error).message);
    process.exit(1);
  });
