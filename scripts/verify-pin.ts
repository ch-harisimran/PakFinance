/**
 * Proves the quick-unlock PIN outlives the session.
 *
 *   npm run verify:pin
 *
 * The requirement is behavioural — "signing out must not lose the PIN" — and
 * the only honest way to show it is to sign a real user out and check the PIN
 * still answers. So this creates a throwaway user, sets a PIN, signs every
 * session out, and asks again.
 *
 * Creates and deletes its own user. Touches nobody else's data.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

let failures = 0;
const check = (label: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
};

const PIN = "314159";
const WRONG = "271828";

async function main() {
  const { createClient } = await import("@supabase/supabase-js");
  const { makeVerifier, checkVerifier } = await import("../lib/pin/verifier");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const email = `pin-check-${Date.now()}@example.com`;
  const password = `${Math.random().toString(36).slice(2)}Aa1!`;

  const { data: made, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !made.user) throw new Error(createError?.message ?? "could not create user");
  const userId = made.user.id;

  try {
    /* ── 1. Setting a PIN ─────────────────────────────────────────────── */
    const verifier = await makeVerifier(PIN);
    const { error: setError } = await admin
      .from("profiles")
      .update({ ...{ pin_salt: verifier.salt, pin_hash: verifier.hash }, pin_set_at: new Date().toISOString() })
      .eq("user_id", userId);
    check("a PIN can be stored", !setError, setError?.message);

    const read = async () => {
      const { data } = await admin
        .from("profiles")
        .select("pin_salt,pin_hash,pin_set_at")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    };

    const stored = await read();
    check("the PIN is not stored in the clear", stored?.pin_hash !== PIN);
    check(
      "the right PIN verifies",
      !!stored && (await checkVerifier(PIN, { salt: stored.pin_salt!, hash: stored.pin_hash! })),
    );
    check(
      "a wrong PIN does not",
      !!stored && !(await checkVerifier(WRONG, { salt: stored.pin_salt!, hash: stored.pin_hash! })),
    );

    /* ── 2. The actual requirement: it survives signing out ───────────── */
    // Sign in for real, then revoke every session the way "Sign out" does.
    const asUser = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: signedIn } = await asUser.auth.signInWithPassword({ email, password });
    check("the throwaway user can sign in", !!signedIn.session);

    const { error: outError } = await admin.auth.admin.signOut(
      signedIn.session?.access_token ?? "",
      "global",
    );
    check("all sessions are revoked", !outError, outError?.message);

    const afterSignOut = await read();
    check("the PIN is still set after signing out", !!afterSignOut?.pin_set_at);
    check(
      "the same PIN still verifies after signing out",
      !!afterSignOut &&
        (await checkVerifier(PIN, {
          salt: afterSignOut.pin_salt!,
          hash: afterSignOut.pin_hash!,
        })),
    );

    /* ── 3. Changing it replaces it; removing it clears it ────────────── */
    const changed = await makeVerifier(WRONG);
    await admin
      .from("profiles")
      .update({ pin_salt: changed.salt, pin_hash: changed.hash })
      .eq("user_id", userId);

    const afterChange = await read();
    check(
      "the old PIN stops working once changed",
      !!afterChange &&
        !(await checkVerifier(PIN, { salt: afterChange.pin_salt!, hash: afterChange.pin_hash! })),
    );
    check(
      "the new PIN works",
      !!afterChange &&
        (await checkVerifier(WRONG, { salt: afterChange.pin_salt!, hash: afterChange.pin_hash! })),
    );

    await admin
      .from("profiles")
      .update({ pin_salt: null, pin_hash: null, pin_set_at: null })
      .eq("user_id", userId);
    const afterRemove = await read();
    check("removing it clears the verifier", !afterRemove?.pin_hash && !afterRemove?.pin_set_at);

    /* ── 4. Two users' PINs are independent ───────────────────────────── */
    const same = await makeVerifier(PIN);
    check(
      "the same PIN hashes differently for a different salt",
      same.hash !== verifier.hash,
      "identical hashes would let one leak identify every user sharing a PIN",
    );
  } finally {
    await admin.auth.admin.deleteUser(userId);
    console.log("\ncleaned up the throwaway user");
  }

  console.log(failures ? `\n${failures} FAILED` : "\nall checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error("verify:pin failed:", (e as Error).message);
  process.exit(1);
});
