"use client";

import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Text input per design system §6.4: 44px, radius/md, surface-2, brass focus
 * ring. Errors are colour *and* text — never colour alone.
 */
export function Field({
  label,
  error,
  hint,
  type = "text",
  className = "",
  ...props
}: {
  label: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12.5px]"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          className="h-11 w-full rounded-[12px] border px-3.5 text-[14.5px] outline-none transition-[border-color,box-shadow,background-color] duration-200 [transition-timing-function:var(--ease-out)] placeholder:text-[var(--text-faint)] focus:border-[var(--color-brass)] focus:shadow-[0_0_0_3px_rgba(201,162,39,0.2)]"
          style={{
            backgroundColor: "var(--surface-2)",
            borderColor: error ? "var(--color-loss)" : "var(--border-subtle)",
            color: "var(--text-primary)",
            paddingRight: isPassword ? 42 : undefined,
          }}
          aria-invalid={!!error}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-[9px] transition-colors duration-200 hover:bg-[var(--surface-3)]"
            style={{ color: "var(--text-muted)" }}
          >
            {reveal ? <EyeOff size={15} strokeWidth={1.7} /> : <Eye size={15} strokeWidth={1.7} />}
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--color-loss)" }}>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
