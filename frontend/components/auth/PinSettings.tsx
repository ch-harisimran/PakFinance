"use client";

import { useEffect, useState } from "react";
import { KeyRound, ShieldOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PinPad } from "@/components/auth/PinPad";
import { Switch } from "@/components/ui/Switch";
import { wrapSession, PIN_VALID_DAYS } from "@/lib/pin/crypto";
import { clearPin, hasPin, savePin } from "@/lib/pin/store";

/**
 * Set, change or remove the quick-unlock PIN.
 *
 * Changing and setting are the same operation — we re-wrap the current session
 * with a new key. There is no "old PIN" check here because the PIN is not a
 * stored secret to compare against; possession of a live session is the
 * authority, and you only reach Settings by already being signed in.
 */

type Stage = "idle" | "enter" | "confirm" | "saved";

export function PinSettings() {
  const [enabled, setEnabled] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [first, setFirst] = useState("");
  const [error, setError] = useState<string>();
  const [mounted, setMounted] = useState(false);

  // Deferred a tick: localStorage is unavailable during SSR so this cannot be
  // lazy initial state, and setting it inline cascades an extra render.
  useEffect(() => {
    const id = setTimeout(() => {
      setEnabled(hasPin());
      setMounted(true);
    }, 0);
    return () => clearTimeout(id);
  }, []);

  async function finish(pin: string) {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session?.refresh_token) {
      setError("Session expired. Sign in again to set a PIN.");
      setStage("idle");
      return;
    }

    const blob = await wrapSession(pin, session.refresh_token, session.user.email ?? "");
    savePin(blob);
    setEnabled(true);
    setStage("saved");
    setError(undefined);
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

  function disable() {
    clearPin();
    setEnabled(false);
    setStage("idle");
    setFirst("");
  }

  // Rendered only after mount: localStorage is unavailable during SSR, and a
  // server/client mismatch on this switch would hydrate wrong.
  if (!mounted) return null;

  return (
    <div className="border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex items-start justify-between gap-6 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <KeyRound size={14} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
            Quick unlock PIN
          </div>
          <p className="mt-1 max-w-[52ch] text-[11.5px]" style={{ color: "var(--text-faint)" }}>
            A 6-digit PIN unlocks the app for {PIN_VALID_DAYS} days instead of a full sign-in, and
            after 3 minutes of inactivity. Your session is encrypted with it — losing the PIN just
            means signing in again.
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
            {stage === "enter" ? "Choose a 6-digit PIN" : "Enter it once more"}
          </p>
          <PinPad key={stage} onComplete={onEntered} error={Boolean(error)} />
          {error && (
            <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-loss)" }}>
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
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--color-gain)" }}>
          PIN set. It will be asked for after 3 minutes idle, and on return within{" "}
          {PIN_VALID_DAYS} days.
        </p>
      )}

      {enabled && stage === "idle" && (
        <button
          onClick={() => {
            setStage("enter");
            setFirst("");
          }}
          className="mt-2 inline-flex items-center gap-2 text-[12.5px] underline-offset-4 hover:underline"
          style={{ color: "var(--brass-text)" }}
        >
          <ShieldOff size={13} strokeWidth={1.7} />
          Change PIN
        </button>
      )}
    </div>
  );
}
