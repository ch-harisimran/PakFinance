"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";

/**
 * Pulls its child toward the pointer within a radius, springs back on leave.
 * Disabled on coarse pointers — there is nothing to be magnetic toward.
 */
export function Magnetic({
  children,
  radius = 90,
  strength = 8,
  className,
}: {
  children: ReactNode;
  radius?: number;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;

    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius + Math.max(r.width, r.height) / 2) return;

    const pull = Math.min(1, dist / radius);
    gsap.to(el, {
      x: (dx / (dist || 1)) * strength * pull,
      y: (dy / (dist || 1)) * strength * pull,
      duration: 0.4,
      ease: "power3.out",
    });
  };

  const onLeave = () => {
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
  };

  return (
    <span
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ display: "inline-flex" }}
    >
      {children}
    </span>
  );
}
