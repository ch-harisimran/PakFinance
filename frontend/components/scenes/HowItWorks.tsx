"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Section, SectionHead } from "@/components/layout/Section";

/**
 * Scene 11 — How it works.
 *
 * A brass rule draws downward on scrub and each step lights up as the rule
 * passes it, so the three steps read as one continuous motion rather than three
 * separate reveals.
 */

const STEPS = [
  {
    n: "01",
    title: "Create your account",
    body: "Sign up with an email address and confirm it with a one-time code. No documents, no branch visit, no waiting.",
  },
  {
    n: "02",
    title: "Add your finances",
    body: "Enter your PSX holdings, mutual funds, bank balances, loans and goals — or import them from a CSV your broker already gives you.",
  },
  {
    n: "03",
    title: "See the bigger picture",
    body: "PakFinance prices everything automatically and brings it together into one financial overview that updates on its own.",
  },
];

export function HowItWorks() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduced: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { reduced } = ctx.conditions as { motion: boolean; reduced: boolean };
          const steps = gsap.utils.toArray<HTMLElement>("[data-step]");

          if (reduced) {
            gsap.set("[data-rule-fill]", { scaleY: 1 });
            gsap.set(steps, { opacity: 1 });
            return;
          }

          gsap.fromTo(
            "[data-rule-fill]",
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: "none",
              transformOrigin: "top center",
              scrollTrigger: { trigger: root.current, start: "top 68%", end: "bottom 78%", scrub: 0.7 },
            },
          );

          steps.forEach((step) => {
            gsap.fromTo(
              step,
              { opacity: 0.32, y: 22 },
              {
                opacity: 1,
                y: 0,
                duration: 0.7,
                ease: "power3.out",
                scrollTrigger: { trigger: step, start: "top 74%", once: true },
              },
            );
          });
        },
      );
      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <Section id="how-it-works" scene="how-it-works" ground="slate">
      <SectionHead
        eyebrow="How it works"
        headline={
          <>
            Three steps. <span style={{ color: "var(--text-muted)" }}>Then it runs itself.</span>
          </>
        }
        className="mb-16"
      />

      <div ref={root} className="relative pl-14 sm:pl-24">
        {/* The rule */}
        <div
          aria-hidden="true"
          className="absolute bottom-6 left-[13px] top-3 w-px sm:left-[43px]"
          style={{ backgroundColor: "var(--border-subtle)" }}
        >
          <div
            data-rule-fill
            className="h-full w-full origin-top"
            style={{ backgroundColor: "var(--color-brass)" }}
          />
        </div>

        <div className="flex flex-col gap-16 sm:gap-20">
          {STEPS.map((s) => (
            <div key={s.n} data-step className="relative">
              <span
                aria-hidden="true"
                className="absolute -left-14 top-2 h-2.5 w-2.5 rounded-full sm:-left-24"
                style={{
                  backgroundColor: "var(--color-brass)",
                  marginLeft: "-4px",
                  boxShadow: "0 0 0 5px var(--ground)",
                }}
              />
              <div
                className="mb-4 text-[clamp(2.6rem,5vw,4rem)] leading-none tracking-[-0.03em]"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
              >
                {s.n}
              </div>
              <h3 className="mb-3 text-[clamp(20px,2.4vw,28px)] font-semibold tracking-[-0.02em]">
                {s.title}
              </h3>
              <p
                className="max-w-[54ch] text-[15px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
