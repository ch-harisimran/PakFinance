"use client";

import { useId, useState } from "react";

/**
 * Switch.
 *
 * The previous version failed the basic test of a toggle: you could not tell
 * the states apart. Off painted a grey track with a grey knob on it, which
 * read as a filled pill — i.e. "on, but disabled". On painted brass with a
 * near-black knob that disappeared into the dark UI around it.
 *
 * A switch has to encode state twice over:
 *   1. knob POSITION — left/right, the primary signal
 *   2. track FILL — empty vs filled
 * and the knob must stay high-contrast against its own track in both states.
 * Here the knob is ivory when off (against a near-empty track) and ink when on
 * (against brass), so it is always the brightest edge in the control.
 */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="relative h-6 w-11 flex-none rounded-full border transition-[background-color,border-color] duration-200 [transition-timing-function:var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: checked ? "var(--color-brass)" : "var(--surface-1)",
        borderColor: checked ? "var(--color-brass)" : "var(--border-strong)",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1/2 block h-[18px] w-[18px] -translate-y-1/2 rounded-full transition-transform duration-200 [transition-timing-function:var(--ease-out)]"
        style={{
          backgroundColor: checked ? "#0A0B0D" : "var(--text-secondary)",
          boxShadow: checked ? "none" : "0 1px 3px rgba(0,0,0,0.5)",
          transform: checked ? "translateX(23px)" : "translateX(3px)",
        }}
      />
    </button>
  );
}

/** Switch with its label and hint, as used throughout Settings. */
export function SwitchRow({
  label,
  hint,
  defaultOn = false,
}: {
  label: string;
  hint: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(defaultOn);

  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{label}</div>
        <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
          {hint}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* State in words as well as position — colour and placement alone are
            not enough, and this is the fastest way to make the control legible. */}
        <span
          className="w-[22px] text-right text-[11px] uppercase tracking-[0.1em]"
          style={{
            fontFamily: "var(--font-mono)",
            color: on ? "var(--brass-text)" : "var(--text-faint)",
          }}
        >
          {on ? "On" : "Off"}
        </span>
        <Switch checked={on} onChange={setOn} label={label} />
      </div>
    </div>
  );
}
