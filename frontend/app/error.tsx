"use client";

import { useEffect } from "react";

/**
 * Root error boundary.
 *
 * The last net, for failures outside /dashboard — the marketing pages and the
 * auth flow. It cannot rely on the dashboard chrome existing, so it paints its
 * own ground and keeps to plain elements.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app error:", error.digest ?? error.message);
  }, [error]);

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
    >
      <p
        className="text-[11px] uppercase tracking-[0.16em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
      >
        Something went wrong
      </p>

      <h1
        className="mt-4 text-[clamp(1.7rem,4.5vw,2.4rem)] leading-[1.15] tracking-[-0.03em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        We couldn&rsquo;t load that
      </h1>

      <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        The problem is on our side, not with your account. Nothing you have saved
        is affected.
      </p>

      <button
        onClick={reset}
        className="mt-8 flex h-11 items-center rounded-full px-6 text-[14px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
        style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
      >
        Try again
      </button>

      {error.digest && (
        <p className="mt-8 text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
          Reference {error.digest}
        </p>
      )}
    </main>
  );
}
