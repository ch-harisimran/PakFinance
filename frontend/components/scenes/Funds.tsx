"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Scene 05 — mutual funds.
 *
 * The fund cards and the allocation donut share one colour key, so the ring is
 * legibly the same data as the list rather than a decorative chart. Arcs use
 * pathLength=100, which lets every dash value be a plain percentage.
 *
 * NAVs carry an explicit "as of" date everywhere: MUFAP publishes once daily,
 * and implying live pricing here would be a lie the product can't keep.
 */

const FUNDS = [
  { name: "Meezan Islamic Fund", amc: "Al Meezan", cat: "Islamic Equity", nav: "78.42", pct: 34, color: "#C9A227" },
  { name: "UBL Liquidity Plus", amc: "UBL Funds", cat: "Money Market", nav: "112.87", pct: 28, color: "#E6C767" },
  { name: "Atlas Income Fund", amc: "Atlas AMC", cat: "Income", nav: "541.30", pct: 22, color: "#8E7118" },
  { name: "NBP Islamic Index", amc: "NBP Funds", cat: "Index Tracker", nav: "19.64", pct: 16, color: "#6B5A2E" },
];

/** Each arc starts where the previous one ended. Computed once, at module
 *  scope — FUNDS is static, so there is nothing here for a render to redo. */
const ARCS = FUNDS.reduce<{ items: (typeof FUNDS[number] & { offset: number })[]; used: number }>(
  (acc, f) => {
    acc.items.push({ ...f, offset: -acc.used });
    acc.used += f.pct;
    return acc;
  },
  { items: [], used: 0 },
).items;

export function Funds() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const arcs = gsap.utils.toArray<SVGCircleElement>("[data-arc]");
        arcs.forEach((arc) => gsap.set(arc, { attr: { "stroke-dasharray": "0 100" } }));

        gsap.to(arcs, {
          attr: { "stroke-dasharray": (i, t: SVGCircleElement) => `${t.dataset.pct} ${100 - Number(t.dataset.pct)}` },
          duration: 1.1,
          ease: "power2.out",
          stagger: 0.14,
          scrollTrigger: { trigger: root.current, start: "top 74%", once: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Section id="funds" scene="funds" ground="warm">
      <SectionHead
        eyebrow="Mutual funds"
        headline={
          <>
            Investments <span style={{ color: "var(--text-muted)" }}>that grow with you.</span>
          </>
        }
        lede="Every AMC, every category, one allocation. Islamic and conventional funds side by side — filter to Shariah-compliant only whenever you want."
        className="mb-14"
      />

      <div ref={root} className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
        <Reveal stagger={0.09} className="flex flex-col gap-3">
          {FUNDS.map((f) => (
            <div
              key={f.name}
              className="card flex items-center gap-4 p-5 transition-transform duration-300 hover:-translate-y-0.5"
            >
              <span
                className="h-9 w-1 flex-none rounded-full"
                style={{ backgroundColor: f.color }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold tracking-[-0.01em]">{f.name}</div>
                <div
                  className="mt-1 truncate text-[11.5px]"
                  style={{ color: "var(--text-faint)" }}
                >
                  {f.amc} {"·"} {f.cat}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-semibold" data-numeric>
                  {f.nav}
                </div>
                <div
                  className="mt-1 text-[10px] uppercase tracking-[0.12em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  NAV {"·"} 14 Aug
                </div>
              </div>
              <div
                className="w-[46px] text-right text-[15px] font-semibold"
                style={{ color: "var(--brass-text)" }}
                data-numeric
              >
                {f.pct}%
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal y={40} className="flex flex-col items-center justify-center">
          <div className="relative">
            <svg viewBox="0 0 200 200" className="h-[clamp(200px,26vw,280px)] w-[clamp(200px,26vw,280px)] -rotate-90">
              {ARCS.map((a) => (
                <circle
                  key={a.name}
                  data-arc
                  data-pct={a.pct}
                  cx="100"
                  cy="100"
                  r="80"
                  pathLength={100}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="18"
                  strokeDasharray="0 100"
                  strokeDashoffset={a.offset}
                />
              ))}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className="mb-1.5 text-[10px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
              >
                Allocation
              </div>
              <div className="text-[24px] font-semibold tracking-[-0.02em]" data-numeric>
                4 funds
              </div>
            </div>
          </div>
          <p className="mt-8 max-w-[34ch] text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
            NAVs are published once daily by MUFAP. PakFinance stamps every value
            with the date it was priced.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
