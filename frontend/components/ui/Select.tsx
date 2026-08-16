"use client";

import { useId, type SelectHTMLAttributes } from "react";

/**
 * Native <select>, styled to match Field.
 *
 * Deliberately not a custom listbox: the native control gets the platform's own
 * keyboard handling, screen-reader support and mobile wheel picker for free, and
 * none of the options here are rich enough to justify rebuilding that.
 *
 * The explicit `backgroundColor` on each <option> is not redundant — on Windows
 * the popup list is painted by the OS, which ignores the parent's dark styling
 * and would otherwise render white-on-white.
 */
export function Select({
  label,
  name,
  options,
  className = "",
  ...props
}: {
  label: string;
  name: string;
  options: [string, string][];
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="h-11 w-full rounded-[12px] border px-3 text-[14.5px] outline-none transition-[border-color] duration-200 focus:border-[var(--color-brass)]"
        style={{
          backgroundColor: "var(--surface-2)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-primary)",
        }}
        {...props}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} style={{ backgroundColor: "#111318" }}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}
