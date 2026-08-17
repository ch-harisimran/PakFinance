import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Titles for these routes are set by a `layout.tsx` in each folder rather than
 * the page, because every auth page is a client component and Next.js only
 * reads `metadata` from server ones. The template and the noindex live here so
 * those files stay one line each.
 */
export const metadata: Metadata = {
  title: { template: "%s · PakFinance", default: "Sign in · PakFinance" },
  robots: { index: false, follow: false },
};

/**
 * Auth surfaces are a single view — no smooth scroll, no ground layer, no
 * marketing nav. Just the ink ground and the content.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
    >
      {children}
    </main>
  );
}
