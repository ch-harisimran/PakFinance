"use client";

import { CountUp } from "@/components/motion/CountUp";
import { Tilt } from "@/components/motion/Tilt";
import { TrendingUp } from "lucide-react";

/**
 * The hero composition. Every card here is live DOM — no images.
 *
 * Cohesion strategy: two flex columns that overlap by a negative margin, not
 * absolutely positioned cards floating in a void. The overlap is tuned to each
 * card's own padding — the left column sits *in front* and eats 24px of the
 * centrepiece's 28px left padding, so the cluster interlocks as one object
 * while no character of text is ever covered. Same rule for the loan card
 * against the centrepiece's 24px bottom padding.
 *
 * Depth lives in `data-z`, not in a CSS transform. The hero timeline animates
 * `y`/`opacity` on these same elements, and GSAP writes a whole transform when
 * it does — a CSS `translateZ` here would be silently wiped on the first frame.
 * One system owns the transform.
 */

const HOLDINGS = [
  { sym: "OGDC", px: "218.40", delta: "+2.14%", up: true, tick: true },
  { sym: "LUCK", px: "1,042.75", delta: "+0.86%", up: true },
  { sym: "MEBL", px: "287.10", delta: "−0.42%", up: false },
  { sym: "ENGRO", px: "318.65", delta: "+1.03%", up: true },
  { sym: "HBL", px: "154.20", delta: "−0.31%", up: false },
];

const SPARK_LINE =
  "M0,74 C34,70 52,60 78,63 C104,66 118,50 146,52 C174,54 188,40 214,44 " +
  "C240,48 254,33 282,36 C310,39 322,26 350,24 C378,22 396,16 460,10";

const TILES = [
  { k: "Invested", v: "Rs 1.65M" },
  { k: "Bank balance", v: "Rs 900K" },
  { k: "Goals on track", v: "72%" },
];

const PRESERVE = "[transform-style:preserve-3d]";

export function HeroDeck() {
  return (
    <div className="relative [perspective:1600px] max-lg:[perspective:none]">
      {/* One soft light source behind the whole cluster — binds the cards into
          a single lit object rather than several separately-lit tiles. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-16 -inset-y-12 max-lg:hidden"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,162,39,0.10), rgba(201,162,39,0.03) 55%, transparent 78%)",
        }}
      />

      <Tilt
        max={3}
        className={`relative ${PRESERVE}`}
        style={{ transform: "rotateY(-9deg) rotateX(3deg)" }}
      >
        <div className={`flex items-start ${PRESERVE} max-lg:flex-col max-lg:gap-2.5`}>
          {/* ── Left column: the market/activity stack, in front ── */}
          <div
            className={`z-30 flex w-[40%] flex-col gap-3 ${PRESERVE} max-lg:w-full`}
          >
            {/* PSX holdings — the credibility card. The KSE-100 index heads this
                card rather than floating separately: the index belongs with the
                market data, and a separate chip collided with the centrepiece. */}
            <div data-deck-item data-z="70" className="glass-panel px-4 py-3.5">
              <div
                className="mb-3 flex items-end justify-between border-b pb-3"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div>
                  <div
                    className="mb-1 text-[9.5px] uppercase tracking-[0.14em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                  >
                    KSE-100
                  </div>
                  <div className="text-[16px] font-semibold tracking-[-0.015em]" data-numeric>
                    78,412
                  </div>
                </div>
                <div
                  className="text-[12.5px]"
                  style={{ color: "var(--color-gain)" }}
                  data-numeric
                >
                  +1.24%
                </div>
              </div>
              <div
                className="mb-1 flex justify-between text-[9.5px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
              >
                <span>Holdings</span>
                <span>Today</span>
              </div>
              {HOLDINGS.map((h) => (
                <div
                  key={h.sym}
                  className={`-mx-2 grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[7px] px-2 py-[7px] ${
                    h.tick ? "tick-row" : ""
                  }`}
                  style={h.tick ? { animationDelay: "1.1s" } : undefined}
                  data-numeric
                >
                  <span
                    className="text-[12px] font-medium"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}
                  >
                    {h.sym}
                  </span>
                  <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                    {h.px}
                  </span>
                  <span
                    className="w-[52px] text-right text-[11.5px]"
                    style={{ color: h.up ? "var(--color-gain)" : "var(--color-loss)" }}
                  >
                    {h.delta}
                  </span>
                </div>
              ))}
            </div>

            {/* Mutual fund NAV — the honest "as of" stamp */}
            <div
              data-deck-item
              data-z="62"
              className="glass-panel flex items-end justify-between px-4 py-3"
            >
              <div>
                <div
                  className="text-[9px] uppercase tracking-[0.13em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  Meezan Islamic Fund
                </div>
                <div className="mt-1.5 text-[14px] font-semibold" data-numeric>
                  NAV 78.42
                </div>
              </div>
              <div className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                as of 14 Aug
              </div>
            </div>

            {/* Salary pill */}
            <div
              data-deck-item
              data-z="76"
              className="glass-panel flex items-center gap-3 px-4 py-3"
            >
              <div
                className="grid h-8 w-8 flex-none place-items-center rounded-[9px]"
                style={{ backgroundColor: "var(--surface-2)" }}
              >
                <TrendingUp size={15} strokeWidth={2} color="var(--color-gain)" />
              </div>
              <div>
                <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  Salary credited
                </div>
                <div className="text-[15px] font-semibold tracking-[-0.01em]" data-numeric>
                  Rs 100,000
                </div>
              </div>
            </div>

            {/* Goal ring */}
            <div
              data-deck-item
              data-z="88"
              className="glass-panel flex items-center gap-3.5 px-4 py-3"
            >
              <svg className="h-11 w-11 flex-none" viewBox="0 0 44 44" aria-hidden="true">
                <circle cx="22" cy="22" r="20" fill="none" strokeWidth="4" stroke="var(--surface-3)" />
                <circle
                  data-goal-ring
                  cx="22"
                  cy="22"
                  r="20"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="var(--color-brass)"
                  strokeDasharray="126"
                  strokeDashoffset="126"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                />
              </svg>
              <div>
                <div className="text-[11px]" style={{ color: "var(--text-faint)" }}>
                  Emergency fund
                </div>
                <div className="text-[14.5px] font-semibold tracking-[-0.01em]">70% funded</div>
              </div>
            </div>
          </div>

          {/* ── Right column: the centrepiece, tucked under the left stack ── */}
          {/* Inset from the left on mobile so it sits UNDER the market stack
              rather than beside it — the same front-to-back reading the -ml-6
              overlap gives on desktop, expressed vertically. */}
          <div className={`z-20 -ml-6 flex-1 ${PRESERVE} max-lg:ml-4 max-lg:w-auto max-lg:self-stretch`}>
            <div
              data-deck-item
              data-deck-main
              data-z="18"
              className="glass-panel relative px-7 pb-6 pt-[26px] max-lg:px-5"
            >
              <div className="mb-[26px] flex items-start justify-between">
                <div
                  className="text-[10px] uppercase tracking-[0.16em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  Overview / August 2026
                </div>
                <div
                  className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}
                >
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full"
                    style={{ backgroundColor: "var(--color-gain)" }}
                  />
                  Live
                </div>
              </div>

              <div className="mb-[7px] text-[13px]" style={{ color: "var(--text-muted)" }}>
                Net worth
              </div>
              <div className="flex items-baseline text-[clamp(30px,3.1vw,40px)] font-semibold leading-none tracking-[-0.025em]">
                <span className="currency">PKR</span>
                <CountUp value={2450000} trigger="immediate" delay={1.9} duration={1.6} />
              </div>
              <div
                className="mt-[11px] flex items-center gap-2 text-[13.5px]"
                style={{ color: "var(--color-gain)" }}
                data-numeric
              >
                <TrendingUp size={14} strokeWidth={2} />
                +8.42%
                <span style={{ color: "var(--text-faint)" }}>
                  {"·"} Rs 190,300 this month
                </span>
              </div>

              <svg
                className="-mx-1 my-6 block h-24 w-[calc(100%+8px)]"
                viewBox="0 0 460 96"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3FBF7F" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3FBF7F" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  data-spark-fill
                  fill="url(#spark-fill)"
                  opacity="0"
                  d={`${SPARK_LINE} L460,96 L0,96 Z`}
                />
                <path
                  data-spark-line
                  d={SPARK_LINE}
                  fill="none"
                  stroke="var(--color-gain)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>

              <div className="grid grid-cols-3 gap-2.5">
                {TILES.map((t) => (
                  <div
                    key={t.k}
                    className="rounded-[11px] border px-3.5 py-3"
                    style={{
                      backgroundColor: "var(--surface-1)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <div className="mb-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {t.k}
                    </div>
                    <div className="text-[16.5px] font-semibold tracking-[-0.015em]" data-numeric>
                      {t.v}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Loan installment — the liability, deliberately shown.
                Pulled up into the centrepiece's bottom padding, never its tiles. */}
            <div
              data-deck-item
              data-z="40"
              className="glass-panel relative z-40 -mt-3 ml-auto w-[72%] px-4 py-3.5 max-lg:mt-0 max-lg:mr-4 max-lg:w-auto"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div
                    className="mb-2 text-[9.5px] uppercase tracking-[0.14em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                  >
                    Car loan {"·"} Meezan
                  </div>
                  <div className="text-[19px] font-semibold tracking-[-0.02em]" data-numeric>
                    Rs 42,300
                  </div>
                </div>
                <div
                  className="text-right text-[11px] leading-tight"
                  style={{ color: "var(--text-muted)" }}
                >
                  Next installment
                  <br />
                  in 6 days
                </div>
              </div>
              <div
                className="mt-3 h-[3px] overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--surface-3)" }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: "64%", backgroundColor: "var(--color-brass)" }}
                />
              </div>
            </div>
          </div>
        </div>
      </Tilt>
    </div>
  );
}
