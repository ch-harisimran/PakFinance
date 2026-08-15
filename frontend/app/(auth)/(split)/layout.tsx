"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { AuthAside } from "@/components/auth/AuthAside";

/**
 * Shared split layout for /login and /signup. This layout persists across both
 * routes, which is what makes the swap animatable at all.
 *
 * Why this is built on transforms rather than Framer's `layout` prop:
 *
 * `layout` works by measuring an element before and after a DOM change and
 * animating the delta — it re-reads geometry every frame and writes transforms
 * to compensate. On two full-height columns holding this much content (and with
 * the login panel's price ticker re-rendering on an interval underneath), that
 * measurement fights the browser's own reflow and reads as a jerk.
 *
 * Here the columns never change position in layout at all. Both are absolutely
 * placed at the left half and moved with `translateX`, which the compositor can
 * run without touching layout or paint. The slide is a single GPU property.
 *
 * The transform is applied through a CSS custom property so it can be scoped to
 * the `lg` breakpoint — below that there is no split, and an inline transform
 * would shove the form off-screen.
 */

// Expo-out, matching --ease-out in the design system. A long, controlled glide
// reads more expensive than a spring, which always ends with a small wobble.
const GLIDE = { duration: 0.78, ease: [0.16, 1, 0.3, 1] as const };

export default function SplitLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const formLeft = pathname.startsWith("/login");

  return (
    <div className="split-shell">
      <motion.div
        className="split-panel"
        initial={false}
        animate={{ "--x": formLeft ? "0%" : "100%" } as never}
        transition={GLIDE}
      >
        <div className="auth-column px-6 sm:px-12 lg:px-16 xl:px-24">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.22 }}
            className="mx-auto w-full max-w-[400px]"
          >
            {children}
          </motion.div>
        </div>
      </motion.div>

      <motion.div
        className="split-panel split-panel--aside"
        initial={false}
        animate={{ "--x": formLeft ? "100%" : "0%" } as never}
        transition={GLIDE}
      >
        {/*
          Both panels stay mounted and crossfade. Swapping the component on
          `variant` would unmount one and mount the other mid-slide, and the
          content popping in is most of what made the old version feel cheap.
        */}
        <AuthAside variant="login" show={formLeft} />
        <AuthAside variant="signup" show={!formLeft} />
      </motion.div>
    </div>
  );
}
