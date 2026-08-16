import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/**
 * 404.
 *
 * Offers both doors deliberately: someone who mistyped a dashboard URL wants to
 * get back to their money, and someone who followed a stale link from outside
 * wants to know what this site is.
 */
export default function NotFound() {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
    >
      <Logo href="/" text={20} />

      <p
        className="mt-12 text-[11px] uppercase tracking-[0.16em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
      >
        Error 404
      </p>

      <h1
        className="mt-4 text-[clamp(1.9rem,5vw,2.8rem)] leading-[1.1] tracking-[-0.03em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        This page doesn&rsquo;t exist
      </h1>

      <p className="mt-4 max-w-[440px] text-[14px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        The link may be out of date, or the address mistyped. Your account and
        everything in it are untouched.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="flex h-11 items-center rounded-full px-6 text-[14px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
          style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
        >
          Go to my dashboard
        </Link>
        <Link
          href="/"
          className="flex h-11 items-center rounded-full border px-6 text-[14px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
          style={{ borderColor: "var(--border-strong)", color: "var(--text-primary)" }}
        >
          About PakFinance
        </Link>
      </div>
    </main>
  );
}
