"use client";

/**
 * PIN-wrapped session storage.
 *
 * The PIN does not "unlock the UI" — that would be theatre, bypassed by anyone
 * with devtools. It derives an AES key that decrypts the Supabase refresh
 * token. Without the right PIN the token is unreadable, so the lock is enforced
 * by cryptography rather than by a conditional render.
 *
 * Threat model, stated honestly: this protects against casual access to an
 * unlocked device. It cannot protect against XSS — a browser has no secure
 * enclave, so anything JavaScript can reach, injected JavaScript can reach too.
 * Native banking apps lean on an OS keystore we do not have.
 *
 * Six digits, not four: 10^6 rather than 10^4. Combined with 600k PBKDF2
 * iterations (~0.5s per guess on commodity hardware) an offline grind over the
 * whole space runs into years, and five wrong tries wipes the blob anyway.
 */

const ITERATIONS = 600_000;
const KEY_LENGTH = 256;

export const PIN_LENGTH = 6;
export const MAX_ATTEMPTS = 5;
/** How long a wrapped session stays usable before a full login is required. */
export const PIN_VALID_DAYS = 5;

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface WrappedSession {
  salt: string;
  iv: string;
  data: string;
  /** Plaintext copy for cheap UI checks only — never trusted for access. */
  createdAt: number;
}

interface Payload {
  refreshToken: string;
  email: string;
  /** Inside the ciphertext, so it cannot be edited to extend the window. */
  expiresAt: number;
}

export async function wrapSession(
  pin: string,
  refreshToken: string,
  email: string,
): Promise<WrappedSession> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  const payload: Payload = {
    refreshToken,
    email,
    expiresAt: Date.now() + PIN_VALID_DAYS * 864e5,
  };

  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(JSON.stringify(payload)),
  );

  return {
    salt: b64(salt.buffer as ArrayBuffer),
    iv: b64(iv.buffer as ArrayBuffer),
    data: b64(data),
    createdAt: Date.now(),
  };
}

export type UnwrapResult =
  | { ok: true; refreshToken: string; email: string }
  | { ok: false; reason: "wrong-pin" | "expired" };

export async function unwrapSession(pin: string, blob: WrappedSession): Promise<UnwrapResult> {
  try {
    const key = await deriveKey(pin, unb64(blob.salt));
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(blob.iv) as BufferSource },
      key,
      unb64(blob.data),
    );
    const payload = JSON.parse(dec.decode(plain)) as Payload;

    if (Date.now() > payload.expiresAt) return { ok: false, reason: "expired" };
    return { ok: true, refreshToken: payload.refreshToken, email: payload.email };
  } catch {
    // AES-GCM authenticates: a wrong key fails to decrypt rather than
    // returning garbage, so this branch *is* the wrong-PIN signal.
    return { ok: false, reason: "wrong-pin" };
  }
}
