"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { FreshnessChip } from "@/components/dashboard/Panel";
import { SearchBox } from "@/components/dashboard/SearchBox";
import type { Freshness } from "@/lib/chart";

/**
 * Screen header. The primary action lives here, on the screen that owns the
 * record type — "Add" only means something once you know what you're adding.
 * The dashboard deliberately has no action; it's a read surface.
 */
export function PageHeader({
  title,
  subtitle,
  freshness,
  action,
  actionSlot,
  search,
  children,
}: {
  title: string;
  subtitle?: string;
  freshness?: Freshness;
  action?: string;
  /** A ready-made action element — used by the entry-form dialogs. */
  actionSlot?: ReactNode;
  /** Placeholder for this screen's own search, which writes `?q=` to the URL and
   *  is read back by the screen. Scoped to the records on this screen — there is
   *  no global search, by design. */
  search?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2
          className="text-[clamp(1.5rem,2.4vw,2rem)] leading-tight tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {freshness && <FreshnessChip freshness={freshness} />}
        {search && <SearchBox placeholder={search} />}
        {children}
        {actionSlot}
        {action && (
          <button
            className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
            style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
          >
            <Plus size={15} strokeWidth={2.2} />
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

/** Compact figure row used at the top of every detail screen. */
export function StatRow({
  stats,
}: {
  stats: { k: string; v: string; tone?: "gain" | "loss" | "muted" }[];
}) {
  return (
    <div className="card mb-5 grid grid-cols-2 gap-x-6 gap-y-6 p-5 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.k} className="min-w-0">
          <div
            className="mb-2 text-[10px] uppercase tracking-[0.13em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            {s.k}
          </div>
          <div
            className="truncate text-[clamp(18px,2vw,24px)] font-semibold leading-none tracking-[-0.025em]"
            style={{
              color:
                s.tone === "gain"
                  ? "var(--color-gain)"
                  : s.tone === "loss"
                    ? "var(--color-loss)"
                    : s.tone === "muted"
                      ? "var(--text-secondary)"
                      : "var(--text-primary)",
            }}
            data-numeric
          >
            {s.v}
          </div>
        </div>
      ))}
    </div>
  );
}
