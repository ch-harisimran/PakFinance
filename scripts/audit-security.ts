/**
 * Schema-wide security audit.
 *
 *   npm run audit:security
 *
 * `test:rls` proves the tables it knows about are locked down. This proves there
 * are no tables it does NOT know about — which is the failure that actually
 * happens: someone adds a table, forgets the policies, and every row in it is
 * readable by anyone holding the anon key, which ships to every browser.
 *
 * Read-only. Connects as `postgres` (BYPASSRLS) purely to read catalogs.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

let problems = 0;
const fail = (m: string) => {
  problems++;
  console.log(`FAIL  ${m}`);
};
const pass = (m: string) => console.log(`PASS  ${m}`);

async function main() {
  const { db } = await import("../lib/db/client");
  const { sql: raw } = await import("drizzle-orm");

  /* ── 1. Every table in `public` must have RLS enabled and forced ─────── */
  const tables = (await db.execute(
    raw`select c.relname                as name,
               c.relrowsecurity         as enabled,
               c.relforcerowsecurity    as forced,
               count(p.polname)::int    as policies
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          left join pg_policy p on p.polrelid = c.oid
         where n.nspname = 'public' and c.relkind = 'r'
         group by c.relname, c.relrowsecurity, c.relforcerowsecurity
         order by c.relname`,
  )) as unknown as { name: string; enabled: boolean; forced: boolean; policies: number }[];

  /**
   * Tables that SHOULD have no policies.
   *
   * RLS with no policy denies every client outright, which is the correct and
   * strongest posture for server-only bookkeeping — the job reaches it as
   * `postgres`, which carries BYPASSRLS. Listed explicitly so that a user-facing
   * table missing its policies still fails loudly.
   */
  const DENY_ALL_BY_DESIGN = new Set(["rate_limits", "admin_auth"]);

  console.log(`── public schema: ${tables.length} tables ──`);
  for (const t of tables) {
    if (!t.enabled) fail(`${t.name}: RLS NOT ENABLED — readable by anyone with the anon key`);
    else if (!t.forced) fail(`${t.name}: RLS not FORCED — the table owner bypasses it`);
    else if (t.policies === 0 && DENY_ALL_BY_DESIGN.has(t.name))
      pass(`${t.name}: RLS forced, deny-all (server-only by design)`);
    else if (t.policies === 0)
      fail(`${t.name}: RLS on but no policies — denies everyone, including the owner`);
    else pass(`${t.name}: RLS forced, ${t.policies} policies`);
  }

  /* ── 2. Every policy must actually scope to the caller ───────────────── */
  const loose = (await db.execute(
    raw`select c.relname as table_name, p.polname as policy,
               pg_get_expr(p.polqual, p.polrelid)      as using_expr,
               pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
          from pg_policy p
          join pg_class c on c.oid = p.polrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'`,
  )) as unknown as {
    table_name: string;
    policy: string;
    using_expr: string | null;
    check_expr: string | null;
  }[];

  console.log(`\n── ${loose.length} policies ──`);
  for (const p of loose) {
    const expr = `${p.using_expr ?? ""} ${p.check_expr ?? ""}`;
    // A policy that never mentions the caller applies to everybody.
    if (!expr.includes("auth.uid") && !expr.includes("uid()")) {
      fail(`${p.table_name}.${p.policy} does not reference auth.uid() — ${expr.trim() || "(no expression)"}`);
    }
  }
  if (!problems) pass("every policy scopes on auth.uid()");

  /* ── 3. The market schema must not be exposed through PostgREST ──────── */
  const exposed = (await db.execute(
    raw`select nspname from pg_namespace where nspname = 'market'`,
  )) as unknown as { nspname: string }[];

  if (exposed.length) {
    const granted = (await db.execute(
      raw`select has_schema_privilege('anon', 'market', 'USAGE') as anon_usage,
                 has_schema_privilege('authenticated', 'market', 'USAGE') as auth_usage`,
    )) as unknown as { anon_usage: boolean; auth_usage: boolean }[];

    console.log("\n── market schema ──");
    if (granted[0].anon_usage) fail("anon has USAGE on `market` — price data is publicly readable");
    else pass("anon has no USAGE on `market`");
    if (granted[0].auth_usage) {
      console.log("NOTE  authenticated has USAGE on `market` (read-only market data, not user data)");
    } else pass("authenticated has no USAGE on `market`");
  }

  /* ── 4. Nothing user-owned should be missing a user_id ───────────────── */
  const missingOwner = (await db.execute(
    raw`select c.relname as name
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
           and not exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0
           )
         order by c.relname`,
  )) as unknown as { name: string }[];

  if (missingOwner.length) {
    console.log("\n── tables with no user_id column ──");
    for (const t of missingOwner) {
      console.log(`NOTE  ${t.name} — confirm this is deliberate`);
    }
  }

  /* ── 5. Deleting an account must take every row with it ──────────────── */
  /**
   * "Delete my account" calls `auth.admin.deleteUser` and nothing else: every
   * row goes because its `user_id` cascades from `auth.users`. A table that
   * carries a `user_id` with no such constraint — or one that merely SET NULLs —
   * silently keeps that person's financial records after they asked to be
   * forgotten, and RLS then hides the leftovers from everyone, including them.
   */
  const owned = (await db.execute(
    raw`select c.relname as name,
               (select con.confdeltype
                  from pg_constraint con
                  join pg_attribute att
                    on att.attrelid = c.oid and att.attnum = con.conkey[1]
                 where con.conrelid = c.oid
                   and con.contype = 'f'
                   and array_length(con.conkey, 1) = 1
                   and att.attname = 'user_id'
                 limit 1) as del_action
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r'
           and exists (
             select 1 from pg_attribute a
              where a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0
           )
         order by c.relname`,
  )) as unknown as { name: string; del_action: string | null }[];

  console.log(`\n── ${owned.length} user-owned tables: delete cascade ──`);
  for (const t of owned) {
    if (t.del_action === "c") pass(`${t.name}: user_id cascades from auth.users`);
    else if (t.del_action === null)
      fail(`${t.name}: user_id has NO foreign key — rows survive account deletion`);
    else
      fail(`${t.name}: user_id foreign key is '${t.del_action}', not CASCADE — rows survive account deletion`);
  }

  console.log(problems ? `\n${problems} PROBLEM(S) FOUND` : "\nno problems found");
  process.exit(problems ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error("audit failed:", (e as Error).message);
  process.exit(1);
});
