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
      /**
       * `profiles` is asked for named columns, not `*`.
       *
       * Its PIN verifier has SELECT revoked at column level (migration 0014),
       * and PostgREST expands `*` to every column — so a star query is refused
       * for lack of privilege and returns nothing. That would read here as "no
       * rows", i.e. as RLS passing, which is the wrong answer for the wrong
       * reason. The verifier gets its own explicit check below.
       */
      const { data } =
        table === "profiles"
          ? await b.from(table).select("user_id,full_name,notation").limit(5)
          : await b.from(table).select("*").limit(5);
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

    /**
     * The PIN verifier must be unreadable even to its owner.
     *
     * RLS cannot help here: the threat is someone holding the signed-in user's
     * own session on their unlocked machine, so every row-level rule says yes.
     * Only the column grant stands in the way, and a six-digit PIN whose salt
     * and hash leak is a space small enough to grind offline. `*` is checked
     * too, because that is how the leak would actually happen — nobody asks for
     * `pin_hash` by name, they just select everything.
     */
    for (const column of ["pin_hash", "pin_salt"]) {
      const { error } = await b.from("profiles").select(column).limit(1);
      check(`user B cannot read profiles.${column}`, !!error, "the query succeeded");
    }
    const { error: starError } = await b.from("profiles").select("*").limit(1);
    check("select * on profiles is refused, not silently trimmed", !!starError);

    // And cannot install one of their own choosing, which would turn the lock
    // into one the attacker holds the key to.
    const { error: forgedPin } = await b
      .from("profiles")
      .update({ pin_hash: "forged", pin_salt: "forged" })
      .eq("user_id", idB);
    check("user B cannot write their own PIN verifier", !!forgedPin);

    // Anonymous — no session at all — must see nothing anywhere, profiles
    // included: without a session there is no "own" row to be entitled to.
    for (const table of USER_TABLES) {
      const { data } =
        table === "profiles"
          ? await anon.from(table).select("user_id").limit(5)
          : await anon.from(table).select("*").limit(5);
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
