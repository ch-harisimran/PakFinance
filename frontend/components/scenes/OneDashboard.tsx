"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";

/**
 * Scene 03 — the unified dashboard, with the area chart drawing on scrub.
 * Scrubbed rather than timed: the user's own scroll speed draws the line.
 */

const STATS = [
  { k: "Net worth", v: 2450000, accent: true },
  { k: "Investments", v: 1650000 },
  { k: "Bank balance", v: 900000 },
  { k: "Loans", v: 650000 },
];

const CURVE =
  "M0,150 C60,144 96,124 150,128 C204,132 236,96 300,100 C364,104 392,74 450,78 " +
  "C508,82 540,50 600,44 C660,38 700,26 760,18";

export function OneDashboard() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const line = root.current?.querySelector<SVGPathElement>("[data-curve]");
        if (!line) return;
        const len = line.getTotalLength();
        gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });

        gsap.to(line, {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top 72%",
            end: "bottom 72%",
            scrub: 0.8,
          },
        });

        gsap.to("[data-curve-fill]", {
          opacity: 1,
          ease: "none",
          scrollTrigger: {
            trigger: root.current,
            start: "top 60%",
            end: "bottom 80%",
            scrub: 0.8,
          },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Section id="features" scene="one-dashboard" ground="slate">
      <SectionHead
        eyebrow="Everything in one place"
        headline={
          <>
            One dashboard. <span style={{ color: "var(--text-muted)" }}>Your entire financial life.</span>
          </>
        }
        lede="Stocks, funds, cash, debt and goals resolve into a single number that actually means something — and a line you can watch move."
        className="mb-14"
      />

      <div ref={root} className="card overflow-hidden p-6 sm:p-8">
        <Reveal stagger={0.08} className="mb-8 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.k}>
              <div
                className="mb-2.5 text-[10.5px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
              >
                {s.k}
              </div>
              <div
                className="flex items-baseline text-[clamp(22px,2.6vw,34px)] font-semibold leading-none tracking-[-0.025em]"
                style={{ color: s.accent ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                <span className="currency">PKR</span>
                <CountUp value={s.v} />
              </div>
            </div>
          ))}
        </Reveal>

        <div
          className="mb-6 flex items-center justify-between border-t pt-6"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            Net worth, last 12 months
          </div>
          <div className="text-[13px] font-semibold" style={{ color: "var(--color-gain)" }} data-numeric>
            +8.42%
          </div>
        </div>

        <svg
          viewBox="0 0 760 170"
          preserveAspectRatio="none"
          className="block h-[clamp(160px,22vw,260px)] w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C9A227" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[34, 72, 110, 148].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="760"
              y2={y}
              stroke="var(--border-subtle)"
              strokeWidth="1"
            />
          ))}
          <path data-curve-fill fill="url(#curve-fill)" opacity="0" d={`${CURVE} L760,170 L0,170 Z`} />
          <path
            data-curve
            d={CURVE}
            fill="none"
            stroke="var(--color-brass)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <Reveal
          stagger={0.06}
          className="mt-6 grid grid-cols-3 gap-3 border-t pt-6 sm:grid-cols-6"
        >
          {["Sep", "Nov", "Jan", "Mar", "May", "Aug"].map((m) => (
            <div
              key={m}
              className="text-center text-[10.5px] uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              {m}
            </div>
          ))}
        </Reveal>
      </div>
    </Section>
  );
}
