"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/brand/Logo";
import { PinPad } from "@/components/auth/PinPad";
import { unwrapSession, MAX_ATTEMPTS } from "@/lib/pin/crypto";
import {
  attemptsLeft,
  clearLocked,
  clearPin,
  loadPin,
  markLocked,
  recordFailure,
  resetFailures,
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
 */

const IDLE_MINUTES = 3;
const ACTIVITY = ["mousedown", "keydown", "touchstart", "scroll", "pointermove"] as const;

export function AppLock({ children }: { children: React.ReactNode }) {
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

  // Only ever locks when a PIN is actually set; otherwise the app is unguarded
  // by choice and an idle timeout would just be an obstacle.
  const armed = useCallback(() => loadPin() !== null, []);

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
      if (armed() && wasLocked()) {
        setLeft(attemptsLeft());
        setLocked(true);
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(id);
  }, [armed]);

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

  async function submit(pin: string) {
    const blob = loadPin();
    if (!blob) return;

    setBusy(true);
    setError(undefined);

    const result = await unwrapSession(pin, blob);

    if (!result.ok) {
      if (result.reason === "expired") {
        clearPin();
        await createClient().auth.signOut();
        leave();
        return;
      }
      const remaining = recordFailure();
      setLeft(remaining);
      setAttempt((n) => n + 1);
      setBusy(false);
      setError(
        remaining > 0
          ? `Wrong PIN. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`
          : "Too many attempts. Sign in again.",
      );
      if (remaining <= 0) {
        await createClient().auth.signOut();
        leave();
      }
      return;
    }

    // Re-establish the session from the decrypted refresh token, in case the
    // cookie expired while the tab was closed.
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await supabase.auth.refreshSession({ refresh_token: result.refreshToken });
    }

    resetFailures();
    clearLocked();
    setBusy(false);
    setLocked(false);
  }

  async function signOutFully() {
    clearPin();
    await createClient().auth.signOut();
    leave();
  }

  // Avoid a flash of the app before we know whether it should be locked.
  if (!ready) return null;

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
