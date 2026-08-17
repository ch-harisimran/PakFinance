/**
 * Seed PSX sector names.
 *
 *   npm run seed:sectors -- --file sectors.csv
 *
 * The market watch feed carries sector CODES and never names, so this mapping
 * has to come from outside. Supply a two-column CSV — code,name — one per line,
 * with or without a header:
 *
 *   0813,Commercial Banks
 *   0825,Oil & Gas Exploration Companies
 *
 * Codes not listed simply stay unnamed; the app shows "Sector 0813" for those,
 * which is the honest fallback. Nothing here guesses.
 *
 * Run `--codes` to print the codes actually present in your data, so you only
 * have to look up the ones that matter.
 */
import fs from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : undefined;
}

/** Minimal CSV: handles quoted fields, which sector names need for commas. */
function parseCsv(text: string): [string, string][] {
  const out: [string, string][] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const cells: string[] = [];
    let cur = "";
    let quoted = false;

    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (quoted) {
        if (ch === '"' && trimmed[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          quoted = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);

    const code = (cells[0] ?? "").trim();
    const name = (cells[1] ?? "").trim();
    if (!code || !name) continue;
    if (/^code$/i.test(code)) continue; // header row
    out.push([code, name]);
  }

  return out;
}

async function main() {
  const { db } = await import("../lib/db/client");
  const { sectors, securities } = await import("../lib/db/schema/market");
  const { sql: raw } = await import("drizzle-orm");

  if (process.argv.includes("--codes")) {
    const rows = (await db.execute(
      raw`select s.sector as code, count(*)::int as n, x.name
            from market.securities s
            left join market.sectors x on x.code = s.sector
           where s.sector is not null
           group by s.sector, x.name
           order by n desc`,
    )) as unknown as { code: string; n: number; name: string | null }[];

    console.log("code   symbols  name");
    for (const r of rows) {
      console.log(`${r.code}   ${String(r.n).padStart(5)}    ${r.name ?? "— not seeded —"}`);
    }
    console.log(`\n${rows.filter((r) => !r.name).length} of ${rows.length} codes still unnamed.`);
    return;
  }

  const file = arg("--file");
  if (!file) {
    console.error("Pass --file <sectors.csv>, or --codes to list what needs naming.");
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`No such file: ${file}`);
    process.exit(1);
  }

  const pairs = parseCsv(fs.readFileSync(file, "utf8"));
  if (!pairs.length) {
    console.error("No code,name rows found in that file.");
    process.exit(1);
  }

  await db
    .insert(sectors)
    .values(pairs.map(([code, name]) => ({ code, name })))
    // Re-running with a corrected file should fix names, not fail on the PK.
    .onConflictDoUpdate({ target: sectors.code, set: { name: raw`excluded.name` } });

  const [{ n }] = (await db.execute(
    raw`select count(distinct s.sector)::int as n
          from market.securities s
          join market.sectors x on x.code = s.sector`,
  )) as unknown as { n: number }[];

  const [{ total }] = (await db.execute(
    raw`select count(distinct sector)::int as total from ${securities} where sector is not null`,
  )) as unknown as { total: number }[];

  console.log(`seeded ${pairs.length} sector names; ${n} of ${total} codes in use are now named.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("seed failed:", (e as Error).message);
    process.exit(1);
  });
