"use client";

import { useState } from "react";
import { KeyRound, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PinPad } from "@/components/auth/PinPad";
import { Switch } from "@/components/ui/Switch";
import { wrapSession, PIN_VALID_DAYS } from "@/lib/pin/crypto";
import { clearPin, savePin } from "@/lib/pin/store";
import { setPin as setPinOnServer, removePin } from "@/app/dashboard/pin-actions";

/**
 * Set, change or remove the quick-unlock PIN.
 *
 * The PIN belongs to the account, so whether one exists is read from the
 * profile, not from this browser's localStorage — otherwise signing in on a
 * second device would offer to "set up" a PIN that is already set, and quietly
 * overwrite it.
 *
 * Setting one does two things. The server stores a verifier so the PIN survives
 * sign-out and outlives this browser; the client wraps the current session with
 * it so unlocking here needs no network round trip. Changing and setting are
 * the same operation. There is no "old PIN" prompt: possession of a live
 * session is the authority, and you only reach Settings by already being signed
 * in — the same reason changing it does not ask for your password.
 */

type Stage = "idle" | "enter" | "confirm" | "saved";

export function PinSettings({ pinSet }: { pinSet: boolean }) {
  const [enabled, setEnabled] = useState(pinSet);
  const [stage, setStage] = useState<Stage>("idle");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function finish(pin: string) {
    setBusy(true);

    // Server first: it is the copy that has to survive. If the local wrap fails
    // afterwards the PIN still works — the lock screen falls back to verifying
    // against the server — whereas the reverse would leave a PIN that only this
    // browser knows about.
    const stored = await setPinOnServer(pin);
    if (!stored.ok) {
      setError(stored.error);
      setStage("idle");
      setBusy(false);
      return;
    }

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (session?.refresh_token) {
      savePin(await wrapSession(pin, session.refresh_token, session.user.email ?? ""));
    }

    setEnabled(true);
    setStage("saved");
    setError(undefined);
    setBusy(false);
  }

  function onEntered(pin: string) {
    if (stage === "enter") {
      setFirst(pin);
      setStage("confirm");
      setError(undefined);
      return;
    }
    if (pin !== first) {
      setError("Those didn't match. Start again.");
      setFirst("");
      setStage("enter");
      return;
    }
    finish(pin);
  }

  async function disable() {
    setBusy(true);
    const result = await removePin();
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    clearPin();
    setEnabled(false);
    setStage("idle");
    setFirst("");
    setError(undefined);
    setBusy(false);
  }

  return (
    <div className="border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex items-start justify-between gap-6 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <KeyRound size={14} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
            Quick unlock PIN
          </div>
          <p className="mt-1 max-w-[52ch] text-[11.5px]" style={{ color: "var(--text-faint)" }}>
            A 6-digit PIN unlocks the app after 3 minutes of inactivity, and for{" "}
            {PIN_VALID_DAYS} days instead of a full sign-in. It stays with your account —
            signing out does not clear it, and you will not be asked to choose a new one.
          </p>
        </div>

        {enabled && stage === "idle" ? (
          <Switch checked onChange={disable} label="Quick unlock PIN" />
        ) : (
          <Switch
            checked={false}
            onChange={() => {
              setStage("enter");
              setFirst("");
              setError(undefined);
            }}
            label="Quick unlock PIN"
          />
        )}
      </div>

      {(stage === "enter" || stage === "confirm") && (
        <div
          className="mt-4 rounded-[12px] border p-5 text-center"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
        >
          <p className="mb-4 text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {stage === "enter"
              ? enabled
                ? "Choose a new 6-digit PIN"
                : "Choose a 6-digit PIN"
              : "Enter it once more"}
          </p>
          <PinPad key={stage} onComplete={onEntered} disabled={busy} error={Boolean(error)} />
          {error && (
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
              {error}
            </p>
          )}
          <button
            onClick={() => {
              setStage("idle");
              setError(undefined);
            }}
            className="mt-4 text-[12.5px] underline underline-offset-4"
            style={{ color: "var(--text-faint)" }}
          >
            Cancel
          </button>
        </div>
      )}

      {stage === "saved" && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-gain)" }} role="status">
          PIN saved. It stays with your account until you change it here.
        </p>
      )}

      {error && stage === "idle" && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
          {error}
        </p>
      )}

      {enabled && stage === "idle" && (
        <button
          onClick={() => {
            setStage("enter");
            setFirst("");
          }}
          className="mt-2 inline-flex min-h-[24px] items-center gap-2 text-[12.5px] underline-offset-4 hover:underline"
          style={{ color: "var(--brass-text)" }}
        >
          <ShieldOff size={13} strokeWidth={1.7} />
          Change PIN
        </button>
      )}
    </div>
  );
}
