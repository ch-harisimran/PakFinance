import type { ReactNode } from "react";

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
