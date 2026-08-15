"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Scene 07 — Loans.
 *
 * The remaining balance counts *down* as you scroll and the amortization ring
 * closes with it, resolving on a payoff date. That date is the whole emotional
 * payload of the section, and it needs no copy to land.
 */

const START = 1250000;
const END = 470000;
const RING = 2 * Math.PI * 84;

export function Loans() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = root.current;
      if (!el) return;

      const out = el.querySelector<HTMLElement>("[data-balance]");
      const ring = el.querySelector<SVGCircleElement>("[data-ring]");
      const paid = el.querySelector<HTMLElement>("[data-paid]");
      if (!out || !ring || !paid) return;

      const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { reduced } = ctx.conditions as { motion: boolean; reduced: boolean };

          if (reduced) {
            out.textContent = fmt(END);
            paid.textContent = "62";
            gsap.set(ring, { strokeDashoffset: RING * (1 - 0.62) });
            return;
          }

          const state = { n: START, pct: 0 };
          gsap.set(ring, { strokeDasharray: RING, strokeDashoffset: RING });

          gsap.to(state, {
            n: END,
            pct: 62,
            ease: "none",
            onUpdate: () => {
              out.textContent = fmt(state.n);
              paid.textContent = String(Math.round(state.pct));
              gsap.set(ring, { strokeDashoffset: RING * (1 - state.pct / 100) });
            },
            scrollTrigger: {
              trigger: el,
              start: "top 78%",
              end: "bottom 72%",
              scrub: 0.9,
            },
          });
        },
      );

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Section scene="loans" ground="warm">
      <SectionHead
        eyebrow="Loans & bank finance"
        headline={
          <>
            Know what you owe. <span style={{ color: "var(--text-muted)" }}>Know when you&rsquo;re free.</span>
          </>
        }
        lede="Enter the principal, markup rate and tenure once. PakFinance builds the full amortization schedule, splits every installment into principal and markup, and tells you the date it ends."
        className="mb-14"
      />

      <div ref={root} className="card grid gap-10 p-7 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-16">
        <div>
          <div
            className="mb-2.5 text-[10.5px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            Car loan {"·"} Meezan Bank {"·"} 5 years
          </div>

          <div className="flex items-baseline text-[clamp(34px,5vw,58px)] font-semibold leading-none tracking-[-0.03em]">
            <span className="currency">PKR</span>
            <span data-balance data-numeric>
              {START.toLocaleString("en-US")}
            </span>
          </div>
          <div className="mt-3 text-[14px]" style={{ color: "var(--text-muted)" }}>
            remaining
          </div>

          <Reveal
            stagger={0.07}
            className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-3"
          >
            {[
              { k: "Monthly installment", v: "Rs 42,500" },
              { k: "Markup rate", v: "16.5%" },
              { k: "Debt-free", v: "Mar 2029" },
            ].map((s) => (
              <div key={s.k}>
                <div
                  className="mb-2 text-[10px] uppercase tracking-[0.13em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  {s.k}
                </div>
                <div className="text-[17px] font-semibold tracking-[-0.015em]" data-numeric>
                  {s.v}
                </div>
              </div>
            ))}
          </Reveal>
        </div>

        <div className="relative mx-auto flex-none">
          <svg viewBox="0 0 200 200" className="h-[clamp(190px,22vw,240px)] w-[clamp(190px,22vw,240px)] -rotate-90">
            <circle cx="100" cy="100" r="84" fill="none" strokeWidth="12" stroke="var(--surface-3)" />
            <circle
              data-ring
              cx="100"
              cy="100"
              r="84"
              fill="none"
              strokeWidth="12"
              strokeLinecap="round"
              stroke="var(--color-brass)"
              strokeDasharray={RING}
              strokeDashoffset={RING}
            />
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[34px] font-semibold leading-none tracking-[-0.025em]">
              <span data-paid data-numeric>
                0
              </span>
              %
            </div>
            <div
              className="mt-2 text-[10px] uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              repaid
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
