/**
 * Back up everything that cannot be rebuilt.
 *
 *   npm run backup                 → ./backups/<timestamp>/
 *   npm run backup -- --out /path
 *   npm run backup -- --verify /path/to/backup
 *
 * `pg_dump` is the better tool and the runbook prefers it — it captures the auth
 * schema, roles and constraints, which this cannot. But pg_dump is not installed
 * everywhere, and a backup you cannot take today is worth less than a partial one
 * you can. This needs nothing but the database URL already in .env.local.
 *
 * WHAT IS IRREPLACEABLE, and therefore what this prioritises:
 *
 *   public.*                every user's financial records. Gone is gone.
 *   net_worth_daily         one row per user per day, unreconstructable — bank
 *                           balances and NAVs are only knowable on the day.
 *   market.prices_daily     five years of closes. Refetchable from the PSX EOD
 *                           feed via `npm run backfill`, but slowly, and only
 *                           while PSX still serves it.
 *
 * WHAT IS NOT COVERED, and why the runbook says so plainly:
 *
 *   auth.users              passwords and identities live in Supabase Auth.
 *                           Only pg_dump or a Supabase backup captures them.
 *   storage objects         avatar images.
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

/** Ordered so a restore can run top to bottom without violating a foreign key. */
const TABLES = [
  "public.profiles",
  "public.accounts",
  "public.transactions",
  "public.loans",
  "public.loan_payments",
  "public.goals",
  "public.goal_contributions",
  "public.stock_transactions",
  "public.fund_transactions",
  "public.assets",
  "public.budgets",
  "public.recurring_transactions",
  "public.committees",
  "public.committee_payments",
  "public.zakat_assessments",
  "public.net_worth_daily",
  "public.loan_reminders_sent",
  "market.securities",
  "market.sectors",
  "market.corporate_actions",
  "market.funds",
  "market.fund_aliases",
  "market.fund_navs",
  "market.prices_daily",
  "market.price_latest",
  "market.sessions",
  "market.market_holidays",
];

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const next = process.argv[i + 1];
  return i === -1 || !next || next.startsWith("--") ? undefined : next;
}

async function main() {
  const { db } = await import("../lib/db/client");
  const { sql: raw } = await import("drizzle-orm");

  const verifyDir = arg("--verify");
  if (verifyDir) return verify(verifyDir);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = arg("--out") ?? path.join("backups", stamp);
  fs.mkdirSync(dir, { recursive: true });

  const manifest: Record<string, number> = {};
  let total = 0;

  for (const table of TABLES) {
    try {
      // json_agg in one round trip. These tables are thousands of rows, not
      // millions; streaming would be premature and harder to verify.
      const rows = (await db.execute(
        raw.raw(`select coalesce(json_agg(t), '[]'::json) as data from ${table} t`),
      )) as unknown as { data: unknown[] }[];

      const data = rows[0]?.data ?? [];
      const file = path.join(dir, `${table.replace(".", "__")}.json`);
      fs.writeFileSync(file, JSON.stringify(data, null, 0));

      manifest[table] = data.length;
      total += data.length;
      console.log(`  ${table.padEnd(34)} ${String(data.length).padStart(8)} rows`);
    } catch (e) {
      console.error(`  ${table.padEnd(34)} FAILED — ${(e as Error).message}`);
      manifest[table] = -1;
    }
  }

  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        tables: manifest,
        totalRows: total,
        notCovered: [
          "auth.users — passwords and identities; use pg_dump or a Supabase backup",
          "storage objects — avatar images",
        ],
      },
      null,
      2,
    ),
  );

  const bytes = fs
    .readdirSync(dir)
    .reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);

  console.log(`\n${total} rows across ${TABLES.length} tables → ${dir}`);
  console.log(`${(bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log("\nauth.users is NOT in here. See docs/RUNBOOK.md before relying on this.");
  console.log(`Verify it with:  npm run backup -- --verify ${dir}`);
}

/**
 * Check a backup is readable and complete.
 *
 * An unverified backup is a rumour. This is deliberately cheap enough to run
 * every time, so the habit survives.
 */
function verify(dir: string) {
  if (!fs.existsSync(dir)) {
    console.error(`No such backup: ${dir}`);
    process.exit(1);
  }

  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("No manifest.json — this is not a backup directory.");
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    takenAt: string;
    tables: Record<string, number>;
  };

  let problems = 0;
  console.log(`Backup taken ${manifest.takenAt}\n`);

  for (const [table, expected] of Object.entries(manifest.tables)) {
    const file = path.join(dir, `${table.replace(".", "__")}.json`);

    if (expected === -1) {
      console.log(`FAIL  ${table} — failed during backup`);
      problems++;
      continue;
    }
    if (!fs.existsSync(file)) {
      console.log(`FAIL  ${table} — file missing`);
      problems++;
      continue;
    }

    try {
      const rows = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
      if (rows.length !== expected) {
        console.log(`FAIL  ${table} — ${rows.length} rows, manifest says ${expected}`);
        problems++;
      } else {
        console.log(`ok    ${table.padEnd(34)} ${String(rows.length).padStart(8)} rows`);
      }
    } catch {
      console.log(`FAIL  ${table} — file is not valid JSON`);
      problems++;
    }
  }

  console.log(problems ? `\n${problems} PROBLEM(S)` : "\nbackup is readable and complete");
  process.exit(problems ? 1 : 0);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("backup failed:", (e as Error).message);
    process.exit(1);
  });
