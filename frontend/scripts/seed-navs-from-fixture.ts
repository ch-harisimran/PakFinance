/**
 * One-off: load the saved MUFAP fixture into the database.
 *
 * Proves the catalogue and NAV upserts end to end without a live URL, and
 * leaves the Mutual Funds screen populated with the real 545-fund catalogue
 * while MUFAP_NAV_URL is still unknown.
 *
 *   npx tsx scripts/seed-navs-from-fixture.ts
 */
import fs from "node:fs";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const FIXTURE = "fixtures/Performance Summary _ MUTUAL FUNDS ASSOCIATION OF PAKISTAN.html";

async function main() {
  const { parseNavReport, deriveAmc } = await import("../lib/market/mufap");
  const { db } = await import("../lib/db/client");
  const { funds, fundNavs } = await import("../lib/db/schema/market");
  const { sql } = await import("drizzle-orm");

  const rows = parseNavReport(fs.readFileSync(FIXTURE, "utf8"));
  console.log(`parsed ${rows.length} funds from fixture`);

  const tuples = rows.map(
    (r) =>
      sql`(${r.name}, ${deriveAmc(r.name)}, ${r.category}, ${r.isIslamic}, ${r.sector}, ${r.rating}, true)`,
  );
  await db.execute(sql`
    insert into market.funds (name, amc, category, is_islamic, sector, rating, is_active)
    values ${sql.join(tuples, sql`, `)}
    on conflict (lower(name), category) do update set
      amc = excluded.amc, is_islamic = excluded.is_islamic,
      sector = excluded.sector, rating = excluded.rating, is_active = true
  `);

  const catalogue = await db
    .select({ id: funds.id, name: funds.name, category: funds.category })
    .from(funds);
  const byKey = new Map(catalogue.map((f) => [`${f.name.toLowerCase()}|${f.category}`, f.id]));

  const navs = rows
    .map((r) => {
      const id = byKey.get(`${r.name.toLowerCase()}|${r.category}`);
      return id ? { fundId: id, nav: String(r.nav), sessionDate: r.navDate } : null;
    })
    .filter((v): v is { fundId: string; nav: string; sessionDate: string } => v !== null);

  await db
    .insert(fundNavs)
    .values(navs)
    .onConflictDoUpdate({
      target: [fundNavs.fundId, fundNavs.sessionDate],
      set: { nav: sql`excluded.nav` },
    });

  const [{ f }] = await db.select({ f: sql<number>`count(*)::int` }).from(funds);
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(fundNavs);
  const [{ isl }] = await db
    .select({ isl: sql<number>`count(*) filter (where ${funds.isIslamic})::int` })
    .from(funds);

  console.log(`\ncatalogue: ${f} funds (${isl} Shariah-compliant)`);
  console.log(`nav rows:  ${n}`);
  console.log(`resolved:  ${navs.length} of ${rows.length}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
