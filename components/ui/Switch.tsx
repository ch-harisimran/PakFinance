"use client";

import { useId } from "react";

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
