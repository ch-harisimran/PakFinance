"use client";

import { useState, useTransition } from "react";
import { Monitor } from "lucide-react";
import { Panel } from "@/components/dashboard/Panel";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PinSettings } from "@/components/auth/PinSettings";
import { changePassword } from "@/app/dashboard/actions";

/**
 * Security.
 *
 * The two-factor switch that used to sit here has gone. It toggled nothing, and
 * a security control that lies about being on is worse than no control at all.
 * What actually protects this account is stated instead: a verified email at
 * sign-up, and the PIN lock below.
 */
export function SecurityCard({ lastSignInAt }: { lastSignInAt: string | null }) {
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(form: FormData) {
    startTransition(async () => {
      const result = await changePassword({}, form);
      if (result.ok) {
        setError(undefined);
        setDone(true);
      } else {
        setError(result.error ?? "Could not change your password.");
        setDone(false);
      }
    });
  }

  const lastSignIn = lastSignInAt
    ? new Date(lastSignInAt).toLocaleString("en-GB", {
        timeZone: "Asia/Karachi",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <Panel title="Security">
      {/* key remounts the form after a successful change, clearing the three
          password boxes without an effect that reaches into the DOM. */}
      <form action={submit} key={done ? "done" : "editing"} className="flex flex-col gap-4">
        <Field
          label="Current password"
          name="current_password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
        <Field
          label="New password"
          name="new_password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          required
        />
        <Field
          label="Confirm new password"
          name="confirm_password"
          type="password"
          placeholder="Repeat it"
          autoComplete="new-password"
          required
        />

        {error && (
          <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
            {error}
          </p>
        )}
        {done && !error && (
          <p className="text-[12.5px]" style={{ color: "var(--color-gain)" }}>
            Password changed.
          </p>
        )}

        <div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Changing…" : "Change password"}
          </Button>
        </div>
      </form>

      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
        <PinSettings />

        <div className="mt-5">
          <div className="mb-2 text-[13px] font-medium">This session</div>
          <div
            className="flex items-center justify-between gap-4 rounded-[10px] border px-3.5 py-3"
            style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <Monitor size={15} strokeWidth={1.7} style={{ color: "var(--text-faint)" }} />
              <div className="min-w-0">
                <div className="text-[12.5px]">Signed in</div>
                <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {lastSignIn ? `Last sign-in ${lastSignIn} PKT` : "Sign-in time unavailable"}
                </div>
              </div>
            </div>
            <span className="flex-none text-[11.5px]" style={{ color: "var(--color-gain)" }}>
              Active
            </span>
          </div>
          {/* Listing every device would need a session table of our own; Supabase
              does not expose other sessions to the client. One honest row beats
              a fabricated list. */}
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
            Signing out below ends this session only.
          </p>
        </div>
      </div>
    </Panel>
  );
}
