"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset, type ActionState } from "@/app/(auth)/actions";

/**
 * Forgot password — step one of two.
 *
 * Lives in the (split) group so it inherits the two-panel layout and the glide
 * animation; arriving here from Log in slides rather than cuts.
 */
export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <AuthShell
      eyebrow="Password reset"
      title="Let's get you back in."
      subtitle="Enter the email you signed up with and we'll send a six-digit code to reset your password."
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="underline-offset-4 hover:underline"
            style={{ color: "var(--brass-text)" }}
          >
            Back to log in
          </Link>
        </>
      }
    >
      <form action={action} className="auth-form">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state.email}
          error={state.error}
          required
          autoFocus
        />

        <Button
          type="submit"
          variant="primary"
          arrow
          className="mt-3 w-full justify-center"
          disabled={pending}
        >
          {pending ? "Sending code…" : "Send reset code"}
        </Button>

        <p className="mt-1 text-[12.5px]" style={{ color: "var(--text-faint)" }}>
          If an account exists for that address, a code is on its way. It expires in ten
          minutes.
        </p>
      </form>
    </AuthShell>
  );
}
