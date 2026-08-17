"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { OtpOrbit } from "@/components/auth/OtpOrbit";
import { verifyOtp, resendOtp, type ActionState } from "@/app/(auth)/actions";

/**
 * OTP verification.
 *
 * The orbit owns entry and its own success/failure choreography; this page is
 * the frame plus the server round-trip. `verify` is handed to the orbit so a
 * wrong code drives the red state rather than a page-level error message.
 */
function Verify() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [, resend, resending] = useActionState<ActionState, FormData>(resendOtp, {});
  const [failed, setFailed] = useState(false);

  async function check(code: string) {
    const form = new FormData();
    form.set("email", email);
    form.set("token", code);
    // A successful verify redirects, so this only returns on failure.
    const result = await verifyOtp({}, form);
    setFailed(Boolean(result?.error));
    return !result?.error;
  }

  return (
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
        {email ? (
          <>
            We sent a six-digit code to{" "}
            <span style={{ color: "var(--text-primary)" }}>{email}</span>. It expires in ten
            minutes.
          </>
        ) : (
          "Enter the six-digit code we emailed you. It expires in ten minutes."
        )}
      </p>

      <OtpOrbit onVerified={() => {}} verify={check} />

      <form action={resend}>
        <input type="hidden" name="email" value={email} />
        {/* Spam first, resending second: the code is usually already delivered,
            just filtered, and another one only invalidates the first. */}
        <p className="mt-4 text-[13px]" style={{ color: "var(--text-faint)" }}>
          Didn&rsquo;t get it? Check your spam or junk folder, or{" "}
          <button
            type="submit"
            disabled={resending}
            className="underline underline-offset-4 disabled:opacity-50"
            style={{ color: "var(--brass-text)" }}
          >
            {resending ? "Sending…" : "resend the code"}
          </button>
        </p>
      </form>

      {failed && (
        <p className="mt-3 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
          Codes are single-use — if you requested a new one, use the latest email.
        </p>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <Suspense fallback={<div className="h-[520px]" />}>
        <Verify />
      </Suspense>
    </div>
  );
}
