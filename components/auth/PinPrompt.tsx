"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PIN_VALID_DAYS } from "@/lib/pin/constants";

/**
 * Offer the quick-unlock PIN the first time someone reaches the dashboard.
 *
 * Shown only when the ACCOUNT has no PIN — `pinSet` comes from the profile, so
 * setting one on any device stops this everywhere, permanently.
 *
 * Dismissal is remembered per browser rather than per account, and deliberately:
 * a PIN encrypts the session stored on THIS machine, so someone who declined on
 * their laptop should still be asked on a new phone. Once a PIN exists the
 * prompt never appears again regardless.
 *
 * It offers, it does not insist. The app is perfectly usable without a PIN, and
 * a modal that cannot be dismissed teaches people to click past warnings.
 */

const DISMISSED = "pf.pin.prompted";

export function PinPrompt({ pinSet }: { pinSet: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (pinSet) return;
    // Deferred a tick: localStorage cannot be read during SSR, so this cannot be
    // lazy initial state, and setting it inline cascades a render before paint.
    const id = setTimeout(() => {
      if (localStorage.getItem(DISMISSED) === null) setOpen(true);
    }, 0);
    return () => clearTimeout(id);
  }, [pinSet]);

  function close() {
    // Remembered whichever way they answer: someone who went to Settings has
    // been asked, and should not be asked again on the way back.
    try {
      localStorage.setItem(DISMISSED, String(Date.now()));
    } catch {
      // Private browsing with storage disabled. Not being able to record the
      // dismissal is no reason to trap them behind the dialog.
    }
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add a PIN to this account?"
      description="Optional, and you can do it later from Settings."
    >
      <div className="flex items-start gap-4">
        <span
          className="mt-0.5 grid h-10 w-10 flex-none place-items-center rounded-full border"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
        >
          <ShieldCheck size={18} strokeWidth={1.7} color="var(--color-brass)" />
        </span>

        <div className="min-w-0 text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <p>
            A 6-digit PIN locks PakFinance after three minutes of inactivity, so
            your balances are not sitting on screen if you walk away from an
            unlocked laptop.
          </p>
          <p className="mt-3">
            It also encrypts the sign-in session stored in this browser. Without the
            PIN that session cannot be read at all — the lock is enforced by
            cryptography, not by hiding the screen.
          </p>
          <p className="mt-3">
            Day to day it saves you time: returning within {PIN_VALID_DAYS} days needs
            the PIN instead of a full sign-in. It stays with your account, so signing
            out never loses it, and you will not be asked to choose a new one.
          </p>
          <p className="mt-3" style={{ color: "var(--text-faint)" }}>
            Forgetting it costs nothing but signing in with your email and password
            again.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button type="button" variant="secondary" onClick={close}>
          Maybe later
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={() => {
            close();
            router.push("/dashboard/settings#pin");
          }}
        >
          Set up a PIN
        </Button>
      </div>
    </Modal>
  );
}
