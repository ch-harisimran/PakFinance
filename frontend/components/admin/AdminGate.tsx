"use client";

import { useActionState } from "react";
import { KeyRound, ShieldAlert } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import {
  setPasswordAction,
  unlockAction,
  type AdminActionState,
} from "@/app/admin/actions";

/**
 * Set the console password, or unlock with it.
 *
 * Which of the two is shown depends on whether a verifier already exists — and
 * that is decided on the server. A client that flipped this flag would gain
 * nothing: `setAdminPassword` refuses to overwrite an existing verifier without
 * the current password.
 */
export function AdminGate({
  email,
  hasPassword,
  lockedUntil,
}: {
  email: string;
  hasPassword: boolean;
  lockedUntil: string | null;
}) {
  const [setState, setPassword, settingUp] = useActionState<AdminActionState, FormData>(
    setPasswordAction,
    {},
  );
  const [unlockState, unlock, unlocking] = useActionState<AdminActionState, FormData>(
    unlockAction,
    {},
  );

  const locked = lockedUntil !== null && new Date(lockedUntil) > new Date();

  if (locked) {
    return (
      <div
        className="rounded-[14px] border p-6"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
      >
        <div className="mb-2 flex items-center gap-2 text-[14px] font-medium">
          <ShieldAlert size={16} strokeWidth={1.8} style={{ color: "var(--color-loss)" }} />
          Console locked
        </div>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
          Too many wrong passwords. Try again after{" "}
          {new Date(lockedUntil).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-[14px] border p-6 sm:p-7"
      style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
    >
      <div className="mb-1.5 flex items-center gap-2 text-[15px] font-medium">
        <KeyRound size={16} strokeWidth={1.8} style={{ color: "var(--brass-text)" }} />
        {hasPassword ? "Unlock the console" : "Set a console password"}
      </div>
      <p className="mb-6 text-[12.5px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
        Signed in as <span style={{ color: "var(--text-secondary)" }}>{email}</span>.{" "}
        {hasPassword
          ? "This is separate from your account password."
          : "Separate from your account password, so a session left open on an unlocked machine cannot reach the shared market data."}
      </p>

      {hasPassword ? (
        <form action={unlock} className="flex flex-col gap-4">
          <Field
            label="Console password"
            name="password"
            type="password"
            autoComplete="current-password"
            error={unlockState.error}
            required
          />
          <Button type="submit" variant="primary" disabled={unlocking}>
            {unlocking ? "Checking…" : "Unlock"}
          </Button>
        </form>
      ) : (
        <form action={setPassword} className="flex flex-col gap-4">
          <Field
            label="New console password"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="At least 12 characters."
            required
          />
          <Field
            label="Confirm it"
            name="confirm"
            type="password"
            autoComplete="new-password"
            error={setState.error}
            required
          />
          <Button type="submit" variant="primary" disabled={settingUp}>
            {settingUp ? "Saving…" : "Set password"}
          </Button>
        </form>
      )}
    </div>
  );
}
