import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";
import type { Ground } from "@/lib/grounds";

/**
 * Every scene is a Section. `data-scene` + `data-ground` are what GroundLayer
 * reads to drive the backdrop handoff — a scene never needs to know what came
 * before it.
 */
export function Section({
  id,
  scene,
  ground,
  children,
  className = "",
  wide = false,
}: {
  id?: string;
  scene: string;
  ground: Ground;
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <section
      id={id}
      data-scene={scene}
      data-ground={ground}
      className={`section-shell relative ${className}`}
      // `body` sets `color`, so without this every element that inherits its
      // colour would keep the root (dark-ground) value even inside a section
      // scoped to `paper` — while any element using var(--text-primary)
      // directly would resolve the paper value. Half the text ends up inverted.
      style={{ color: "var(--text-primary)" }}
    >
      <div className={wide ? "mx-auto max-w-[1440px]" : "content-width"}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      className="mb-6 text-[11px] uppercase tracking-[0.18em]"
      style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
    >
      {children}
    </div>
  );
}

export function Headline({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={`max-w-[17ch] text-[clamp(2.1rem,4.4vw,3.6rem)] font-normal leading-[1.04] tracking-[-0.025em] ${className}`}
      style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
    >
      {children}
    </h2>
  );
}

export function Lede({ children }: { children: ReactNode }) {
  return (
    <p
      className="mt-6 max-w-[52ch] text-[clamp(15px,1.2vw,17.5px)] leading-relaxed"
      style={{ color: "var(--text-secondary)" }}
    >
      {children}
    </p>
  );
}

/** Eyebrow + headline + optional lede, revealed as one block. */
export function SectionHead({
  eyebrow,
  headline,
  lede,
  className = "",
}: {
  eyebrow: string;
  headline: ReactNode;
  lede?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Headline>{headline}</Headline>
      {lede && <Lede>{lede}</Lede>}
    </Reveal>
  );
}
