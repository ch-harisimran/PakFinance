"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guard } from "@/lib/rate-limit";
import { PIN_LENGTH } from "@/lib/pin/constants";
import { makeVerifier, checkVerifier } from "@/lib/pin/verifier";

/**
 * The quick-unlock PIN, as a property of the user rather than of a session.
 *
 * Why the verifier lives on the server at all: the PIN used to exist only as the
 * AES key wrapping a refresh token in localStorage, which meant signing out —
 * which revokes that token — destroyed it, and the next sign-in had to choose a
 * new one. Keeping a verifier here is what lets the same PIN carry across sign
 * outs, cleared browsers and new devices, and change only when its owner
 * changes it.
 *
 * The local wrap is NOT replaced by this. It still encrypts the refresh token,
 * so a locked app on a closed laptop holds no usable session — a server-checked
 * boolean would be a conditional render, which devtools walks straight past.
 * These two answer different questions: "is this the right PIN" (here) and
 * "may this browser resume the session" (lib/pin/crypto.ts).
 *
 * Writes go through the ADMIN client. Clients have UPDATE revoked on these
 * columns (migration 0013) precisely so a forged PostgREST call cannot install
 * a verifier of the attacker's choosing; the identity is established from the
 * session first, and only the user's own row is ever touched.
 */

export type PinResult = { ok: true } | { ok: false; error: string };

const isPin = (pin: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

/** The signed-in user's id, or null. Never trusts anything the caller sends. */
async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Set or change the PIN. Both are the same operation: write a new verifier. */
export async function setPin(pin: string): Promise<PinResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!isPin(pin)) return { ok: false, error: `Your PIN must be ${PIN_LENGTH} digits.` };

  const verifier = await makeVerifier(pin);

  const { error } = await createAdminClient()
    .from("profiles")
    .update({
      pin_salt: verifier.salt,
      pin_hash: verifier.hash,
      pin_set_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

/**
 * Check a PIN against the stored verifier.
 *
 * Used when this browser has no wrapped session to open — the first lock after
 * a fresh sign-in, or after site data was cleared. On success the caller wraps
 * the current session locally, so subsequent unlocks never reach the network.
 */
export async function verifyPin(pin: string): Promise<PinResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const limited = await guard("pinVerify", user.id);
  if (!limited.ok) return { ok: false, error: limited.message };

  if (!isPin(pin)) return { ok: false, error: "Wrong PIN." };

  const { data } = await createAdminClient()
    .from("profiles")
    .select("pin_salt,pin_hash")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.pin_salt || !data?.pin_hash) return { ok: false, error: "No PIN is set." };

  const same = await checkVerifier(pin, { salt: data.pin_salt, hash: data.pin_hash });
  return same ? { ok: true } : { ok: false, error: "Wrong PIN." };
}

/** Turn the PIN off. The local wrapped session is cleared by the caller. */
export async function removePin(): Promise<PinResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ pin_salt: null, pin_hash: null, pin_set_at: null })
    .eq("user_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
