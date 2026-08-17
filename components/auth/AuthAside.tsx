"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The interactive half of the auth screens.
 *
 * `signup` shows an allocation ring you can point at — hovering a slice pulls
 * it forward and rewrites the centre label, so the panel demonstrates the
 * product rather than decorating around it.
 *
 * `login` shows a market pulse: holdings whose prices tick and flash, the way
 * they will once you are inside.
 *
 * Both are wrapped in a cursor-tracked spotlight. Everything stills under
 * prefers-reduced-motion.
 */

const SLICES = [
  { key: "Stocks", pct: 42, value: "Rs 1,650,000", color: "#C9A227" },
  { key: "Funds", pct: 26, value: "Rs 1,020,000", color: "#E6C767" },
  { key: "Cash", pct: 22, value: "Rs 900,000", color: "#8E7118" },
  { key: "Gold", pct: 10, value: "Rs 410,000", color: "#6B5A2E" },
];

const ARCS = SLICES.reduce<{ items: (typeof SLICES[number] & { offset: number })[]; used: number }>(
  (acc, s) => {
    acc.items.push({ ...s, offset: -acc.used });
    acc.used += s.pct;
    return acc;
  },
  { items: [], used: 0 },
).items;

const TICKERS = [
  { sym: "OGDC", base: 218.4 },
  { sym: "MEBL", base: 287.1 },
  { sym: "LUCK", base: 1042.75 },
  { sym: "ENGRO", base: 318.65 },
];

function Spotlight({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className="relative flex h-full items-center justify-center overflow-hidden px-8 py-16"
      style={{
        // Two layers: a static warm wash, plus a pointer-tracked highlight.
        backgroundImage:
          "radial-gradient(420px circle at var(--mx, 50%) var(--my, 40%), rgba(201,162,39,0.13), transparent 70%)," +
          "radial-gradient(900px 700px at 70% 20%, rgba(201,162,39,0.07), transparent 62%)",
        backgroundColor: "var(--color-ground-slate)",
        borderLeft: "1px solid var(--border-subtle)",
      }}
    >
      {children}
    </div>
  );
}

function SignupPanel() {
  const [active, setActive] = useState(0);
  const slice = SLICES[active];

  return (
    <div className="relative w-full max-w-[420px]">
      <div
        className="mb-10 text-[11px] uppercase tracking-[0.18em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
      >
        What you get
      </div>
      <h2
        className="mb-12 text-[clamp(1.7rem,2.4vw,2.2rem)] leading-[1.1] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Every rupee you own, in one ring.
      </h2>

      <div className="flex items-center gap-10">
        <div className="relative flex-none">
          <svg viewBox="0 0 200 200" className="h-[190px] w-[190px] -rotate-90">
            {ARCS.map((a, i) => (
              <circle
                key={a.key}
                cx="100"
                cy="100"
                r="80"
                pathLength={100}
                fill="none"
                stroke={a.color}
                strokeWidth={i === active ? 24 : 16}
                strokeDasharray={`${a.pct - 0.8} ${100 - a.pct + 0.8}`}
                strokeDashoffset={a.offset}
                onMouseEnter={() => setActive(i)}
                className="cursor-pointer transition-[stroke-width,opacity] duration-300 [transition-timing-function:var(--ease-out)]"
                style={{ opacity: i === active ? 1 : 0.42 }}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[26px] font-semibold leading-none tracking-[-0.02em]" data-numeric>
              {slice.pct}%
            </div>
            <div className="mt-1.5 text-[11.5px]" style={{ color: "var(--text-muted)" }}>
              {slice.key}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {SLICES.map((s, i) => (
            <button
              key={s.key}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-left transition-colors duration-200"
              style={{ backgroundColor: i === active ? "var(--surface-2)" : "transparent" }}
            >
              <span
                className="h-6 w-[3px] flex-none rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium">{s.key}</span>
                <span
                  className="block text-[11.5px]"
                  style={{ color: "var(--text-faint)" }}
                  data-numeric
                >
                  {s.value}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-12 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        PSX holdings, mutual funds, cash and gold — priced automatically and
        rolled into a single net-worth figure you can actually trust.
      </p>
    </div>
  );
}

function LoginPanel() {
  const [prices, setPrices] = useState(() => TICKERS.map((t) => ({ ...t, px: t.base, dir: 0 })));

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      setPrices((prev) => {
        const i = Math.floor(Math.random() * prev.length);
        return prev.map((p, idx) => {
          if (idx !== i) return { ...p, dir: 0 };
          const delta = (Math.random() - 0.45) * (p.base * 0.004);
          return { ...p, px: p.px + delta, dir: delta >= 0 ? 1 : -1 };
        });
      });
    }, 1900);

    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-[420px]">
      <div
        className="mb-10 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
      >
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ backgroundColor: "var(--color-gain)" }}
        />
        Market open {"·"} 15:12 PKT
      </div>
      <h2
        className="mb-12 text-[clamp(1.7rem,2.4vw,2.2rem)] leading-[1.1] tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Your portfolio kept moving while you were away.
      </h2>

      <div className="card overflow-hidden">
        <div
          className="flex items-baseline justify-between border-b px-5 py-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
            KSE-100
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-[17px] font-semibold tracking-[-0.015em]" data-numeric>
              78,412
            </span>
            <span className="text-[12.5px]" style={{ color: "var(--color-gain)" }} data-numeric>
              +1.24%
            </span>
          </span>
        </div>

        {prices.map((p) => (
          <div
            key={p.sym}
            className="flex items-center justify-between border-b px-5 py-3.5 transition-colors duration-500 last:border-b-0"
            style={{
              borderColor: "var(--border-subtle)",
              backgroundColor:
                p.dir === 1
                  ? "rgba(63,191,127,0.10)"
                  : p.dir === -1
                    ? "rgba(226,87,76,0.10)"
                    : "transparent",
            }}
            data-numeric
          >
            <span
              className="text-[12.5px] font-medium"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {p.sym}
            </span>
            <span className="flex items-baseline gap-3">
              <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
                {p.px.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <span
                className="w-[54px] text-right text-[12.5px]"
                style={{
                  color: p.px >= p.base ? "var(--color-gain)" : "var(--color-loss)",
                }}
              >
                {p.px >= p.base ? "+" : "−"}
                {Math.abs(((p.px - p.base) / p.base) * 100).toFixed(2)}%
              </span>
            </span>
          </div>
        ))}
      </div>

      <p className="mt-10 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        Prices refresh through the trading session and freeze when the market
        closes — so what you see is always dated, never guessed.
      </p>
    </div>
  );
}

/**
 * Both variants stay mounted and crossfade — see the note in the split layout.
 * The hidden one is inert to pointers and removed from the a11y tree, so it
 * cannot be tabbed into behind the visible panel.
 */
export function AuthAside({
  variant,
  show,
}: {
  variant: "signup" | "login";
  show: boolean;
}) {
  return (
    <aside
      className="absolute inset-0 transition-opacity duration-[600ms] [transition-timing-function:var(--ease-out)]"
      style={{
        opacity: show ? 1 : 0,
        pointerEvents: show ? "auto" : "none",
      }}
      aria-hidden={!show}
      inert={!show}
    >
      <Spotlight>{variant === "signup" ? <SignupPanel /> : <LoginPanel />}</Spotlight>
    </aside>
  );
}
