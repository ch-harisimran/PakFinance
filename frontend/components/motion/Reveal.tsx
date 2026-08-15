"use client";

import { useRef, type ReactNode } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Scroll-triggered entrance. `once: true` throughout — replaying a reveal on
 * scroll-back is the single clearest amateur tell on a page like this.
 *
 * Pass `stagger` to animate direct children in sequence instead of the wrapper
 * as one block.
 */
export function Reveal({
  children,
  y = 32,
  delay = 0,
  stagger,
  start = "top 78%",
  className,
}: {
  children: ReactNode;
  y?: number;
  delay?: number;
  stagger?: number;
  start?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const targets = stagger ? Array.from(el.children) : el;
        gsap.from(targets, {
          y,
          opacity: 0,
          duration: 0.85,
          delay,
          ease: "power3.out",
          stagger: stagger ?? 0,
          scrollTrigger: { trigger: el, start, once: true },
        });
      });

      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
