"use client";

import { useEffect, useRef } from "react";
import { GROUNDS, GROUND_HEX, GROUND_BLOOM, type Ground } from "@/lib/grounds";

/**
 * The fixed backdrop stack. One full-bleed div per ground, all stacked, only
 * one visible at a time.
 *
 * Two deliberate choices here, both learned the hard way:
 *
 * 1. The crossfade is CSS (`transition: opacity` + `data-active`). Driving it
 *    through a GSAP context meant the backdrop could be reverted by the
 *    context's own cleanup and left unpainted — a background is not something
 *    that may depend on an animation lifecycle.
 *
 * 2. The active ground is chosen by measuring section rects live on scroll,
 *    not by one cached ScrollTrigger per section. The pinned scenes insert
 *    pin-spacers *after* this component mounts, shifting every position below
 *    them; cached start/end values then fire hundreds of pixels late. That is
 *    how Goals ended up scoped to `paper` tokens over a dark ground.
 */
export function GroundLayer() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;

    const layers = new Map<Ground, HTMLElement>();
    GROUNDS.forEach((g) => {
      const el = host.querySelector<HTMLElement>(`[data-ground-layer="${g}"]`);
      if (el) layers.set(g, el);
    });

    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-scene]"));
    if (!sections.length) return;

    let current: Ground | null = null;

    const apply = (g: Ground) => {
      layers.forEach((el, key) => {
        el.dataset.active = String(key === g);
      });
    };

    /**
     * A scene may take temporary control of the backdrop by setting
     * `data-ground-override` on its own section — that is how scene 02 lands
     * the ink→slate turn on the exact frame its cards merge, rather than at the
     * section boundary.
     */
    const groundOf = (s: HTMLElement) =>
      ((s.dataset.groundOverride || s.dataset.ground) as Ground) ?? "ink";

    const pick = () => {
      const mid = window.innerHeight * 0.5;
      let found: Ground | null = null;

      for (const section of sections) {
        const r = section.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) {
          found = groundOf(section);
          break;
        }
      }

      // In a gap, or above the first section: hold the last one entered.
      if (!found) {
        for (const section of sections) {
          if (section.getBoundingClientRect().top <= mid) {
            found = groundOf(section);
          }
        }
      }

      if (!found || found === current) return;
      current = found;
      apply(found);
    };

    // Paint before arming transitions, so load doesn't fade in from black.
    host.dataset.armed = "false";
    pick();
    const arm = requestAnimationFrame(() => {
      host.dataset.armed = "true";
    });

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        pick();
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      cancelAnimationFrame(arm);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div ref={root} className="ground-layer" data-armed="false" aria-hidden="true">
      {GROUNDS.map((g) => (
        <div key={g} data-ground-layer={g} style={{ backgroundColor: GROUND_HEX[g] }}>
          <div className="absolute inset-0" style={{ backgroundImage: GROUND_BLOOM[g] }} />
        </div>
      ))}
    </div>
  );
}
