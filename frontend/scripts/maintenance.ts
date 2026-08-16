/**
 * Housekeeping: prune what has aged out, then report on job health.
 *
 *   npm run maintenance -- --dry-run   (report only, delete nothing, send nothing)
 *   npm run maintenance
 *
 * Pruning runs first so the watchdog's view of sync_runs is the trimmed one.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const { runWatchdog } = await import("../lib/notify/watchdog");
  const { runRecurringPostings } = await import("../lib/market/post-recurring");

  // Before the watchdog, so a failure to post shows up in the same run.
  const posted = await runRecurringPostings({ dryRun });
  console.log(
    posted.action === "posted"
      ? `recurring: ${posted.entries} entry(s) from ${posted.rules} rule(s)${dryRun ? " (dry run)" : ""}`
      : `recurring: ${posted.reason}`,
  );

  if (!dryRun) {
    const { runPrune } = await import("../lib/market/prune");
    const pruned = await runPrune();
    console.log(
      `pruned: ${pruned.intradayDeleted} intraday prices, ${pruned.syncRunsDeleted} sync runs, ` +
        `${pruned.rateLimitsDeleted} spent rate limits ` +
        `(${pruned.intradayRemaining} intraday rows remain)`,
    );
  } else {
    console.log("dry run: skipping prune");
  }

  const health = await runWatchdog({ dryRun });
  if (health.action === "checked" && health.problems > 0) {
    console.log(`\n${health.problems} problem(s):`);
    for (const line of health.detail) console.log(`  • ${line}`);
    console.log(health.notified ? "\nalert emailed" : "\nno alert sent");
  } else {
    console.log("job health: all clear");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("maintenance failed:", (e as Error).message);
    process.exit(1);
  });
