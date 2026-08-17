/**
 * Merge a duplicate fund into the one it really is.
 *
 *   npm run merge:funds -- --duplicates            (find likely pairs)
 *   npm run merge:funds -- --from <id> --into <id>
 *   npm run merge:funds -- --from <id> --into <id> --commit
 *
 * Why this exists: MUFAP publishes no stable fund code, so a fund is identified
 * by its name. When an AMC renames one, the NAV sync sees a name it has never
 * met and creates a second fund. The user's units stay on the old row while new
 * NAVs land on the new one, and the position quietly stops repricing — no error,
 * just a number that stopped moving.
 *
 * Merging moves every order onto the surviving fund, moves the NAV history,
 * records the old name as an alias so the sync never splits them again, and
 * deletes the duplicate.
 *
 * Dry by default: it prints what it would do and changes nothing until
 * --commit. Orders are somebody's financial record.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  const next = process.argv[i + 1];
  return i === -1 || !next || next.startsWith("--") ? undefined : next;
}

async function main() {
  const { db } = await import("../lib/db/client");
  const { sql: raw } = await import("drizzle-orm");

  if (process.argv.includes("--duplicates")) {
    /**
     * A rename has a signature in the DATA, not in the name.
     *
     * Matching on similar names does not work here, and the reason is worth
     * recording: Pakistani AMCs issue long numbered runs ("Fixed Rate Plan XXVII,
     * XXVIII, XXIX") and umbrella funds with bracketed sub-plans ("… (Plan I)",
     * "… (Plan VI)"). Those are all genuinely separate funds with near-identical
     * names, and they swamp any similarity threshold loose enough to catch a
     * real rename.
     *
     * What a rename actually looks like is a handover: NAVs stop arriving under
     * the old name at the point they start arriving under the new one. Two funds
     * that both received NAVs on the same day are two funds, whatever their
     * names. So the test is non-overlapping histories with a small gap.
     */
    /**
     * The signal needs CONTINUOUS history, not just several dates.
     *
     * NAVs imported from a handful of saved MUFAP pages cover different funds on
     * different days, so "A's NAVs stop where B's start" fires constantly for
     * funds that are simply in different files. Measured on the median fund
     * rather than the total, because one well-covered fund does not make the set
     * usable.
     */
    const [{ median }] = (await db.execute(
      raw`select coalesce(
                   percentile_cont(0.5) within group (
                     order by n
                   )::int, 0) as median
            from (
              select count(distinct session_date) as n
                from market.fund_navs group by fund_id
            ) per_fund`,
    )) as unknown as { median: number }[];

    if (median < 10) {
      console.log(
        `Not enough NAV history to tell a rename from a coincidence.\n\n` +
          `The typical fund here has ${median} day(s) of NAV data. Detection works by\n` +
          `spotting one fund's NAVs stopping exactly where another's begin, and with\n` +
          `sparse coverage that pattern appears between funds that merely happen to\n` +
          `sit in different imports — it produced 50 confident-looking false positives\n` +
          `on this data, including numbered plans that are genuinely separate funds.\n\n` +
          `Let the NAV sync run daily for a couple of weeks, then try again.\n` +
          `Merging by hand works today:  --from <losing id> --into <surviving id>`,
      );
      return;
    }

    const pairs = (await db.execute(
      raw`with span as (
            select f.id, f.name, f.amc, f.category,
                   min(n.session_date) as first_nav,
                   max(n.session_date) as last_nav
              from market.funds f
              join market.fund_navs n on n.fund_id = f.id
             group by f.id, f.name, f.amc, f.category
          )
          select a.id::text as a_id, a.name as a_name, a.last_nav::text  as a_last,
                 b.id::text as b_id, b.name as b_name, b.first_nav::text as b_first,
                 a.amc, a.category
            from span a
            join span b
              on a.amc = b.amc
             and a.category = b.category
             and a.id <> b.id
             -- b picks up where a left off, with no overlap and a short gap.
             and b.first_nav > a.last_nav
             and b.first_nav - a.last_nav <= 30
           order by a.amc, a.name
           limit 50`,
    )) as unknown as Record<string, string>[];

    if (!pairs.length) {
      console.log("No renames detected — every fund's NAV history overlaps its siblings'.");
      return;
    }

    console.log(`${pairs.length} possible rename(s):\n`);
    for (const p of pairs) {
      console.log(`  ${p.amc} · ${p.category}`);
      console.log(`    ${p.a_id}  ${p.a_name}   (last NAV ${p.a_last})`);
      console.log(`    ${p.b_id}  ${p.b_name}   (first NAV ${p.b_first})\n`);
    }
    console.log("These are CANDIDATES, not conclusions — read both names before merging.");
    console.log("Merge with:  --from <losing id> --into <surviving id>");
    return;
  }

  const from = arg("--from");
  const into = arg("--into");
  const commit = process.argv.includes("--commit");

  if (!from || !into) {
    console.error("Pass --from <id> --into <id>, or --duplicates to look for candidates.");
    process.exit(1);
  }
  if (from === into) {
    console.error("--from and --into are the same fund.");
    process.exit(1);
  }

  const rows = (await db.execute(
    raw`select id::text as id, name, amc, category from market.funds
         where id = any(array[${from}::uuid, ${into}::uuid])`,
  )) as unknown as { id: string; name: string; amc: string; category: string }[];

  const losing = rows.find((r) => r.id === from);
  const surviving = rows.find((r) => r.id === into);
  if (!losing || !surviving) {
    console.error("One of those fund ids does not exist.");
    process.exit(1);
  }

  const [{ orders }] = (await db.execute(
    raw`select count(*)::int as orders from public.fund_transactions where fund_id = ${from}::uuid`,
  )) as unknown as { orders: number }[];
  const [{ navs }] = (await db.execute(
    raw`select count(*)::int as navs from market.fund_navs where fund_id = ${from}::uuid`,
  )) as unknown as { navs: number }[];

  console.log(`losing:    ${losing.name}  (${losing.amc} · ${losing.category})`);
  console.log(`surviving: ${surviving.name}  (${surviving.amc} · ${surviving.category})`);
  console.log(`\nwould move ${orders} order(s) and ${navs} NAV row(s), then record`);
  console.log(`"${losing.name}" as an alias of the surviving fund and delete the duplicate.`);

  if (!commit) {
    console.log("\nDry run. Re-run with --commit to apply.");
    return;
  }

  // One transaction: a half-finished merge leaves orders pointing at a fund
  // that no longer exists.
  await db.execute(raw`begin`);
  try {
    await db.execute(
      raw`update public.fund_transactions set fund_id = ${into}::uuid where fund_id = ${from}::uuid`,
    );
    // NAVs are keyed (fund_id, session_date); a date already present on the
    // survivor wins, so the duplicate's copy is simply dropped.
    await db.execute(
      raw`insert into market.fund_navs (fund_id, session_date, nav, offer, repurchase)
          select ${into}::uuid, session_date, nav, offer, repurchase
            from market.fund_navs where fund_id = ${from}::uuid
          on conflict do nothing`,
    );
    await db.execute(raw`delete from market.fund_navs where fund_id = ${from}::uuid`);
    await db.execute(
      raw`insert into market.fund_aliases (alias, fund_id, note)
          values (${losing.name}, ${into}::uuid, 'merged duplicate')
          on conflict (alias) do update set fund_id = excluded.fund_id`,
    );
    await db.execute(raw`delete from market.funds where id = ${from}::uuid`);
    await db.execute(raw`commit`);
  } catch (e) {
    await db.execute(raw`rollback`);
    throw e;
  }

  console.log("\nmerged.");
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error("merge failed:", (e as Error).message);
    process.exit(1);
  });
