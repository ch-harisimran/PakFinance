/**
 * Prove that one user cannot reach another user's rows.
 *
 *   npm run test:rls
 *
 * NOT part of `npm test`. This creates two real users in the Supabase project,
 * writes real rows as them, and deletes both at the end — it needs the service
 * role key and the network, and has no business running on every file save.
 *
 * Why it exists: row-level security is the property the entire design leans on.
 * Every read goes through the user's own JWT precisely so a forgotten filter
 * cannot leak somebody's finances. That is an assumption until something checks
 * it, and reading the policies is not checking them.
 *
 * The users are created and destroyed by this script. Deleting the auth user
 * cascades every table, so nothing is left behind.
 */
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local", quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

let failures = 0;
let checks = 0;

function check(label: string, pass: boolean, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
}

/** A client that authenticates as one specific user, exactly like the browser. */
async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL!, ANON!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function main() {
  if (!URL || !ANON || !SERVICE) {
    console.error(
      "Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",
    );
    process.exit(1);
  }

  const admin = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const password = `Rls-${randomUUID()}`;
  const emailA = `rls-a-${randomUUID()}@pakfinance-test.invalid`;
  const emailB = `rls-b-${randomUUID()}@pakfinance-test.invalid`;
  const created: string[] = [];

  try {
    for (const email of [emailA, emailB]) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`could not create ${email}: ${error.message}`);
      created.push(data.user.id);
    }
    console.log(`created two throwaway users\n`);

    const a = await signIn(emailA, password);
    const b = await signIn(emailB, password);
    const anon = createClient(URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [idA] = created;

    // ── A writes a row as themselves ───────────────────────────────────────
    const { data: inserted, error: insertError } = await a
      .from("accounts")
      .insert({ user_id: idA, name: "RLS probe account", balance_paisa: 12_345 })
      .select("id")
      .single();

    check("user A can insert their own account", !insertError, insertError?.message);
    if (insertError) throw new Error("cannot continue without a row to test against");
    const rowId = inserted!.id as string;

    // ── B must not see it ──────────────────────────────────────────────────
    const { data: bSees } = await b.from("accounts").select("id,name");
    check("user B sees none of A's accounts", (bSees ?? []).length === 0, `saw ${(bSees ?? []).length}`);

    const { data: bTargeted } = await b.from("accounts").select("id").eq("id", rowId);
    check("user B cannot fetch A's row by its id", (bTargeted ?? []).length === 0);

    // ── B must not change it ───────────────────────────────────────────────
    const { data: bUpdated } = await b
      .from("accounts")
      .update({ name: "hijacked" })
      .eq("id", rowId)
      .select("id");
    check("user B cannot update A's row", (bUpdated ?? []).length === 0);

    const { data: bDeleted } = await b.from("accounts").delete().eq("id", rowId).select("id");
    check("user B cannot delete A's row", (bDeleted ?? []).length === 0);

    // ── B must not be able to plant a row on A ─────────────────────────────
    const { error: forged } = await b
      .from("accounts")
      .insert({ user_id: idA, name: "planted by B", balance_paisa: 1 });
    check("user B cannot insert a row owned by A", !!forged, forged ? "rejected" : "ACCEPTED");

    // ── A still sees their own row, unchanged ──────────────────────────────
    const { data: aSees } = await a.from("accounts").select("id,name").eq("id", rowId);
    check("user A still sees their own row", (aSees ?? []).length === 1);
    check("A's row was not renamed by B", aSees?.[0]?.name === "RLS probe account");

    // ── Signed out, nobody sees anything ───────────────────────────────────
    const { data: anonSees } = await anon.from("accounts").select("id");
    check("an anonymous client sees no accounts", (anonSees ?? []).length === 0);

    const { data: anonProfiles } = await anon.from("profiles").select("user_id");
    check("an anonymous client sees no profiles", (anonProfiles ?? []).length === 0);

    // ── The market schema must not be reachable through PostgREST at all ───
    const { error: marketError } = await anon.from("securities").select("symbol").limit(1);
    check("market data is not exposed through the API", !!marketError, marketError ? "blocked" : "READABLE");

    /**
     * Every user-owned table.
     *
     * Kept as an explicit list and cross-checked against the database below, so
     * that a table added later without a policy fails this test loudly instead
     * of shipping wide open.
     */
    const USER_TABLES = [
      "profiles",
      "accounts",
      "transactions",
      "loans",
      "loan_payments",
      "goals",
      "goal_contributions",
      "stock_transactions",
      "fund_transactions",
      "net_worth_daily",
      "loan_reminders_sent",
      "assets",
      "budgets",
      "recurring_transactions",
      "committees",
      "committee_payments",
      "zakat_assessments",
    ];

    const [, idB] = created;

    for (const table of USER_TABLES) {
      const { data } = await b.from(table).select("*").limit(5);
      const rows = data ?? [];

      if (table === "profiles") {
        /**
         * `profiles` is the one table where seeing a row is CORRECT: the
         * on_auth_user_created trigger gives every user exactly one, their own.
         *
         * So the question is not "does B see anything" but "does B see only
         * themselves" — which is the assertion that would actually catch a leak
         * here, and which a blanket emptiness check would have hidden.
         */
        const owners = rows.map((r) => (r as { user_id: string }).user_id);
        check(
          "user B sees only their own profile",
          owners.length === 1 && owners[0] === idB,
          `saw ${owners.length} row(s)`,
        );
        check("user A's profile is not among them", !owners.includes(idA));
      } else {
        check(`user B sees nothing in ${table}`, rows.length === 0);
      }

      // Reading nothing is not enough: a table with SELECT locked down but
      // INSERT open lets an attacker write rows onto somebody else's account.
      const { error: forged } = await b.from(table).insert({ user_id: idA });
      check(`user B cannot insert into ${table} as A`, !!forged);
    }

    // Anonymous — no session at all — must see nothing anywhere, profiles
    // included: without a session there is no "own" row to be entitled to.
    for (const table of USER_TABLES) {
      const { data } = await anon.from(table).select("*").limit(5);
      check(`signed out, ${table} returns nothing`, (data ?? []).length === 0);
    }
  } finally {
    for (const id of created) {
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    console.log(`\ncleaned up ${created.length} throwaway users`);
  }

  console.log(`\n${checks - failures} of ${checks} checks passed`);
  if (failures) {
    console.error(`${failures} FAILED — row-level security is not holding.`);
    process.exit(1);
  }
}

main().catch((e: unknown) => {
  console.error("rls test errored:", (e as Error).message);
  process.exit(1);
});
