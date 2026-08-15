"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";

/**
 * Rotates its child toward the pointer. Used for the hero deck and, later,
 * every hoverable financial card.
 *
 * The rotation is applied to a wrapper rather than the card itself so a card's
 * own entrance tween can own its transform without the two fighting.
 */
export function Tilt({
  children,
  max = 6,
  className,
  style,
}: {
  children: ReactNode;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || window.matchMedia("(pointer: coarse)").matches) return;

    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;

    gsap.to(el, {
      rotateY: px * max * 2,
      rotateX: -py * max * 2,
      duration: 0.7,
      ease: "power3.out",
      transformPerspective: 1200,
    });
  };

  const onLeave = () => {
    gsap.to(ref.current, { rotateX: 0, rotateY: 0, duration: 1, ease: "power3.out" });
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ transformStyle: "preserve-3d", ...style }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
    </div>
  );
}
