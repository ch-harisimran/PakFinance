import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/**
 * Legal pages.
 *
 * Their own route group with a plain layout: no scroll choreography, no
 * animation, generous measure. Someone reading a privacy policy is doing work,
 * and the page should get out of the way.
 */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
    >
      <header
        className="border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="mx-auto flex max-w-[760px] items-center justify-between px-6 py-5">
          <Logo href="/" text={18} />
          <Link
            href="/"
            className="text-[13px] transition-colors duration-200 hover:text-[var(--text-primary)]"
            style={{ color: "var(--text-muted)" }}
          >
            Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-6 py-14 pb-24">{children}</main>
    </div>
  );
}
