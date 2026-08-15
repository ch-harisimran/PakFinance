"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * 8px brass dot with a 32px trailing ring. Expands over interactive elements.
 *
 * Both elements always render, hidden, and the effect reveals them only once it
 * has confirmed a fine pointer and taken over. No state: enabling is a DOM
 * concern, and routing it through React would cost a cascading render on mount
 * for something the user cannot perceive.
 *
 * `data-cursor="on"` (which hides the native cursor over links and buttons) is
 * set only when this is actually running — a failure here must never leave the
 * page cursorless.
 */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced || !dot.current || !ring.current) return;

    const dotEl = dot.current;
    const ringEl = ring.current;

    dotEl.style.display = "block";
    ringEl.style.display = "block";
    document.body.dataset.cursor = "on";

    const pos = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };

    const onMove = (e: MouseEvent) => {
      pos.x = e.clientX;
      pos.y = e.clientY;
      gsap.set(dotEl, { x: pos.x, y: pos.y });
    };

    const tick = () => {
      // The ring lerps toward the dot — the lag is the whole effect.
      ringPos.x += (pos.x - ringPos.x) * 0.15;
      ringPos.y += (pos.y - ringPos.y) * 0.15;
      gsap.set(ringEl, { x: ringPos.x, y: ringPos.y });
    };

    const grow = () =>
      gsap.to(ringEl, {
        width: 56,
        height: 56,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderColor: "rgba(201,162,39,0.5)",
        duration: 0.3,
        ease: "power3.out",
      });

    const shrink = () =>
      gsap.to(ringEl, {
        width: 32,
        height: 32,
        backgroundColor: "rgba(255,255,255,0)",
        borderColor: "rgba(201,162,39,0.35)",
        duration: 0.3,
        ease: "power3.out",
      });

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>("a, button, [data-cursor-grow]"),
    );
    targets.forEach((el) => {
      el.addEventListener("mouseenter", grow);
      el.addEventListener("mouseleave", shrink);
    });

    window.addEventListener("mousemove", onMove);
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      gsap.ticker.remove(tick);
      targets.forEach((el) => {
        el.removeEventListener("mouseenter", grow);
        el.removeEventListener("mouseleave", shrink);
      });
      dotEl.style.display = "none";
      ringEl.style.display = "none";
      delete document.body.dataset.cursor;
    };
  }, []);

  return (
    <>
      <div
        ref={dot}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[10000] h-2 w-2 rounded-full"
        style={{
          display: "none",
          backgroundColor: "var(--color-brass)",
          marginLeft: -4,
          marginTop: -4,
        }}
      />
      <div
        ref={ring}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[10000] h-8 w-8 rounded-full border"
        style={{
          display: "none",
          borderColor: "rgba(201,162,39,0.35)",
          marginLeft: -16,
          marginTop: -16,
        }}
      />
    </>
  );
}
