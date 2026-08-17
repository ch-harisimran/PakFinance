"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Lenis smooth scroll, wired into the GSAP ticker so ScrollTrigger reads the
 * same frame Lenis just wrote. Without this the two run on separate clocks and
 * pinned sections visibly jitter.
 *
 * Skipped on touch (native momentum beats anything we'd fake) and under
 * reduced motion.
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (reduced || coarse) return;

    const lenis = new Lenis({
      duration: 1.1,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    lenis.on("scroll", ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    // Trigger positions are computed from laid-out text. If they are measured
    // before the webfonts land, every trigger is off by a few hundred pixels.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
  }, []);

  return null;
}
