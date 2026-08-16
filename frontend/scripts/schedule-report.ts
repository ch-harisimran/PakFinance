/**
 * Is each scheduled job actually running on its schedule?
 *
 *   npm run schedule:report
 *
 * A workflow that is green when you click it proves the code, the secrets and
 * the runner. It does not prove the cron is firing — and that failure leaves no
 * trace at all: GitHub silently disables schedules on repositories with 60 days
 * of inactivity, and a workflow that never runs produces no log and no red tick.
 *
 * Every job run now records HOW it started, so this can separate the two. A job
 * whose only recent runs are `workflow_dispatch` is a job whose schedule is not
 * working, however green its history looks.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

interface Expectation {
  job: string;
  label: string;
  /** Hours between scheduled runs, at the coarsest. */
  everyHours: number;
  cron: string;
}

const EXPECTED: Expectation[] = [
  { job: "sync-psx", label: "PSX price sync", everyHours: 24, cron: "0,30 4-12 * * 1-5" },
  { job: "snapshot", label: "Net-worth snapshot", everyHours: 24, cron: "30 13 * * *" },
  { job: "loan-reminders", label: "Loan reminders", everyHours: 24, cron: "30 3 * * *" },
  { job: "recurring", label: "Recurring postings", everyHours: 24, cron: "30 4 * * * (maintenance)" },
  { job: "sync-nav", label: "MUFAP NAV sync", everyHours: 24 * 14, cron: "DISABLED — Cloudflare" },
];

async function main() {
  const { db } = await import("../lib/db/client");
  const { sql: raw } = await import("drizzle-orm");

  const rows = (await db.execute(
    raw`select job,
               coalesce(trigger, 'unknown')                       as trigger,
               count(*)::int                                      as runs,
               max(started_at)                                    as last_run,
               count(*) filter (where status = 'error')::int      as errors
          from market.sync_runs
         where started_at > now() - interval '30 days'
         group by job, coalesce(trigger, 'unknown')
         order by job, trigger`,
  )) as unknown as {
    job: string;
    trigger: string;
    runs: number;
    last_run: string;
    errors: number;
  }[];

  const byJob = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byJob.get(r.job) ?? [];
    list.push(r);
    byJob.set(r.job, list);
  }

  console.log("Job runs in the last 30 days, by how they were started\n");

  let unproven = 0;
  for (const e of EXPECTED) {
    const entries = byJob.get(e.job) ?? [];
    const scheduled = entries.find((r) => r.trigger === "schedule");

    console.log(`${e.label}  (${e.cron})`);

    if (!entries.length) {
      console.log("  no runs recorded at all");
    } else {
      for (const r of entries) {
        console.log(
          `  ${r.trigger.padEnd(18)} ${String(r.runs).padStart(4)} run(s)` +
            `${r.errors ? `, ${r.errors} error(s)` : ""}` +
            `  last ${String(r.last_run).slice(0, 19)}`,
        );
      }
    }

    if (e.cron.startsWith("DISABLED")) {
      console.log("  → schedule intentionally off\n");
      continue;
    }

    if (!scheduled) {
      unproven++;
      console.log(
        "  → NOT PROVEN: no run has been started by the cron itself.\n" +
          "    Manual runs do not demonstrate the schedule works.\n",
      );
      continue;
    }

    const hoursAgo = (Date.now() - Date.parse(scheduled.last_run)) / 3_600_000;
    if (hoursAgo > e.everyHours * 1.5) {
      unproven++;
      console.log(
        `  → STALE: last scheduled run was ${Math.floor(hoursAgo)}h ago, ` +
          `expected every ~${e.everyHours}h\n`,
      );
    } else {
      console.log(`  → firing on schedule (last ${Math.floor(hoursAgo)}h ago)\n`);
    }
  }

  console.log(
    unproven
      ? `${unproven} job(s) have not yet proven their schedule.\n` +
          "This is expected until a cron has had a chance to fire — the column is new.\n" +
          "The watchdog in the maintenance job will also email once a job goes quiet."
      : "every scheduled job has fired on its own at least once.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("report failed:", (e as Error).message);
    process.exit(1);
  });
