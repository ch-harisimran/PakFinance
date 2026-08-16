/**
 * Seed corporate actions.
 *
 *   npm run seed:actions -- --file actions.csv
 *   npm run seed:actions -- --list          (what is already recorded)
 *
 * CSV columns: symbol,kind,ex_date,ratio_from,ratio_to,new_symbol,note
 *
 *   OGDC,SPLIT,2026-03-01,1,10,,Ten-for-one
 *   HBL,SYMBOL_CHANGE,2026-04-15,,,HBLX,Ticker change
 *   ABC,MERGER,2026-05-01,2,1,XYZ,Two ABC shares became one XYZ
 *
 * ONLY SPLIT, SYMBOL_CHANGE and MERGER are applied to holdings. Bonus and right
 * issues are entered by the user as trades, from their broker note — recording
 * them here as well would count the shares twice.
 *
 * PSX publishes no machine-readable corporate actions feed we hold a licence
 * for, which is why this is a file you supply rather than a sync. Entering
 * nothing is safe: with no rows, holdings behave exactly as they did before.
 */
import fs from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const APPLIED = new Set(["SPLIT", "SYMBOL_CHANGE", "MERGER"]);
const KNOWN = new Set([...APPLIED, "BONUS", "RIGHT", "DIVIDEND"]);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const next = process.argv[i + 1];
  return i === -1 || !next || next.startsWith("--") ? undefined : next;
}

interface Row {
  symbol: string;
  kind: string;
  exDate: string;
  ratioFrom: string | null;
  ratioTo: string | null;
  newSymbol: string | null;
  note: string | null;
}

function parseCsv(text: string): { rows: Row[]; problems: string[] } {
  const rows: Row[] = [];
  const problems: string[] = [];

  text.split(/\r?\n/).forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const cells = trimmed.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const [symbol, kind, exDate, ratioFrom, ratioTo, newSymbol, ...rest] = cells;

    if (/^symbol$/i.test(symbol ?? "")) return; // header

    const where = `line ${i + 1}`;
    if (!symbol || !kind || !exDate) {
      problems.push(`${where}: needs at least symbol, kind and ex_date`);
      return;
    }
    const upper = kind.toUpperCase();
    if (!KNOWN.has(upper)) {
      problems.push(`${where}: unknown kind "${kind}"`);
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(exDate)) {
      problems.push(`${where}: ex_date must be YYYY-MM-DD, got "${exDate}"`);
      return;
    }
    if (upper === "SPLIT" && !(Number(ratioFrom) > 0 && Number(ratioTo) > 0)) {
      problems.push(`${where}: a SPLIT needs both ratio_from and ratio_to`);
      return;
    }
    if ((upper === "SYMBOL_CHANGE" || upper === "MERGER") && !newSymbol) {
      problems.push(`${where}: ${upper} needs new_symbol`);
      return;
    }

    rows.push({
      symbol: symbol.toUpperCase(),
      kind: upper,
      exDate,
      ratioFrom: ratioFrom || null,
      ratioTo: ratioTo || null,
      newSymbol: newSymbol ? newSymbol.toUpperCase() : null,
      note: rest.join(",") || null,
    });
  });

  return { rows, problems };
}

async function main() {
  const { db } = await import("../lib/db/client");
  const { corporateActions } = await import("../lib/db/schema/market");
  const { sql: raw } = await import("drizzle-orm");

  if (process.argv.includes("--list")) {
    const existing = (await db.execute(
      raw`select symbol, kind::text as kind, ex_date::text as ex_date,
                 ratio_from, ratio_to, new_symbol
            from market.corporate_actions order by ex_date desc, symbol`,
    )) as unknown as Record<string, unknown>[];

    if (!existing.length) {
      console.log("No corporate actions recorded.");
      return;
    }
    for (const r of existing) {
      const applied = APPLIED.has(String(r.kind)) ? "applied" : "reference only";
      console.log(
        `${r.ex_date}  ${String(r.symbol).padEnd(8)} ${String(r.kind).padEnd(14)} ` +
          `${r.ratio_from ?? ""}${r.ratio_to ? `:${r.ratio_to}` : ""}` +
          `${r.new_symbol ? ` → ${r.new_symbol}` : ""}  (${applied})`,
      );
    }
    return;
  }

  const file = arg("--file");
  if (!file) {
    console.error("Pass --file <actions.csv>, or --list to see what is recorded.");
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(`No such file: ${file}`);
    process.exit(1);
  }

  const { rows, problems } = parseCsv(fs.readFileSync(file, "utf8"));

  // Refuse the whole file rather than apply half of it. A partially applied
  // split is worse than none: the numbers look plausible and are wrong.
  if (problems.length) {
    console.error("Nothing was written. Fix these first:\n");
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  if (!rows.length) {
    console.error("No rows found in that file.");
    process.exit(1);
  }

  // Symbols must exist — the FK would reject them anyway, with a worse message.
  const symbols = [...new Set(rows.flatMap((r) => [r.symbol, r.newSymbol].filter(Boolean) as string[]))];
  const known = (await db.execute(
    raw`select symbol from market.securities where symbol = any(${symbols}::text[])`,
  )) as unknown as { symbol: string }[];
  const knownSet = new Set(known.map((k) => k.symbol));

  const unknown = symbols.filter((s) => !knownSet.has(s));
  if (unknown.length) {
    console.error(`Not listed on PSX as far as this database knows: ${unknown.join(", ")}`);
    console.error("Run the PSX sync first, or check the spelling. Nothing was written.");
    process.exit(1);
  }

  await db
    .insert(corporateActions)
    .values(
      rows.map((r) => ({
        symbol: r.symbol,
        kind: r.kind as "SPLIT" | "SYMBOL_CHANGE" | "MERGER" | "BONUS" | "RIGHT" | "DIVIDEND",
        exDate: r.exDate,
        ratioFrom: r.ratioFrom,
        ratioTo: r.ratioTo,
        newSymbol: r.newSymbol,
        note: r.note,
      })),
    )
    .onConflictDoUpdate({
      target: [corporateActions.symbol, corporateActions.kind, corporateActions.exDate],
      set: {
        ratioFrom: raw`excluded.ratio_from`,
        ratioTo: raw`excluded.ratio_to`,
        newSymbol: raw`excluded.new_symbol`,
        note: raw`excluded.note`,
      },
    });

  const applied = rows.filter((r) => APPLIED.has(r.kind)).length;
  console.log(
    `seeded ${rows.length} action(s); ${applied} will be applied to holdings, ` +
      `${rows.length - applied} recorded for reference only.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("seed failed:", (e as Error).message);
    process.exit(1);
  });
