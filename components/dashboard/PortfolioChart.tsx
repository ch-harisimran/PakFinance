"use client";

import { useMemo, useState } from "react";
import { paisaCompact, paisaFull, formatPct, type Notation } from "@/lib/money";

/**
 * Portfolio value over time, from the backfilled daily closes.
 *
 * The series is already computed server-side by replaying trades forward
 * through history, so a position bought in 2023 is valued at 2023 prices. This
 * component only draws it.
 *
 * No dasharray anywhere: combined with a non-uniform viewBox stretch, a dash
 * pattern measured in screen space repeats and paints phantom segments.
 */

const RANGES = [
  { key: "1M", days: 30 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
  { key: "All", days: Infinity },
] as const;

const W = 900;
const H = 220;

export function PortfolioChart({
  series,
  notation,
}: {
  series: { date: string; valuePaisa: number }[];
  notation: Notation;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("All");

  const view = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;

    // Ranges anchor to the last data point, not the wall clock. `Date.now()` is
    // impure during render, and anchoring to the data is also more truthful: if
    // the market has been closed for three days, "1M" should still mean the last
    // month of trading rather than a window that is partly empty.
    const anchor = new Date(series[series.length - 1].date).getTime();
    const cutoff =
      days === Infinity ? "" : new Date(anchor - days * 864e5).toISOString().slice(0, 10);
    const points = series.filter((p) => p.date >= cutoff);
    if (points.length < 2) return null;

    const values = points.map((p) => p.valuePaisa);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.15 || Math.max(1, max * 0.05);
    const lo = min - pad;
    const hi = max + pad;

    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

    const d = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valuePaisa).toFixed(1)}`)
      .join(" ");

    const first = points[0].valuePaisa;
    const last = points[points.length - 1].valuePaisa;

    return {
      path: d,
      area: `${d} L${W},${H} L0,${H} Z`,
      first,
      last,
      min,
      max,
      changePct: first > 0 ? ((last - first) / first) * 100 : 0,
      from: points[0].date,
      to: points[points.length - 1].date,
    };
  }, [series, range]);

  const up = (view?.changePct ?? 0) >= 0;
  const stroke = up ? "var(--color-gain)" : "var(--color-loss)";

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className="mb-2.5 text-[10.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            Portfolio value
          </div>
          <div className="flex items-baseline text-[clamp(26px,3.4vw,38px)] font-semibold leading-none tracking-[-0.03em]">
            <span className="currency">PKR</span>
            <span data-numeric>{view ? paisaFull(view.last) : "—"}</span>
          </div>
          {view && (
            <div className="mt-3 text-[13.5px]" style={{ color: stroke }} data-numeric>
              {formatPct(view.changePct)}
              <span style={{ color: "var(--text-faint)" }}> since {view.from}</span>
            </div>
          )}
        </div>

        <div
          className="flex flex-none gap-0.5 rounded-[10px] border p-1"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="rounded-[7px] px-3 py-1.5 text-[12px] transition-colors duration-200"
              style={{
                backgroundColor: range === r.key ? "var(--surface-3)" : "transparent",
                color: range === r.key ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      {view ? (
        <>
          <div className="relative mt-7 h-[clamp(160px,20vw,230px)] w-full">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="pf-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={up ? "#3FBF7F" : "#E2574C"} stopOpacity="0.20" />
                  <stop offset="100%" stopColor={up ? "#3FBF7F" : "#E2574C"} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((r) => (
                <line
                  key={r}
                  x1="0"
                  y1={H * r}
                  x2={W}
                  y2={H * r}
                  stroke="var(--border-subtle)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <path d={view.area} fill="url(#pf-fill)" />
              <path
                d={view.path}
                fill="none"
                stroke={stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div
            className="mt-6 grid grid-cols-3 gap-4 border-t pt-5"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {[
              { k: "High", v: paisaCompact(view.max, notation) },
              { k: "Low", v: paisaCompact(view.min, notation) },
              { k: "Days tracked", v: String(series.length) },
            ].map((s) => (
              <div key={s.k}>
                <div
                  className="mb-1.5 text-[10px] uppercase tracking-[0.13em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  {s.k}
                </div>
                <div className="text-[15px] font-semibold tracking-[-0.015em]" data-numeric>
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
          Not enough history in this range yet.
        </p>
      )}
    </section>
  );
}
