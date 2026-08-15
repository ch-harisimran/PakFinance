"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * OTP verification — supplied design.
 *
 * Sequence:
 *   line    four boxes on a straight line; each entry advances the caret and
 *           leaves a white border glow on the box just filled, which closes as
 *           the next digit lands
 *   gather  on the fourth digit the line pulls into a ring around the hub
 *   spin    the ring turns
 *   ok      boxes go green, collapse onto the hub, and resolve into one tick
 *   bad     boxes go red, hub shakes, entry resets
 *
 * The supplied rotation mechanic, preserved: never sample the curve — move the
 * transform origin onto the hub and let a plain rotate() trace the exact circle
 * from two keyframes.
 *
 *     slot.style.transformOrigin = `${hubX}px ${hubY}px`;
 *     slot.animate([
 *       { transform: `rotate(0deg)   translate(${dx}px,${dy}px)` },
 *       { transform: `rotate(450deg) translate(${dx}px,${dy}px)` },
 *     ], { duration: 800, easing: WIND_UP_BRAKE });
 *
 * Every transform below is written as `rotate() translate()` — the same
 * function list in the same order, including the line phase — so the browser
 * interpolates component-wise instead of falling back to matrix decomposition,
 * which would make the boxes arc oddly on the way into the ring.
 */

const SLOTS = 4;
const TURN = 450;
const WIND_UP_BRAKE = "cubic-bezier(0.7, 0, 0.15, 1)";
const RING_VB = 120;
const RING_R = 50;
const LINE_GAP = 78;

type Phase = "line" | "gather" | "spin" | "ok" | "bad";

const rest = (deg: number, dx: number, dy: number) =>
  `rotate(${deg}deg) translate(${dx}px,${dy}px)`;

const reduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Promise-wrapped WAAPI. Under reduced motion it snaps to the final keyframe
 *  so the sequence still advances and resolves. */
const run = (el: Element, frames: Keyframe[], options: KeyframeAnimationOptions) =>
  new Promise<void>((resolve) => {
    if (reduced()) {
      Object.assign((el as HTMLElement).style, frames[frames.length - 1] as object);
      resolve();
      return;
    }
    const a = el.animate(frames, options);
    a.onfinish = () => resolve();
    a.oncancel = () => resolve();
  });

export function OtpOrbit({
  onVerified,
  verify,
}: {
  onVerified: () => void;
  /** Swap in the real call when the backend lands. */
  verify?: (code: string) => Promise<boolean>;
}) {
  const orbitRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLSpanElement>(null);
  const slotRefs = useRef<(HTMLLabelElement | null)[]>([]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const busy = useRef(false);

  const [digits, setDigits] = useState<string[]>(Array(SLOTS).fill(""));
  const [active, setActive] = useState(0);
  const [glow, setGlow] = useState(-1);
  const [phase, setPhase] = useState<Phase>("line");
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = orbitRef.current;
    if (!el) return;
    const measure = () => setSize(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const t = setTimeout(measure, 0);
    return () => {
      clearTimeout(t);
      ro.disconnect();
    };
  }, []);

  /** Resting offset from the hub for the straight line. */
  const linePos = useCallback((i: number) => {
    const gap = Math.min(LINE_GAP, Math.max(60, LINE_GAP));
    return { dx: (i - (SLOTS - 1) / 2) * gap, dy: 0 };
  }, []);

  /** Seat on the ring. Seats run anticlockwise so a +90° net turn advances. */
  const seatPos = useCallback(
    (i: number) => {
      const r = (RING_R / RING_VB) * size;
      const theta = ((-90 - i * (360 / SLOTS)) * Math.PI) / 180;
      return { dx: r * Math.cos(theta), dy: r * Math.sin(theta) };
    },
    [size],
  );

  /** Put every transform origin on the hub and park the boxes on the line. */
  const layout = useCallback(() => {
    const hub = hubRef.current;
    if (!hub || !size) return;
    const h = hub.getBoundingClientRect();
    const hubCx = h.left + h.width / 2;
    const hubCy = h.top + h.height / 2;

    slotRefs.current.forEach((slot, i) => {
      if (!slot) return;
      const s = slot.getBoundingClientRect();
      const hubX = hubCx - s.left;
      const hubY = hubCy - s.top;
      slot.style.transformOrigin = `${hubX}px ${hubY}px`;
      if (phase === "line") {
        const { dx, dy } = linePos(i);
        slot.style.transform = rest(0, dx, dy);
      }
    });
  }, [linePos, phase, size]);

  useEffect(() => {
    layout();
  }, [layout]);

  /** Line → ring. */
  const gather = useCallback(async () => {
    setPhase("gather");
    await Promise.all(
      slotRefs.current.map((slot, i) => {
        if (!slot) return Promise.resolve();
        const from = linePos(i);
        const to = seatPos(i);
        const end = rest(0, to.dx, to.dy);
        return run(
          slot,
          [{ transform: rest(0, from.dx, from.dy) }, { transform: end }],
          { duration: 620, easing: WIND_UP_BRAKE, fill: "forwards" },
        );
      }),
    );
  }, [linePos, seatPos]);

  /** One wind-up turn plus a seat — the supplied 0 → 450 call, verbatim. */
  const spin = useCallback(async () => {
    setPhase("spin");
    await Promise.all(
      slotRefs.current.map((slot, i) => {
        if (!slot) return Promise.resolve();
        const { dx, dy } = seatPos(i);
        return run(
          slot,
          [{ transform: rest(0, dx, dy) }, { transform: rest(TURN, dx, dy) }],
          { duration: 800, easing: WIND_UP_BRAKE, fill: "forwards" },
        );
      }),
    );
  }, [seatPos]);

  /** The four collapse onto the hub and hand over to the tick. */
  const collapse = useCallback(async () => {
    await Promise.all(
      slotRefs.current.map((slot, i) => {
        if (!slot) return Promise.resolve();
        const { dx, dy } = seatPos(i);
        return run(
          slot,
          [
            { transform: rest(TURN, dx, dy), opacity: 1 },
            { transform: rest(TURN, 0, 0), opacity: 0 },
          ],
          { duration: 560, easing: WIND_UP_BRAKE, fill: "forwards" },
        );
      }),
    );
  }, [seatPos]);

  const resetToLine = useCallback(() => {
    slotRefs.current.forEach((slot, i) => {
      if (!slot) return;
      slot.getAnimations().forEach((a) => a.cancel());
      const { dx, dy } = linePos(i);
      slot.style.transform = rest(0, dx, dy);
      slot.style.opacity = "1";
    });
    setDigits(Array(SLOTS).fill(""));
    setActive(0);
    setGlow(-1);
    setPhase("line");
    busy.current = false;
    inputRefs.current[0]?.focus();
  }, [linePos]);

  const submit = useCallback(
    async (code: string) => {
      await gather();
      await spin();

      const ok = verify ? await verify(code) : true;

      if (!ok) {
        setPhase("bad");
        setTimeout(resetToLine, 1100);
        return;
      }

      setPhase("ok");
      await collapse();
      setTimeout(onVerified, 1250);
    },
    [collapse, gather, onVerified, resetToLine, spin, verify],
  );

  const put = (i: number, raw: string) => {
    if (busy.current || phase !== "line") return;
    const v = raw.replace(/\D/g, "");
    if (!v) return;

    // A pasted code fans out across the remaining slots.
    const chars = v.slice(0, SLOTS - i).split("");
    const next = [...digits];
    chars.forEach((c, k) => (next[i + k] = c));
    setDigits(next);

    // The glow marks the digit just entered, and closes when the next lands.
    setGlow(i + chars.length - 1);

    if (next.every(Boolean)) {
      busy.current = true;
      setActive(-1);
      inputRefs.current[SLOTS - 1]?.blur();
      submit(next.join(""));
      return;
    }

    const nextIndex = Math.min(i + chars.length, SLOTS - 1);
    setActive(nextIndex);
    inputRefs.current[nextIndex]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace" || busy.current || phase !== "line") return;
    e.preventDefault();
    const target = digits[i] ? i : Math.max(0, i - 1);
    setDigits((prev) => prev.map((d, idx) => (idx === target ? "" : d)));
    setActive(target);
    setGlow(target - 1);
    inputRefs.current[target]?.focus();
  };

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div
        ref={orbitRef}
        className="orbit aspect-square w-full max-w-[330px]"
        data-phase={phase}
      >
        <svg className="orbit__ring" viewBox={`0 0 ${RING_VB} ${RING_VB}`} aria-hidden="true">
          <circle
            className="orbit__path"
            cx={RING_VB / 2}
            cy={RING_VB / 2}
            r={RING_R}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <span ref={hubRef} className="orbit__hub" aria-hidden="true" />

        {Array.from({ length: SLOTS }).map((_, i) => (
          <label
            key={i}
            ref={(el) => {
              slotRefs.current[i] = el;
            }}
            className="slot"
            data-live={active === i && phase === "line"}
            data-glow={glow === i && phase === "line"}
            data-filled={!!digits[i]}
          >
            <input
              ref={(el) => {
                inputRefs.current[i] = el;
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={digits[i]}
              onChange={(e) => put(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onFocus={() => phase === "line" && setActive(i)}
              maxLength={SLOTS}
              aria-label={`Digit ${i + 1} of ${SLOTS}`}
            />
          </label>
        ))}

        <div className="orbit__seal" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5 L10 17.5 L19 7"
              stroke="var(--ok)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <div className="h-8" role="status" aria-live="polite">
        <p
          className="text-[14.5px] font-medium transition-opacity duration-500"
          style={{
            color: phase === "ok" ? "var(--color-gain)" : "var(--color-loss)",
            opacity: phase === "ok" || phase === "bad" ? 1 : 0,
          }}
        >
          {phase === "ok"
            ? "OTP verified"
            : phase === "bad"
              ? "That code didn't match. Try again."
              : ""}
        </p>
      </div>
    </div>
  );
}
