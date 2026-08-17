"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/**
 * Scene 09 — the crescendo. Pinned while the curve draws left to right, the
 * value label rides the head of the line, and the ground itself lifts from
 * #0A0B0D toward #0E0F12 as a brass bloom grows behind the curve.
 *
 * The chart is built in *pixel* space, measured from the container, rather than
 * in a fixed viewBox stretched with preserveAspectRatio="none". That is not
 * fussiness:
 *
 *   - `stroke-dasharray` under `non-scaling-stroke` is measured in screen
 *     space, while `getTotalLength()` reports user space. Under a non-uniform
 *     squash the two disagree, the dash pattern repeats, and a second phantom
 *     segment of the line appears further along the path.
 *   - A non-uniform scale also distorts stroke width, so a 2.5px line renders
 *     thicker on some angles than others.
 *
 * With a 1:1 viewBox both problems disappear by construction, and the point
 * returned by getPointAtLength is already in the same pixels the label uses.
 */

/** Curve control points, normalised 0–1, scaled to the measured box. */
const P0: [number, number] = [0.058, 0.904];
const SEGMENTS: [number, number][][] = [
  [[0.125, 0.889], [0.171, 0.839], [0.238, 0.85]],
  [[0.304, 0.862], [0.346, 0.754], [0.417, 0.765]],
  [[0.488, 0.777], [0.525, 0.65], [0.596, 0.65]],
  [[0.667, 0.65], [0.704, 0.504], [0.783, 0.469]],
  [[0.863, 0.435], [0.895, 0.315], [0.933, 0.185]],
];
const GRID = [0.25, 0.433, 0.615, 0.798];

const START = 1000000;
const END = 2450000;

function buildPath(w: number, h: number) {
  const x = (n: number) => (n * w).toFixed(2);
  const y = (n: number) => (n * h).toFixed(2);
  let d = `M${x(P0[0])},${y(P0[1])}`;
  for (const [c1, c2, end] of SEGMENTS) {
    d += ` C${x(c1[0])},${y(c1[1])} ${x(c2[0])},${y(c2[1])} ${x(end[0])},${y(end[1])}`;
  }
  return d;
}

export function NetWorth() {
  const root = useRef<HTMLElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;

    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { w: Math.round(r.width), h: Math.round(r.height) };
      // Bail on no-op so a resize storm can't thrash the ScrollTrigger.
      setSize((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    // ResizeObserver is driven by the rendering pipeline, so it never fires in
    // a throttled or backgrounded tab. A timer fallback guarantees the chart
    // gets a size — without it, the whole scene silently renders nothing.
    const t = setTimeout(measure, 0);

    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  const { w, h } = size;
  const ready = w > 0 && h > 0;

  const curve = useMemo(() => (ready ? buildPath(w, h) : ""), [ready, w, h]);
  const area = useMemo(
    () => (ready ? `${curve} L${(0.933 * w).toFixed(2)},${h} L${(0.058 * w).toFixed(2)},${h} Z` : ""),
    [ready, curve, w, h],
  );

  useGSAP(
    () => {
      const el = root.current;
      if (!el || !ready) return;

      const line = el.querySelector<SVGPathElement>("[data-nw-line]");
      const head = el.querySelector<HTMLElement>("[data-nw-head]");
      const value = el.querySelector<HTMLElement>("[data-nw-value]");
      const bloom = el.querySelector<HTMLElement>("[data-nw-bloom]");
      const fill = el.querySelector<SVGPathElement>("[data-nw-fill]");
      if (!line || !head || !value || !bloom || !fill) return;

      const len = line.getTotalLength();
      const ink = document.querySelector<HTMLElement>('[data-ground-layer="ink"]');
      const fmt = (n: number) => `${(n / 1_000_000).toFixed(2)}M`;

      const paint = (p: number) => {
        gsap.set(line, { strokeDashoffset: len * (1 - p) });
        gsap.set(fill, { opacity: p * 0.9 });

        // Already in container pixels — no coordinate conversion to get wrong.
        const pt = line.getPointAtLength(len * p);
        gsap.set(head, { x: pt.x, y: pt.y });

        value.textContent = fmt(START + (END - START) * p);
        gsap.set(bloom, { opacity: 0.25 + p * 0.75, scale: 0.7 + p * 0.55 });
        if (ink) gsap.set(ink, { backgroundColor: gsap.utils.interpolate("#0A0B0D", "#0E0F12", p) });
      };

      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          reduced: "(max-width: 767px), (prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { reduced } = ctx.conditions as { motion: boolean; reduced: boolean };
          gsap.set(line, { strokeDasharray: len });

          if (reduced) {
            paint(1);
            return;
          }

          paint(0);
          const state = { p: 0 };
          const tween = gsap.to(state, {
            p: 1,
            ease: "none",
            onUpdate: () => paint(state.p),
            scrollTrigger: {
              trigger: el,
              // Pin only once the section fills the viewport, so the whole
              // graph is visible for the entire draw.
              start: "top top",
              end: "+=150%",
              pin: "[data-nw-pin]",
              scrub: 0.9,
            },
          });

          return () => {
            tween.scrollTrigger?.kill();
            tween.kill();
            // The ground is shared state — hand it back the way we found it.
            if (ink) gsap.set(ink, { backgroundColor: "#0A0B0D" });
          };
        },
      );

      return () => mm.revert();
    },
    { scope: root, dependencies: [ready, w, h], revertOnUpdate: true },
  );

  return (
    <section ref={root} data-scene="net-worth" data-ground="ink" className="relative">
      <div
        data-nw-pin
        className="relative flex h-screen flex-col overflow-hidden px-5 sm:px-8 lg:px-12"
        style={{ color: "var(--text-primary)" }}
      >
        <div
          data-nw-bloom
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[80vw] -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(closest-side, rgba(201,162,39,0.20), rgba(201,162,39,0.05) 55%, transparent 78%)",
          }}
        />

        <div className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col pb-10 pt-[clamp(88px,12vh,116px)]">
          <div className="flex-none">
            <div
              className="mb-4 text-[11px] uppercase tracking-[0.18em]"
              style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
            >
              Net worth
            </div>
            <h2
              className="mb-2 max-w-[16ch] text-[clamp(1.9rem,4.2vw,3.3rem)] leading-[1.04] tracking-[-0.03em]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Watch your wealth grow.
            </h2>
            <p
              className="hidden max-w-[52ch] text-[14.5px] sm:block"
              style={{ color: "var(--text-secondary)" }}
            >
              Every holding, balance and liability rolls into one line. Scroll it forward.
            </p>
          </div>

          {/* The chart takes whatever height is left — never more. */}
          <div ref={box} className="relative mt-6 min-h-0 flex-1">
            {ready && (
              <svg
                viewBox={`0 0 ${w} ${h}`}
                width={w}
                height={h}
                className="absolute inset-0"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C9A227" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#C9A227" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {GRID.map((r) => (
                  <line
                    key={r}
                    x1="0"
                    y1={r * h}
                    x2={w}
                    y2={r * h}
                    stroke="var(--border-subtle)"
                    strokeWidth="1"
                  />
                ))}
                <path data-nw-fill fill="url(#nw-fill)" opacity="0" d={area} />
                <path
                  data-nw-line
                  d={curve}
                  fill="none"
                  stroke="var(--color-brass)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            )}

            {/*
              A zero-size anchor moved to the head of the stroke with a
              transform, in the same pixel space the path is drawn in. The dot
              is centred on it and the label hangs above, so the marker and the
              end of the line are the same point by construction.
            */}
            <div data-nw-head className="pointer-events-none absolute left-0 top-0 h-0 w-0">
              <span
                className="absolute left-0 top-0 block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  backgroundColor: "var(--color-brass)",
                  boxShadow: "0 0 18px 4px rgba(201,162,39,0.45)",
                }}
              />
              <div
                className="glass-panel absolute bottom-[16px] left-0 -translate-x-1/2 whitespace-nowrap px-4 py-2.5"
                style={{ borderColor: "rgba(201,162,39,0.3)" }}
              >
                <span className="currency">PKR</span>
                <span
                  data-nw-value
                  data-numeric
                  className="text-[clamp(16px,1.9vw,23px)] font-semibold tracking-[-0.02em]"
                >
                  1.00M
                </span>
              </div>
            </div>
          </div>

          <div
            className="mt-5 flex flex-none justify-between text-[10.5px] uppercase tracking-[0.13em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
          >
            {["2021", "2022", "2023", "2024", "2025", "2026"].map((y) => (
              <span key={y}>{y}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
