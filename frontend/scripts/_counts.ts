import postgres from "postgres";
import "dotenv/config";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  const tables = ["profiles","accounts","transactions","loans","loan_payments","goals","goal_contributions","psx_trades","fund_orders","assets","budgets","recurring_rules","committees","committee_payments","zakat_assessments","net_worth_snapshots","psx_symbols","psx_bars","funds","fund_navs"];
  for (const t of tables) {
    try { const r = await sql.unsafe(`select count(*)::int as n from ${t}`); console.log(t.padEnd(22), r[0].n); }
    catch (e) { console.log(t.padEnd(22), "ERR", (e as Error).message.slice(0,60)); }
  }
  await sql.end();
}
main();
