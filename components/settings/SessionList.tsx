"use client";

import { useState, useTransition } from "react";
import { Monitor, Smartphone, Terminal } from "lucide-react";
import { revokeSession } from "@/app/dashboard/actions";
import type { SessionRow } from "@/lib/queries-sessions";

/**
 * Signed-in devices.
 *
 * The point of this list is not administration, it is recognition: a session you
 * do not recognise is the first sign an account has been taken, and until now the
 * screen showed one invented row that could never have told you that.
 *
 * The current session has no revoke button — signing yourself out from here would
 * be a confusing way to spell "log out", which is one panel below.
 */
export function SessionList({ sessions }: { sessions: SessionRow[] }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [pending, startTransition] = useTransition();

  function revoke(id: string) {
    setBusy(id);
    startTransition(async () => {
      const result = await revokeSession(id);
      setError(result.ok ? undefined : (result.error ?? "Could not end that session."));
      setBusy(undefined);
    });
  }

  if (!sessions.length) {
    return (
      <p className="text-[12.5px]" style={{ color: "var(--text-faint)" }}>
        No active sessions recorded.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {sessions.map((s) => {
          const Icon = /iOS|Android/.test(s.device)
            ? Smartphone
            : s.device === "Server or script"
              ? Terminal
              : Monitor;

          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-[10px] border px-3.5 py-3"
              style={{
                borderColor: s.current ? "var(--border-strong)" : "var(--border-subtle)",
                backgroundColor: "var(--surface-1)",
              }}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Icon size={15} strokeWidth={1.7} style={{ color: "var(--text-faint)" }} />
                <div className="min-w-0">
                  <div className="truncate text-[12.5px]">
                    {s.device}
                    {s.current && (
                      <span className="ml-2 text-[11px]" style={{ color: "var(--color-gain)" }}>
                        this device
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                    {s.ip ?? "unknown IP"} · last active {formatWhen(s.lastSeenAt)}
                  </div>
                </div>
              </div>

              {!s.current && (
                <button
                  type="button"
                  onClick={() => revoke(s.id)}
                  disabled={pending && busy === s.id}
                  className="flex-none rounded-[8px] border px-2.5 py-1.5 text-[11.5px] transition-colors duration-200 hover:bg-[var(--surface-2)] disabled:opacity-60"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--color-loss)" }}
                >
                  {pending && busy === s.id ? "Ending…" : "Sign out"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
          {error}
        </p>
      )}

      <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
        Ending a session stops it renewing; that device is signed out within the hour.
      </p>
    </>
  );
}

/** Relative for the recent past, absolute once that stops being useful. */
function formatWhen(iso: string): string {
  const then = new Date(iso.replace(" ", "T"));
  const minutes = Math.round((Date.now() - then.getTime()) / 60_000);

  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} hours ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))} days ago`;

  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
