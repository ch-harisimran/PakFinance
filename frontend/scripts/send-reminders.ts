/**
 * Loan repayment reminders — the entry point GitHub Actions calls.
 *
 *   npx tsx scripts/send-reminders.ts --dry-run   (print, send nothing)
 *   npx tsx scripts/send-reminders.ts             (actually send)
 *
 * --dry-run first. This is the one job that talks to real people.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// Dynamic import: static imports are hoisted above dotenv, so the db client
// would read process.env before it was populated.
async function main() {
  const { runLoanReminders } = await import("../lib/notify/reminders");
  const result = await runLoanReminders({ dryRun: process.argv.includes("--dry-run") });
  console.log(JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("reminders failed:", (e as Error).message);
    process.exit(1);
  });
