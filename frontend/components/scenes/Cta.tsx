"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";

/**
 * Scene 13 — the close.
 *
 * Particles converge on a central brass point. Deliberately a 2D canvas rather
 * than WebGL: visually indistinguishable at this scale, a fraction of the cost,
 * and it ships without a 600KB dependency.
 */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const COUNT = coarse ? 130 : 380;

    let w = 0;
    let h = 0;
    let raf = 0;
    let running = true;

    type P = { a: number; r: number; s: number; sz: number };
    const parts: P[] = Array.from({ length: COUNT }, () => ({
      a: Math.random() * Math.PI * 2,
      r: 0.25 + Math.random() * 0.85,
      s: 0.0006 + Math.random() * 0.0018,
      sz: 0.4 + Math.random() * 1.3,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const reach = Math.max(w, h) * 0.62;

      for (const p of parts) {
        p.r -= p.s;
        // Recycle at the centre rather than allocating new particles.
        if (p.r <= 0.02) {
          p.r = 1;
          p.a = Math.random() * Math.PI * 2;
        }
        const x = cx + Math.cos(p.a) * p.r * reach;
        const y = cy + Math.sin(p.a) * p.r * reach * 0.62;
        // Brighter as it nears the centre — the convergence is the point.
        const alpha = (1 - p.r) * 0.75;
        ctx.fillStyle = `rgba(201,162,39,${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, p.sz, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);

    // Don't burn frames while the section is off-screen.
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting;
      if (running) raf = requestAnimationFrame(frame);
      else cancelAnimationFrame(raf);
    });
    io.observe(canvas);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      io.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />;
}

export function Cta() {
  return (
    <section
      data-scene="cta"
      data-ground="ink"
      className="relative flex min-h-[86vh] items-center overflow-hidden px-5 py-32 sm:px-8"
    >
      <Particles />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[46vh] w-[46vw] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(201,162,39,0.16), rgba(201,162,39,0.04) 55%, transparent 76%)",
        }}
      />

      <Reveal className="relative mx-auto max-w-[46rem] text-center">
        <h2
          className="mx-auto max-w-[15ch] text-[clamp(2.4rem,6vw,4.8rem)] leading-[1.02] tracking-[-0.03em]"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          Your money has a bigger picture.
        </h2>
        <p
          className="mx-auto mt-7 max-w-[40ch] text-[clamp(15px,1.4vw,18px)]"
          style={{ color: "var(--text-secondary)" }}
        >
          Bring everything together with PakFinance.
        </p>
        <div className="mt-11 flex flex-wrap items-center justify-center gap-3">
          <Button
            href="/signup"
            variant="primary"
            magnetic
            arrow
            className="!h-13 !px-8 !text-[15px]"
          >
            Create Your Free Account
          </Button>
          <Button href="/login" variant="secondary" className="!h-13 !px-7">
            I already have an account
          </Button>
        </div>
        <p className="mt-8 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
          Free while in early access {"·"} No card required {"·"} Export your data any time
        </p>
      </Reveal>
    </section>
  );
}
