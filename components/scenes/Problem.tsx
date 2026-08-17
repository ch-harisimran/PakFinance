"use client";

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { LineChart, PiggyBank, Landmark, Receipt, Target } from "lucide-react";

/**
 * Scene 02 — the scattered financial life converging into one view.
 *
 * The ground crossfade (ink → slate) is driven by *this* scene's scrub rather
 * than by GroundLayer's section trigger, so the backdrop change lands exactly
 * on the merge. The backdrop then reads as caused by the convergence instead of
 * as an unrelated section boundary. The section itself declares `ink`, and the
 * next scene declares `slate`, so GroundLayer's own state stays consistent
 * whichever direction the user scrolls.
 */

const SCATTERED = [
  { label: "PSX portfolio", value: "Rs 1.65M", Icon: LineChart, x: -320, y: -150, r: -13 },
  { label: "Mutual funds", value: "NAV 78.42", Icon: PiggyBank, x: 300, y: -190, r: 11 },
  { label: "Bank account", value: "Rs 900K", Icon: Landmark, x: -360, y: 130, r: 8 },
  { label: "Car loan", value: "Rs 1.25M", Icon: Receipt, x: 330, y: 145, r: -9 },
  { label: "Emergency fund", value: "70%", Icon: Target, x: 30, y: 225, r: 5 },
];

export function Problem() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          desktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
          reduced: "(max-width: 767px), (prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { reduced } = ctx.conditions as { desktop: boolean; reduced: boolean };
          const cards = gsap.utils.toArray<HTMLElement>("[data-scatter]");

          if (reduced) {
            // No pin, no scatter: the cards simply sit in a readable stack and
            // the closing headline is always present.
            gsap.set(cards, { x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 });
            gsap.set("[data-merge-in]", { opacity: 1 });
            gsap.set("[data-merge-out]", { opacity: 0 });
            return;
          }

          cards.forEach((card) => {
            gsap.set(card, {
              x: Number(card.dataset.x),
              y: Number(card.dataset.y),
              rotate: Number(card.dataset.r),
              opacity: 0.55,
            });
          });

          const section = root.current;

          const tl = gsap.timeline({
            scrollTrigger: {
              trigger: section,
              start: "top top",
              end: "+=180%",
              pin: "[data-pin]",
              scrub: 1,
              // Hand the backdrop over as the cards close on centre, so the
              // ground turning over reads as *caused by* the merge. GroundLayer
              // owns the actual crossfade; this only declares intent.
              onUpdate: ({ progress }) => {
                if (!section) return;
                if (progress >= 0.6) section.dataset.groundOverride = "slate";
                else delete section.dataset.groundOverride;
              },
            },
          });

          // 0 → 0.75 : the drift inward.
          tl.to(
            cards,
            { x: 0, y: 0, rotate: 0, opacity: 1, scale: 0.92, ease: "power2.inOut", duration: 0.75 },
            0,
          )
            // 0.75 → 1 : stack dissolves, unified view resolves.
            .to(cards, { opacity: 0, scale: 0.8, duration: 0.25 }, 0.75)
            .to("[data-merge-out]", { opacity: 0, y: -20, duration: 0.2 }, 0.72)
            .fromTo(
              "[data-merge-in]",
              { opacity: 0, scale: 0.94, y: 20 },
              { opacity: 1, scale: 1, y: 0, duration: 0.25 },
              0.78,
            );

          return () => {
            tl.scrollTrigger?.kill();
            tl.kill();
            if (section) delete section.dataset.groundOverride;
          };
        },
      );

      return () => mm.revert();
    },
    { scope: root },
  );

  return (
    <section ref={root} data-scene="problem" data-ground="ink" className="relative">
      <div
        data-pin
        className="flex min-h-screen flex-col items-center justify-center px-5 py-24 sm:px-8"
      >
        <div data-merge-out className="relative z-10 text-center">
          <div
            className="mb-6 text-[11px] uppercase tracking-[0.18em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
          >
            The problem
          </div>
          <h2
            className="mx-auto max-w-[16ch] text-[clamp(2.1rem,4.8vw,3.8rem)] leading-[1.04] tracking-[-0.025em]"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Your money shouldn&rsquo;t be scattered everywhere.
          </h2>
        </div>

        {/* The scattered cards */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {SCATTERED.map((c) => (
            <div
              key={c.label}
              data-scatter
              data-x={c.x}
              data-y={c.y}
              data-r={c.r}
              className="glass-panel absolute flex w-[194px] items-center gap-3 px-4 py-3 max-md:relative max-md:mx-1 max-md:my-1 max-md:w-[164px]"
            >
              <div
                className="grid h-8 w-8 flex-none place-items-center rounded-[9px]"
                style={{ backgroundColor: "var(--surface-2)" }}
              >
                <c.Icon size={15} strokeWidth={1.75} color="var(--brass-text)" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {c.label}
                </div>
                <div className="text-[14px] font-semibold tracking-[-0.01em]" data-numeric>
                  {c.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* What they become */}
        <div
          data-merge-in
          className="absolute inset-x-0 flex flex-col items-center px-5 text-center opacity-0"
        >
          <div
            className="mb-6 text-[11px] uppercase tracking-[0.18em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
          >
            One place
          </div>
          <h2
            className="mx-auto max-w-[14ch] text-[clamp(2.1rem,4.8vw,3.8rem)] leading-[1.04] tracking-[-0.025em]"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Everything, finally in one view.
          </h2>
          <div
            className="glass-panel mt-10 w-full max-w-[420px] px-6 py-5 text-left"
            style={{ boxShadow: "var(--highlight-top), 0 40px 90px -30px rgba(0,0,0,0.85)" }}
          >
            <div className="mb-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Net worth
            </div>
            <div className="flex items-baseline text-[32px] font-semibold leading-none tracking-[-0.025em]">
              <span className="currency">PKR</span>
              <span data-numeric>2,450,000</span>
            </div>
            <div
              className="mt-4 grid grid-cols-4 gap-2 border-t pt-4 text-[10px] uppercase tracking-[0.1em]"
              style={{ borderColor: "var(--border-subtle)", fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
            >
              <span>Stocks</span>
              <span>Funds</span>
              <span>Bank</span>
              <span>Loans</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
