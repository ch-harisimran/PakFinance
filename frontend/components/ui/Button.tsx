"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Magnetic } from "@/components/motion/Magnetic";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center gap-2 rounded-full text-[14px] font-[550] leading-none " +
  "transition-[background-color,border-color,box-shadow,transform] duration-200 " +
  "[transition-timing-function:var(--ease-out)] h-11 px-[22px] whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-brass)] text-[#0A0B0D] hover:bg-[var(--color-brass-lit)] " +
    "shadow-[0_0_0_0_rgba(201,162,39,0)] hover:shadow-[0_0_24px_0_rgba(201,162,39,0.35)]",
  secondary:
    "text-[var(--text-primary)] border border-[var(--border-strong)] " +
    "hover:bg-[var(--surface-2)]",
  ghost: "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
};

export function Button({
  children,
  variant = "primary",
  magnetic = false,
  className = "",
  arrow = false,
  href,
  ...props
}: {
  children: ReactNode;
  variant?: Variant;
  magnetic?: boolean;
  arrow?: boolean;
  /** Renders an anchor instead of a button. Nesting a <button> in an <a> is
   *  invalid markup, so the element type has to change, not just the wrapper. */
  href?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = `${base} ${variants[variant]} ${className} group`;
  const inner = (
    <>
      {children}
      {arrow && (
        <span className="transition-transform duration-200 [transition-timing-function:var(--ease-out)] group-hover:translate-x-1">
          →
        </span>
      )}
    </>
  );

  const el = href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button className={cls} {...props}>
      {inner}
    </button>
  );

  return magnetic ? <Magnetic>{el}</Magnetic> : el;
}
