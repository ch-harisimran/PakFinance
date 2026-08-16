import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * The server-side PIN verifier: hashing and comparison, and nothing else.
 *
 * Separated from the server action so it can be exercised without a request
 * context — `npm run verify:pin` proves the round trip against a throwaway
 * user, which is the only way to demonstrate that a PIN really does outlive a
 * sign-out rather than merely appearing to in a browser.
 *
 * No `server-only` guard, for the same reason `lib/rate-limit.ts` has none: the
 * guard throws under plain tsx, and a module that cannot be tested is a module
 * whose behaviour is asserted rather than known. It imports `node:crypto`, so
 * bundling it into a browser build would fail loudly anyway.
 *
 * scrypt rather than a plain digest. Six digits is 10^6 — a space SHA-256 falls
 * to in seconds. scrypt's memory cost is what makes each guess expensive, and
 * the column grants (migration 0014) are what stop anyone getting the hash to
 * grind in the first place.
 */

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_BYTES = 64;
const SALT_BYTES = 16;

export interface PinVerifier {
  salt: string;
  hash: string;
}

/** Build a fresh verifier for a PIN. Salt is new every time, so setting the
 *  same PIN twice stores different bytes. */
export async function makeVerifier(pin: string): Promise<PinVerifier> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(pin, salt, KEY_BYTES);
  return { salt: salt.toString("base64"), hash: hash.toString("base64") };
}

/** Constant-time check of a PIN against a stored verifier. */
export async function checkVerifier(pin: string, stored: PinVerifier): Promise<boolean> {
  const expected = Buffer.from(stored.hash, "base64");
  const actual = await scrypt(pin, Buffer.from(stored.salt, "base64"), KEY_BYTES);

  // Length first: timingSafeEqual THROWS on differing lengths rather than
  // returning false, so a stored hash of the wrong size must read as "wrong",
  // not as a crash on the lock screen.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
