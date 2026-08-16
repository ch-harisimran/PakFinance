"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { OtpOrbit } from "@/components/auth/OtpOrbit";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { verifyRecovery, setNewPassword, type ActionState } from "@/app/(auth)/actions";
import { submitting } from "@/lib/form";

/**
 * Password reset — step two.
 *
 * Two stages on one route rather than two pages: verifying the code creates a
 * recovery session, and navigating between pages while holding that session is
 * exactly the moment the middleware would bounce a now-signed-in user to the
 * dashboard, stranding them with the old password.
 *
 * Note this route is deliberately excluded from the middleware's AUTH_ROUTES
 * for the same reason.
 */
function Reset() {
  const email = useSearchParams().get("email") ?? "";
  const [verified, setVerified] = useState(false);
  const [state, save, saving] = useActionState<ActionState, FormData>(setNewPassword, {});

  async function check(code: string) {
    const form = new FormData();
    form.set("email", email);
    form.set("token", code);
    const result = await verifyRecovery({}, form);
    if (result?.ok) {
      setVerified(true);
      return true;
    }
    return false;
  }

  return (
    <div className="w-full max-w-[440px] text-center">
      <Logo href="/" className="mb-12 inline-flex justify-center" />

      <div
        className="mb-4 text-[11px] uppercase tracking-[0.18em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
      >
        {verified ? "Choose a new password" : "Check your email"}
      </div>
      <h1
        className="mb-3 text-[clamp(1.9rem,3vw,2.5rem)] leading-[1.06] tracking-[-0.025em]"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {verified ? "Almost there." : "Enter your code."}
      </h1>

      {!verified ? (
        <>
          <p className="mb-6 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
            {email ? (
              <>
                We sent a six-digit code to{" "}
                <span style={{ color: "var(--text-primary)" }}>{email}</span>. It expires in ten
                minutes.
              </>
            ) : (
              "Enter the six-digit code we emailed you."
            )}
          </p>

          <OtpOrbit onVerified={() => setVerified(true)} verify={check} />

          <p className="mt-4 text-[13px]" style={{ color: "var(--text-faint)" }}>
            Wrong address?{" "}
            <Link
              href="/forgot-password"
              className="underline underline-offset-4"
              style={{ color: "var(--brass-text)" }}
            >
              Start again
            </Link>
          </p>
        </>
      ) : (
        <>
          <p className="mb-8 text-[14.5px]" style={{ color: "var(--text-muted)" }}>
            Pick something you haven&rsquo;t used here before.
          </p>

          <form onSubmit={submitting(save)} className="flex flex-col gap-4 text-left">
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoFocus
            />
            <Field
              label="Confirm new password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat it"
              error={state.error}
              required
            />
            <Button
              type="submit"
              variant="primary"
              arrow
              className="mt-3 w-full justify-center"
              disabled={saving}
            >
              {saving ? "Saving…" : "Set password and continue"}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <Suspense fallback={<div className="h-[520px]" />}>
        <Reset />
      </Suspense>
    </div>
  );
}
