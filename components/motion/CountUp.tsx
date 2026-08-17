"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Counts a number up when it enters the viewport, once.
 *
 * Renders the final value as text on the server so the figure is correct
 * before hydration and never causes layout shift — the animation only ever
 * replaces an already-correct number.
 */
export function CountUp({
  value,
  duration = 1.2,
  delay = 0,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  trigger = "scroll",
}: {
  value: number;
  duration?: number;
  delay?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** "scroll" fires on viewport entry; "immediate" fires on mount. */
  trigger?: "scroll" | "immediate";
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const format = (n: number) =>
    prefix +
    n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) +
    suffix;

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const counter = { n: 0 };
        const tween = gsap.to(counter, {
          n: value,
          duration,
          delay,
          ease: "power2.out",
          onUpdate: () => {
            el.textContent = format(counter.n);
          },
          paused: trigger === "scroll",
        });

        if (trigger === "scroll") {
          ScrollTrigger.create({
            trigger: el,
            start: "top 85%",
            once: true,
            onEnter: () => {
              el.textContent = format(0);
              tween.play();
            },
          });
        } else {
          el.textContent = format(0);
        }
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [value] },
  );

  return (
    <span ref={ref} className={className} data-numeric>
      {format(value)}
    </span>
  );
}
