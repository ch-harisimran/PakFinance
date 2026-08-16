"use client";

import { useState, useTransition } from "react";
import { Panel } from "@/components/dashboard/Panel";
import { updatePreferences } from "@/app/dashboard/actions";
import { formatCompact } from "@/lib/money";
import type { Profile } from "@/lib/profile";

/**
 * Preferences.
 *
 * Number notation is here because `lib/money.ts` already implements lakh/crore —
 * a Pakistani reader takes "24.5L" in faster than "2,450,000", and the formatter
 * should follow the reader rather than the developer.
 *
 * The theme switcher that used to sit here has gone. There is exactly one
 * palette in design/tokens.css, so Light and System changed nothing at all —
 * a control whose only effect is to look like a control.
 */

const SAMPLE = 2450058;

export function PreferencesCard({ profile }: { profile: Profile }) {
  const [notation, setNotation] = useState(profile.notation);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  // Saved on click rather than behind a Save button: it is one setting with an
  // immediate preview, and a button would just add a step to confirm what the
  // user can already see.
  function choose(next: Profile["notation"]) {
    setNotation(next);
    const form = new FormData();
    form.set("notation", next);
    form.set("theme", profile.theme);
    startTransition(async () => {
      const result = await updatePreferences({}, form);
      if (!result.ok) {
        setError(result.error ?? "Could not save that.");
        setNotation(profile.notation);
      } else {
        setError(undefined);
      }
    });
  }

  return (
    <Panel title="Preferences">
      <div>
        <div className="mb-1 text-[13px] font-medium">Number format</div>
        <p className="mb-3 text-[12px]" style={{ color: "var(--text-faint)" }}>
          How large figures are abbreviated.
        </p>

        <div className="flex gap-0.5 rounded-[10px] border p-1" style={{ borderColor: "var(--border-subtle)" }}>
          {(
            [
              ["international", "International"],
              ["subcontinental", "Lakh / Crore"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => choose(key)}
              disabled={pending}
              className="flex-1 rounded-[7px] px-3 py-2 text-[12.5px] transition-colors duration-200 disabled:opacity-70"
              style={{
                backgroundColor: notation === key ? "var(--surface-3)" : "transparent",
                color: notation === key ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
          Your net worth reads{" "}
          <span className="font-semibold" style={{ color: "var(--text-primary)" }} data-numeric>
            PKR {formatCompact(SAMPLE, notation)}
          </span>
        </p>

        {error && (
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--color-loss)" }} role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="mb-1 text-[13px] font-medium">Alerts</div>
        <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Repayments falling due and goals drifting off pace appear in the bell at
          the top of every screen, worked out from your own records.
        </p>
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Email reminders are set per loan, not globally — open a loan and tick
          &ldquo;Email me before this is due&rdquo;. Nothing else emails you.
        </p>
      </div>
    </Panel>
  );
}
