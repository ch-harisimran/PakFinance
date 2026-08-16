"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert, RotateCw } from "lucide-react";

/**
 * Dashboard error boundary.
 *
 * Scoped to /dashboard rather than the root so the sidebar and top bar survive a
 * failed panel — losing one screen should not look like losing the app.
 *
 * The message is deliberately vague about the cause and specific about the
 * user's data: someone whose finances just vanished from the screen needs to be
 * told immediately that nothing was lost, before anything else.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next strips messages from production errors and leaves a digest; logging
    // here is what makes the two ends meet when someone reports a problem.
    console.error("dashboard error:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="max-w-[440px] text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-[14px]"
          style={{ backgroundColor: "var(--surface-2)" }}
        >
          <TriangleAlert size={20} strokeWidth={1.7} color="var(--color-warning)" />
        </span>

        <h2
          className="mt-5 text-[20px] font-semibold tracking-[-0.02em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          This screen didn&rsquo;t load
        </h2>

        <p className="mt-2.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Something went wrong fetching your figures. Nothing you have entered is
          affected — this is a display problem, not a data one.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex h-10 items-center gap-2 rounded-[10px] px-4 text-[13px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
            style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
          >
            <RotateCw size={14} strokeWidth={2} />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="flex h-10 items-center rounded-[10px] border px-4 text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            Back to dashboard
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}>
            Reference {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
