"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroDeck } from "@/components/mock/HeroDeck";
import { SplitWords, WordMask } from "@/components/motion/SplitWords";

gsap.registerPlugin(useGSAP);

/**
 * Scene 01 — Hero.
 *
 * The load sequence is spec'd in design/LANDING-SPEC.md §3. Nothing moves at
 * the same time as anything else; the headline is readable at ~1.3s and never
 * waits on the deck, because it is the LCP element.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

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

          const cards = gsap.utils.toArray<HTMLElement>("[data-deck-item]");
          // Depth first, always — even with motion off the composition is 3D.
          cards.forEach((c) => gsap.set(c, { z: Number(c.dataset.z ?? 0) }));

          if (reduced) {
            gsap.set("[data-hero-fade], [data-word], [data-deck-item], [data-scroll-cue]", {
              opacity: 1,
              y: 0,
            });
            gsap.set("[data-spark-line]", { strokeDashoffset: 0 });
            gsap.set("[data-spark-fill]", { opacity: 1 });
            gsap.set("[data-goal-ring]", { strokeDashoffset: 35 });
            return;
          }

          const line = root.current?.querySelector<SVGPathElement>("[data-spark-line]") ?? null;
          const len = line?.getTotalLength() ?? 500;
          if (line) gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });

          const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

          tl.from("[data-hero-eyebrow]", { opacity: 0, y: 12, duration: 0.6 }, 0.3)
            .from(
              "[data-hero-headline] [data-word]",
              { opacity: 0, yPercent: 110, duration: 0.9, stagger: 0.07 },
              0.42,
            )
            .from("[data-hero-sub]", { opacity: 0, y: 16, duration: 0.7 }, 0.9)
            .from(
              "[data-hero-cta] > *",
              { opacity: 0, scale: 0.96, duration: 0.6, stagger: 0.04 },
              1.05,
            )
            // Cards drift forward out of depth; `z` is relative so each keeps its own plane.
            .from(
              cards,
              { opacity: 0, y: 28, z: "-=340", duration: 1.4, stagger: 0.09 },
              1.15,
            )
            .to(
              "[data-spark-line]",
              { strokeDashoffset: 0, duration: 1.5, ease: "power2.inOut" },
              1.9,
            )
            .to("[data-spark-fill]", { opacity: 1, duration: 1 }, 2.1)
            .to(
              "[data-goal-ring]",
              { strokeDashoffset: 35, duration: 1.4, ease: "power2.out" },
              1.9,
            )
            .from("[data-scroll-cue]", { opacity: 0, y: -8, duration: 0.6 }, 2.4);

          return () => tl.kill();
        },
      );

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      data-scene="hero"
      data-ground="ink"
      className="relative mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-14 px-5 pb-16 pt-[clamp(104px,13vh,150px)] sm:px-8 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-10 lg:px-12"
    >
      <div>
        <div
          data-hero-eyebrow
          className="mb-6 text-[11px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-brass)" }}
        >
          A calmer way to build wealth {"·"} Pakistan
        </div>

        <h1
          data-hero-headline
          className="mb-6 max-w-[13ch] text-[clamp(3rem,6.4vw,5.6rem)] font-normal leading-[0.98] tracking-[-0.025em]"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          <SplitWords text="Your entire financial life." />{" "}
          <span style={{ color: "var(--text-muted)" }}>
            <SplitWords text="One" />{" "}
            <WordMask>
              <em className="not-italic" style={{ color: "var(--color-brass-lit)", fontStyle: "italic" }}>
                intelligent
              </em>
            </WordMask>{" "}
            <SplitWords text="view." />
          </span>
        </h1>

        <p
          data-hero-sub
          className="mb-9 max-w-[44ch] text-[clamp(16px,1.3vw,18.5px)] leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          PSX holdings, mutual funds, loans, and goals — tracked together, priced
          automatically, in one quiet place.
        </p>

        <div data-hero-cta className="flex flex-wrap items-center gap-3">
          <Button href="/signup" variant="primary" magnetic arrow>
            Get Started — It&rsquo;s Free
          </Button>
          <Button href="#features" variant="secondary">
            Explore PakFinance
          </Button>
        </div>

      </div>

      <HeroDeck />

      <div
        data-scroll-cue
        className="col-span-full mt-6 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.16em] lg:mt-4"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
      >
        Scroll to explore
        <ArrowDown size={13} className="animate-bounce" strokeWidth={1.5} />
      </div>
    </section>
  );
}
