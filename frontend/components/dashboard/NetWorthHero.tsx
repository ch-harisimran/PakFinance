"use client";

import { useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { paisaCompact, paisaFull, formatPct, type Notation } from "@/lib/money";

/**
 * Zone 1 — the answer. One focal point at display scale.
 *
 * Net worth is a BALANCE: true as of an instant, not "for" a month. The range
 * chips control the chart window only; the month selector in the page header
 * governs the cash-flow cards instead.
 *
 * The series comes from the daily snapshot job, so a new account has none. That
 * empty state is honest rather than hidden — projecting today's bank balance
 * backwards would draw a line that never happened.
 */

const RANGES = [
  { key: "1M", days: 30 },
  { key: "6M", days: 182 },
  { key: "1Y", days: 365 },
] as const;

const W = 760;
const H = 200;

export function NetWorthHero({
  netPaisa,
  series,
  notation,
}: {
  netPaisa: number;
  series: { date: string; valuePaisa: number }[];
  notation: Notation;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("1Y");

  const view = useMemo(() => {
    if (series.length < 2) return null;

    const days = RANGES.find((r) => r.key === range)!.days;
    // Anchor to the last data point, not the clock — impure during render, and
    // a window that is partly empty is worse than one that tracks the data.
    const anchor = new Date(series[series.length - 1].date).getTime();
    const cutoff = new Date(anchor - days * 864e5).toISOString().slice(0, 10);
    const points = series.filter((p) => p.date >= cutoff);
    if (points.length < 2) return null;

    const values = points.map((p) => p.valuePaisa);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.2 || Math.max(1, Math.abs(max) * 0.05);
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
      min,
      max,
      from: points[0].date,
      changePct: first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0,
    };
  }, [series, range]);

  const up = (view?.changePct ?? 0) >= 0;

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
            <span data-numeric>{paisaFull(netPaisa)}</span>
          </div>
          {view && (
            <div
              className="mt-3 flex items-center gap-2 text-[13.5px]"
              style={{ color: up ? "var(--color-gain)" : "var(--color-loss)" }}
              data-numeric
            >
              {up ? <TrendingUp size={14} strokeWidth={2} /> : <TrendingDown size={14} strokeWidth={2} />}
              {formatPct(view.changePct)}
              <span style={{ color: "var(--text-faint)" }}>since {view.from}</span>
            </div>
          )}
        </div>

        {series.length >= 2 && (
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
        )}
      </div>

      {view ? (
        <>
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
              <path d={view.area} fill="url(#nw-hero)" />
              <path
                d={view.path}
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
            className="mt-6 grid grid-cols-3 gap-4 border-t pt-5"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            {[
              { k: "Highest", v: paisaCompact(view.max, notation) },
              { k: "Lowest", v: paisaCompact(view.min, notation) },
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
        <div
          className="mt-7 rounded-[12px] border border-dashed px-5 py-10 text-center"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <p className="text-[13.5px]" style={{ color: "var(--text-muted)" }}>
            Your net-worth chart starts building from today.
          </p>
          <p className="mx-auto mt-2 max-w-[46ch] text-[12px]" style={{ color: "var(--text-faint)" }}>
            A snapshot is taken once a day. Past bank balances and NAVs can&rsquo;t be recovered,
            so the line is drawn only from real recorded days rather than guessed backwards.
          </p>
        </div>
      )}
    </section>
  );
}
