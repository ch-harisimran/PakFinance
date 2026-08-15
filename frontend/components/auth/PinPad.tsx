"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Six-digit PIN entry.
 *
 * Deliberately plainer than the OTP orbit: this appears when someone is trying
 * to get back into their own money, sometimes under time pressure. Flourish
 * belongs at signup, not at the lock screen.
 */
export function PinPad({
  length = 6,
  onComplete,
  disabled,
  error,
  autoFocus = true,
}: {
  length?: number;
  onComplete: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  /**
   * There is deliberately no effect here to clear the boxes after a rejection.
   * Callers remount this component with a changing `key` instead, which resets
   * the digits as part of the same render rather than triggering a second one.
   */

  const put = (i: number, raw: string) => {
    if (disabled) return;
    const v = raw.replace(/\D/g, "");
    if (!v) return;

    const chars = v.slice(0, length - i).split("");
    const next = [...digits];
    chars.forEach((c, k) => (next[i + k] = c));
    setDigits(next);

    const landed = Math.min(i + chars.length, length - 1);
    if (next.every(Boolean)) {
      refs.current[landed]?.blur();
      onComplete(next.join(""));
    } else {
      refs.current[landed]?.focus();
    }
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || disabled) return;
    e.preventDefault();
    const target = digits[i] ? i : Math.max(0, i - 1);
    setDigits((prev) => prev.map((d, idx) => (idx === target ? "" : d)));
    refs.current[target]?.focus();
  };

  return (
    <div className="flex justify-center gap-2.5">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d ? "•" : ""}
          onChange={(e) => put(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          inputMode="numeric"
          autoComplete="off"
          maxLength={length}
          disabled={disabled}
          aria-label={`PIN digit ${i + 1} of ${length}`}
          className="h-[58px] w-[46px] rounded-[12px] border text-center text-[22px] outline-none transition-[border-color,box-shadow] duration-200 focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)] disabled:opacity-50"
          style={{
            backgroundColor: "var(--surface-2)",
            borderColor: error
              ? "var(--color-loss)"
              : d
                ? "var(--color-brass)"
                : "var(--border-subtle)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
          }}
        />
      ))}
    </div>
  );
}
