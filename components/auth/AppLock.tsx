"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { PinPad } from "@/components/auth/PinPad";
import { unwrapSession, wrapSession, MAX_ATTEMPTS } from "@/lib/pin/crypto";
import { verifyPin } from "@/app/dashboard/pin-actions";
import {
  attemptsLeft,
  clearLocked,
  clearPin,
  loadPin,
  markLocked,
  recordFailure,
  resetFailures,
  savePin,
  wasLocked,
} from "@/lib/pin/store";

/**
 * Idle lock + PIN unlock, wrapped around the app.
 *
 * Locks after `IDLE_MINUTES` of no interaction, and stays locked across a
 * reload because the flag is persisted — otherwise F5 would be the bypass.
 *
 * Unlocking decrypts the stored refresh token, so a correct PIN is proven by
 * the ciphertext opening, not by comparing strings in JavaScript.
 *
 * There are two ways to prove a PIN, and which one applies depends on whether
 * this browser holds a wrapped session:
 *
 *   - It does — the usual case. Decrypting proves the PIN and hands back the
 *     refresh token in one step, offline.
 *   - It does not — the first lock after a fresh sign-in, or after site data
 *     was cleared. The account still has a PIN (`pinSet` comes from the
 *     profile), so the server checks it, and on success we wrap the CURRENT
 *     session here so every later unlock takes the offline path again.
 *
 * That second path is what makes the PIN outlive a sign-out. Signing out
 * revokes the refresh token, so the wrapped blob is worthless and gets cleared;
 * the PIN itself lives on the account and is never asked to be chosen again.
 */

const IDLE_MINUTES = 3;
const ACTIVITY = ["mousedown", "keydown", "touchstart", "scroll", "pointermove"] as const;

export function AppLock({
  pinSet,
  email,
  children,
}: {
  /** Whether the ACCOUNT has a PIN — not whether this browser has a blob. */
  pinSet: boolean;
  /** The signed-in address, used to prove a stored blob belongs to THIS account. */
  email: string;
  children: React.ReactNode;
}) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState(MAX_ATTEMPTS);
  /** Bumped on each rejection to remount PinPad, clearing its boxes. */
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * A hard navigation, not router.push. Signing out must discard all in-memory
   * client state — a soft navigation would keep the React tree, and with it any
   * cached account data belonging to the person who just signed out.
   */
  const leave = () => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a soft navigation would preserve the signed-out user's cached data in memory
    window.location.href = "/login";
  };

  /**
   * ONLY the account decides whether to lock.
   *
   * This used to be `pinSet || loadPin() !== null`, and the second half was a
   * trap: localStorage outlives the account it belonged to. Delete an account
   * and register again from the same browser and the old blob was still there,
   * so a brand-new account with no PIN was locked behind the deleted account's
   * PIN — and five wrong guesses locked it out entirely.
   *
   * The blob answers "how do I unlock offline", never "should I lock".
   */
  const armed = useCallback(() => pinSet, [pinSet]);

  const lock = useCallback(() => {
    if (!armed()) return;
    markLocked();
    setLeft(attemptsLeft());
    setLocked(true);
  }, [armed]);

  const bump = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!armed()) return;
    timer.current = setTimeout(lock, IDLE_MINUTES * 60_000);
  }, [armed, lock]);

  /**
   * Restore the locked flag on mount. Deferred by a tick rather than set
   * synchronously in the effect body: localStorage cannot be read during SSR,
   * so this cannot be lazy initial state, and setting it inline would cascade
   * a second render before paint.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      // No PIN on the account means any blob here is a leftover — from a
      // deleted account, or a PIN removed on another device. Bin it, so it
      // cannot be decrypted into a session later.
      if (!pinSet && loadPin() !== null) clearPin();

      if (armed() && wasLocked()) {
        setLeft(attemptsLeft());
        setLocked(true);
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, [armed, pinSet]);

  useEffect(() => {
    if (locked) return;
    ACTIVITY.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    // A backgrounded tab stops firing activity events, so lock on hide too.
    const onHide = () => document.visibilityState === "hidden" && lock();
    document.addEventListener("visibilitychange", onHide);
    bump();

    return () => {
      ACTIVITY.forEach((e) => window.removeEventListener(e, bump));
      document.removeEventListener("visibilitychange", onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [locked, bump, lock]);

  /** Shared rejection handling for both proof paths. */
  async function reject(message?: string) {
    const remaining = recordFailure();
    setLeft(remaining);
    setAttempt((n) => n + 1);
    setBusy(false);
    setError(
      remaining > 0
        ? (message ?? `Wrong PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`)
        : "Too many attempts. Sign in again.",
    );
    if (remaining <= 0) {
      // The blob goes; the account's PIN does not. Signing in again asks for
      // the same PIN rather than making the owner choose a new one.
      clearPin();
      await createClient().auth.signOut();
      leave();
    }
  }

  function unlock() {
    resetFailures();
    clearLocked();
    setBusy(false);
    setLocked(false);
  }

  async function submit(pin: string) {
    const blob = loadPin();
    setBusy(true);
    setError(undefined);

    const supabase = createClient();

    // ── No blob: a fresh sign-in on this browser. Ask the server. ──────────
    if (!blob) {
      if (!pinSet) return; // nothing to prove against
      const checked = await verifyPin(pin);
      if (!checked.ok) {
        await reject(checked.error === "Wrong PIN." ? undefined : checked.error);
        return;
      }

      // Wrap the live session now, so this browser never needs the network to
      // unlock again — and so a closed laptop holds no readable refresh token.
      const { data } = await supabase.auth.getSession();
      if (data.session?.refresh_token) {
        savePin(await wrapSession(pin, data.session.refresh_token, data.session.user.email ?? ""));
      }
      unlock();
      return;
    }

    // ── Blob present: decrypting it is the proof, and needs no server. ─────
    const result = await unwrapSession(pin, blob);

    if (!result.ok) {
      if (result.reason === "expired") {
        clearPin();
        await supabase.auth.signOut();
        leave();
        return;
      }
      await reject();
      return;
    }

    /**
     * The blob decrypted — but whose is it?
     *
     * localStorage is per-browser, not per-account. A blob left by a previous
     * account on this machine would decrypt for whoever knows THAT PIN, and the
     * refresh below would then establish THAT account's session over the top of
     * this one. The email travels inside the ciphertext precisely so it can be
     * checked here, and it cannot be edited without the PIN.
     */
    if (result.email && email && result.email.toLowerCase() !== email.toLowerCase()) {
      clearPin();
      setBusy(false);
      setError("That PIN belongs to a different account. Sign in again.");
      return;
    }

    // Re-establish the session from the decrypted refresh token, in case the
    // cookie expired while the tab was closed.
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await supabase.auth.refreshSession({ refresh_token: result.refreshToken });
    }

    unlock();
  }

  async function signOutFully() {
    clearPin();
    await createClient().auth.signOut();
    leave();
  }

  // Avoid a flash of the app before we know whether it should be locked.
  /**
   * Only an account WITH a PIN waits.
   *
   * This used to be `if (!ready) return null` unconditionally, which withheld
   * the entire dashboard until the client bundle had downloaded, parsed and
   * hydrated. On a laptop that is imperceptible; on a phone it is seconds of
   * blank screen with the server-rendered HTML sitting there unused.
   *
   * The server already knows whether a PIN exists. With none there is nothing
   * to lock and nothing to flash, so the page paints immediately. With one, the
   * original guard still holds and no content appears before the lock does.
   */
  if (!ready && pinSet) return null;

  return (
    <>
      {children}

      {locked && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center px-6"
          style={{ backgroundColor: "rgba(10,11,13,0.94)", backdropFilter: "blur(14px)" }}
          role="dialog"
          aria-modal="true"
          aria-label="App locked"
        >
          <div className="w-full max-w-[380px] text-center">
            <Logo href={null} className="mb-10 inline-flex justify-center" />

            <span
              className="mx-auto mb-6 grid h-12 w-12 place-items-center rounded-full border"
              style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
            >
              <ShieldCheck size={20} strokeWidth={1.6} color="var(--color-brass)" />
            </span>

            <h1
              className="mb-2 text-[clamp(1.6rem,2.6vw,2rem)] tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Locked
            </h1>
            <p className="mb-8 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
              Enter your PIN to continue.
            </p>

            <PinPad key={attempt} onComplete={submit} disabled={busy} error={Boolean(error)} />

            <p
              className="mt-5 min-h-[18px] text-[12.5px]"
              style={{ color: error ? "var(--color-loss)" : "var(--text-faint)" }}
            >
              {busy ? "Checking…" : (error ?? `${left} of ${MAX_ATTEMPTS} attempts remaining`)}
            </p>

            <button
              onClick={signOutFully}
              className="mt-6 inline-flex items-center gap-2 text-[13px] underline-offset-4 hover:underline"
              style={{ color: "var(--text-muted)" }}
            >
              <LogOut size={14} strokeWidth={1.7} />
              Sign out instead
            </button>
          </div>
        </div>
      )}
    </>
  );
}
