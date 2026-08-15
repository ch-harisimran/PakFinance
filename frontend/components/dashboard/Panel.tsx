import type { ReactNode } from "react";
import type { Freshness } from "@/lib/dashboard-data";

/**
 * Every dashboard card. The freshness chip is a first-class part of the header
 * rather than a global "updated 2 minutes ago" in the top bar — PSX prices,
 * MUFAP NAVs and hand-entered balances have wildly different ages, and saying
 * otherwise is a lie a finance product cannot afford.
 */
export function Panel({
  title,
  subtitle,
  freshness,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string;
  subtitle?: string;
  freshness?: Freshness;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      {(title || action) && (
        <header
          className="flex items-start justify-between gap-4 border-b px-5 py-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em]">{title}</h2>
            {subtitle && (
              <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex flex-none items-center gap-3">
            {freshness && <FreshnessChip freshness={freshness} />}
            {action}
          </div>
        </header>
      )}
      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

const TONE: Record<Freshness["tone"], string> = {
  live: "var(--color-gain)",
  daily: "var(--color-brass)",
  manual: "var(--text-faint)",
};

export function FreshnessChip({ freshness }: { freshness: Freshness }) {
  return (
    <span
      className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
      style={{
        fontFamily: "var(--font-mono)",
        color: "var(--text-faint)",
        borderColor: "var(--border-subtle)",
      }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${freshness.tone === "live" ? "animate-pulse" : ""}`}
        style={{ backgroundColor: TONE[freshness.tone] }}
      />
      {freshness.label}
    </span>
  );
}
