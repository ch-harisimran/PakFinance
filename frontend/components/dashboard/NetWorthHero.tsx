"use client";

import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { NET_WORTH_SERIES, NET_WORTH } from "@/lib/dashboard-data";
import { formatCompact, formatFull, formatPct } from "@/lib/money";

/**
 * Zone 1 — the answer. One focal point at display scale.
 *
 * Net worth is a *balance*: it is true as of an instant, not "for" a month.
 * That is why the range chips here control the chart window only, and the month
 * selector in the page header governs the cash-flow cards instead. Conflating
 * the two is the conceptual error in the reference.
 */

const RANGES = [
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "1Y", months: 12 },
] as const;

const W = 760;
const H = 200;

export function NetWorthHero() {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1Y");

  const { path, area, points, lo, hi, change } = useMemo(() => {
    const months = RANGES.find((r) => r.key === range)!.months;
    const pts = NET_WORTH_SERIES.slice(-months);
    const values = pts.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.25 || 1;
    const lo = min - pad;
    const hi = max + pad;

    const x = (i: number) => (i / (pts.length - 1)) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

    const d = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)
      .join(" ");

    return {
      path: d,
      area: `${d} L${W},${H} L0,${H} Z`,
      points: pts,
      lo: min,
      hi: max,
      change: ((pts[pts.length - 1].v - pts[0].v) / pts[0].v) * 100,
    };
  }, [range]);

  return (
    <section className="card flex flex-col p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div
            className="mb-2.5 text-[10.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            Net worth · as of today
          </div>
          <div className="flex items-baseline text-[clamp(30px,4.2vw,46px)] font-semibold leading-none tracking-[-0.03em]">
            <span className="currency">PKR</span>
            <span data-numeric>{formatFull(NET_WORTH)}</span>
          </div>
          <div
            className="mt-3 flex items-center gap-2 text-[13.5px]"
            style={{ color: "var(--color-gain)" }}
            data-numeric
          >
            <TrendingUp size={14} strokeWidth={2} />
            {formatPct(change)}
            <span style={{ color: "var(--text-faint)" }}>over {range.toLowerCase()}</span>
          </div>
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

      <div className="relative mt-7 h-[clamp(150px,18vw,210px)] w-full">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="nw-hero" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A227" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
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
          <path d={area} fill="url(#nw-hero)" />
          <path
            d={path}
            fill="none"
            stroke="var(--color-brass)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div
        className="mt-3 flex justify-between text-[10.5px] uppercase tracking-[0.12em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
      >
        {points
          .filter((_, i) => i % Math.ceil(points.length / 6) === 0)
          .map((p) => (
            <span key={p.m}>{p.m}</span>
          ))}
      </div>

      <div
        className="mt-6 grid grid-cols-3 gap-4 border-t pt-5"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        {[
          { k: "Highest", v: formatCompact(hi) },
          { k: "Lowest", v: formatCompact(lo) },
          { k: "Change", v: formatPct(change), gain: true },
        ].map((s) => (
          <div key={s.k}>
            <div
              className="mb-1.5 text-[10px] uppercase tracking-[0.13em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              {s.k}
            </div>
            <div
              className="text-[15px] font-semibold tracking-[-0.015em]"
              style={{ color: s.gain ? "var(--color-gain)" : "var(--text-primary)" }}
              data-numeric
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
