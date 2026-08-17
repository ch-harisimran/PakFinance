"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section, SectionHead } from "@/components/layout/Section";
import { Reveal } from "@/components/motion/Reveal";
import { CountUp } from "@/components/motion/CountUp";

/**
 * Scene 06 — Goals. The light break.
 *
 * This is the only section on `paper`, and it is load-bearing: dark → light →
 * dark mid-scroll is the strongest "a human designed this" signal on the page,
 * and it lands on the most emotional beat. Extra vertical padding — this is
 * where the page breathes.
 *
 * Note the motes drift in brass-deep, not white: on a light ground, glow reads
 * as dirt unless it is *darker* than the surface.
 */

const GOALS = [
  { name: "Emergency fund", have: 350000, want: 500000, pct: 70, eta: "Mar 2027" },
  { name: "New car", have: 1200000, want: 2000000, pct: 60, eta: "Nov 2028" },
  { name: "Dream home", have: 4500000, want: 10000000, pct: 45, eta: "Jun 2032" },
];

export function Goals() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.from("[data-bar]", {
          scaleX: 0,
          duration: 1.1,
          ease: "power3.out",
          stagger: 0.14,
          transformOrigin: "left center",
          scrollTrigger: { trigger: root.current, start: "top 76%", once: true },
        });

        gsap.to("[data-mote]", {
          y: -26,
          opacity: 0.9,
          duration: 2.6,
          ease: "sine.inOut",
          stagger: { each: 0.35, repeat: -1, yoyo: true },
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Section
      id="goals"
      scene="goals"
      ground="paper"
      className="py-[clamp(140px,20vh,220px)]"
    >
      <SectionHead
        eyebrow="Goals"
        headline={
          <>
            Turn financial goals into <span style={{ color: "var(--text-muted)" }}>something you can see.</span>
          </>
        }
        lede="A number in a savings account is abstract. A ring that fills, a date that moves closer, and a monthly figure you can actually hit — that is something you keep doing."
        className="mb-16"
      />

      <div ref={root} className="grid gap-5 md:grid-cols-3">
        {GOALS.map((g, i) => (
          <Reveal key={g.name} y={36} delay={i * 0.08}>
            <div className="card relative h-full overflow-hidden p-7">
              {/* drifting motes */}
              {[0, 1, 2].map((m) => (
                <span
                  key={m}
                  data-mote
                  aria-hidden="true"
                  className="pointer-events-none absolute h-1 w-1 rounded-full opacity-30"
                  style={{
                    backgroundColor: "var(--brass-text)",
                    left: `${22 + m * 26}%`,
                    top: `${68 + m * 6}%`,
                  }}
                />
              ))}

              <div className="mb-8 flex items-start justify-between">
                <div className="text-[16px] font-semibold tracking-[-0.01em]">{g.name}</div>
                <div
                  className="text-[10px] uppercase tracking-[0.13em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  {g.eta}
                </div>
              </div>

              <div className="flex items-baseline text-[30px] font-semibold leading-none tracking-[-0.025em]">
                <CountUp value={g.pct} suffix="%" />
              </div>
              <div className="mt-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                funded
              </div>

              <div
                className="mt-7 h-1.5 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--surface-3)" }}
              >
                <div
                  data-bar
                  className="h-full rounded-full"
                  style={{ width: `${g.pct}%`, backgroundColor: "var(--brass-text)" }}
                />
              </div>

              <div
                className="mt-5 flex items-baseline justify-between border-t pt-5 text-[13px]"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <span data-numeric style={{ color: "var(--text-primary)" }}>
                  Rs {g.have.toLocaleString("en-US")}
                </span>
                <span data-numeric style={{ color: "var(--text-faint)" }}>
                  of Rs {g.want.toLocaleString("en-US")}
                </span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
