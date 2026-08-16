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

    /**
     * Delegated, not bound per element.
     *
     * The previous version queried every `a` and `button` once on mount and
     * attached listeners to that snapshot — so nothing rendered afterwards ever
     * grew the ring. On a page of dialogs, row menus and server-rendered lists
     * that is most of the interactive surface, and the effect silently applied
     * to a shrinking fraction of it.
     *
     * `mouseover`/`mouseout` bubble (`mouseenter`/`mouseleave` do not), so one
     * pair of listeners on the document covers everything, forever, including
     * elements that do not exist yet.
     */
    const SELECTOR = "a, button, [data-cursor-grow]";

    const onOver = (e: MouseEvent) => {
      const from = (e.relatedTarget as HTMLElement | null)?.closest?.(SELECTOR);
      const to = (e.target as HTMLElement).closest(SELECTOR);
      // Ignore movement between children of the same target.
      if (to && to !== from) grow();
    };

    const onOut = (e: MouseEvent) => {
      const from = (e.target as HTMLElement).closest(SELECTOR);
      const to = (e.relatedTarget as HTMLElement | null)?.closest?.(SELECTOR);
      if (from && to !== from) shrink();
    };

    /**
     * Follow the top layer.
     *
     * A <dialog> opened with showModal() is painted in the browser's TOP LAYER,
     * which sits above the whole normal DOM — z-index cannot reach it, at any
     * value. So while a modal is open the cursor has to live INSIDE it, or it is
     * simply occluded and the pointer vanishes.
     *
     * Both elements are `position: fixed`, so they still track the viewport
     * wherever they are parented, and fixed positioning is not clipped by an
     * ancestor's overflow — the cursor still moves across the backdrop and the
     * rest of the screen, not just the dialog's box.
     */
    const home = document.body;

    const reparent = () => {
      const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
      // The last open dialog is the topmost one, which is the one to sit above.
      const host: HTMLElement = dialogs.length ? dialogs[dialogs.length - 1] : home;

      // Only touch the DOM when it actually needs to change: this runs on every
      // mutation, and moving a node resets nothing but still costs layout.
      if (dotEl.parentElement !== host) host.appendChild(dotEl);
      if (ringEl.parentElement !== host) host.appendChild(ringEl);
    };

    // Modals mount and unmount their <dialog>, and `open` toggles on it, so both
    // kinds of change matter.
    const observer = new MutationObserver(reparent);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributeFilter: ["open"],
    });
    reparent();

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("mousemove", onMove);
    gsap.ticker.add(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      observer.disconnect();
      gsap.ticker.remove(tick);
      // Back where React expects them, or unmount will not find them.
      if (dotEl.parentElement !== home) home.appendChild(dotEl);
      if (ringEl.parentElement !== home) home.appendChild(ringEl);
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
