import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";

/**
 * The form column's contents — wordmark, heading block, form, footer.
 *
 * The two-panel grid and the side-swap animation live in
 * app/(auth)/(split)/layout.tsx, which persists across both routes. Keeping
 * the grid out of here is what lets the columns animate instead of remount.
 */
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <>
      <Logo href="/" className="auth-brand" />

      <div
        className="auth-eyebrow text-[11px] uppercase tracking-[0.18em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
      >
        {eyebrow}
      </div>
      <h1 className="auth-title" style={{ fontFamily: "var(--font-display)" }}>
        {title}
      </h1>
      <p className="auth-sub text-[14.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {subtitle}
      </p>

      {children}

      <div className="auth-footer text-[13.5px]" style={{ color: "var(--text-muted)" }}>
        {footer}
      </div>
    </>
  );
}
