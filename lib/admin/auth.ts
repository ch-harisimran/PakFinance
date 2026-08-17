import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { adminAuth } from "@/lib/db/schema/app";
import { makeVerifier, checkVerifier } from "@/lib/pin/verifier";

/**
 * The admin console's own authentication.
 *
 * Two independent facts must hold before anything here grants access:
 *
 *   1. The signed-in user's email equals ADMIN_EMAIL — read from the
 *      environment, never from the database and never from the request.
 *   2. They have proved a separate console password.
 *
 * The first is why nobody can make themselves an admin: there is no role column,
 * no invite, no first-user-wins. Registering the admin address later does not
 * help either — a verifier already exists by then, and replacing it requires the
 * current password.
 *
 * The second exists because the console writes `market.funds` and
 * `market.fund_navs`, one catalogue shared by every user. An app session is the
 * wrong authority for that: if a laptop is left unlocked, the PIN lock is a UI
 * overlay and the session cookie is still live. This password is not.
 */

/** How long a console session lasts. Short: this is a maintenance surface. */
const SESSION_HOURS = 8;
/** Wrong passwords before the console locks, regardless of IP. */
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const ADMIN_COOKIE = "pf_admin";

/** Tokens are stored hashed, so a leak of the table cannot be replayed. */
const hashToken = (raw: string) => createHash("sha256").update(raw).digest("base64");

/**
 * Is this email the configured admin?
 *
 * Compared case-insensitively and only against the environment. Returns false
 * when ADMIN_EMAIL is unset, so an unconfigured deployment has no admin at all
 * rather than an open door.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!configured || !email) return false;
  return email.trim().toLowerCase() === configured;
}

export interface AdminState {
  /** A console password has been set. */
  hasPassword: boolean;
  /** Locked out after too many wrong attempts, until this time. */
  lockedUntil: Date | null;
}

export async function adminState(userId: string): Promise<AdminState> {
  const [row] = await db
    .select({ hash: adminAuth.passHash, lockedUntil: adminAuth.lockedUntil })
    .from(adminAuth)
    .where(eq(adminAuth.userId, userId));

  return {
    hasPassword: Boolean(row?.hash),
    lockedUntil: row?.lockedUntil && row.lockedUntil > new Date() ? row.lockedUntil : null,
  };
}

export type SetResult = { ok: true; token: string } | { ok: false; error: string };

/**
 * Set the console password.
 *
 * First time: allowed only when no verifier exists. Afterwards the current
 * password is required — so someone holding a hijacked app session cannot
 * silently replace it and lock the owner out.
 */
export async function setAdminPassword(
  userId: string,
  next: string,
  current?: string,
): Promise<SetResult> {
  if (next.length < 12) {
    // Longer than the app's 8: this one guards shared market data and is typed
    // rarely, so length costs little.
    return { ok: false, error: "Use at least 12 characters." };
  }

  const [row] = await db
    .select({ salt: adminAuth.passSalt, hash: adminAuth.passHash })
    .from(adminAuth)
    .where(eq(adminAuth.userId, userId));

  if (row) {
    if (!current) return { ok: false, error: "Enter your current console password." };
    const ok = await checkVerifier(current, { salt: row.salt, hash: row.hash });
    if (!ok) return { ok: false, error: "That current password isn't right." };
  }

  const verifier = await makeVerifier(next);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);

  await db
    .insert(adminAuth)
    .values({
      userId,
      passSalt: verifier.salt,
      passHash: verifier.hash,
      sessionHash: hashToken(token),
      sessionExpiresAt: expires,
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: adminAuth.userId,
      set: {
        passSalt: verifier.salt,
        passHash: verifier.hash,
        sessionHash: hashToken(token),
        sessionExpiresAt: expires,
        failedAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      },
    });

  return { ok: true, token };
}

export type UnlockResult = { ok: true; token: string } | { ok: false; error: string };

/** Prove the console password and open a session. */
export async function unlockAdmin(userId: string, password: string): Promise<UnlockResult> {
  const [row] = await db
    .select({
      salt: adminAuth.passSalt,
      hash: adminAuth.passHash,
      failed: adminAuth.failedAttempts,
      lockedUntil: adminAuth.lockedUntil,
    })
    .from(adminAuth)
    .where(eq(adminAuth.userId, userId));

  if (!row) return { ok: false, error: "No console password is set." };

  if (row.lockedUntil && row.lockedUntil > new Date()) {
    const mins = Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000);
    return { ok: false, error: `Locked for another ${mins} minute${mins === 1 ? "" : "s"}.` };
  }

  if (!(await checkVerifier(password, { salt: row.salt, hash: row.hash }))) {
    const failed = row.failed + 1;
    const lock = failed >= MAX_ATTEMPTS;
    await db
      .update(adminAuth)
      .set({
        failedAttempts: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
        updatedAt: new Date(),
      })
      .where(eq(adminAuth.userId, userId));

    return {
      ok: false,
      error: lock
        ? `Too many attempts. Locked for ${LOCK_MINUTES} minutes.`
        : `Wrong password. ${MAX_ATTEMPTS - failed} attempt${MAX_ATTEMPTS - failed === 1 ? "" : "s"} left.`,
    };
  }

  const token = randomBytes(32).toString("base64url");
  await db
    .update(adminAuth)
    .set({
      sessionHash: hashToken(token),
      sessionExpiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000),
      failedAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(adminAuth.userId, userId));

  return { ok: true, token };
}

/** Does this cookie value open a live console session for this user? */
export async function hasAdminSession(userId: string, token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const [row] = await db
    .select({ hash: adminAuth.sessionHash, expires: adminAuth.sessionExpiresAt })
    .from(adminAuth)
    .where(eq(adminAuth.userId, userId));

  if (!row?.hash || !row.expires) return false;
  if (row.expires <= new Date()) return false;
  return row.hash === hashToken(token);
}

/** End the console session without touching the password. */
export async function lockAdmin(userId: string): Promise<void> {
  await db
    .update(adminAuth)
    .set({ sessionHash: null, sessionExpiresAt: null, updatedAt: new Date() })
    .where(eq(adminAuth.userId, userId));
}

export const ADMIN_SESSION_HOURS = SESSION_HOURS;
