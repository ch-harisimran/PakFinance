"use client";

import { useRouter } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { OtpOrbit } from "@/components/auth/OtpOrbit";

/**
 * OTP verification. The orbit handles entry and its own success/failure
 * choreography; this page is only the frame around it.
 *
 * No backend yet, so `verify` is omitted and every code passes. When the API
 * lands, pass `verify={async (code) => (await postOtp(code)).ok}` — the failure
 * path (red ring, hub shake, reset) is already wired.
 */
export default function VerifyPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-[440px] text-center">
        <Logo href="/" className="mb-12 inline-flex justify-center" />

        <div
          className="mb-4 text-[11px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
        >
          Verify your email
        </div>
        <h1
          className="mb-3 text-[clamp(1.9rem,3vw,2.5rem)] leading-[1.06] tracking-[-0.025em]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Enter your code.
        </h1>
        <p className="mb-6 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
          We sent a four-digit code to your email. It expires in ten minutes.
        </p>

        <OtpOrbit onVerified={() => router.push("/dashboard")} />

        <p className="mt-4 text-[13px]" style={{ color: "var(--text-faint)" }}>
          Didn&rsquo;t get it?{" "}
          <button className="underline underline-offset-4" style={{ color: "var(--brass-text)" }}>
            Resend in 60s
          </button>
        </p>
      </div>
    </div>
  );
}
