"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { signUp, type ActionState } from "@/app/(auth)/actions";

/** Sign up — form on the RIGHT, interactive panel on the left. */
export default function SignupPage() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signUp, {});

  return (
    <AuthShell
      eyebrow="Create your account"
      title="Start with one number."
      subtitle="Free while we're in early access. No card, and no broker credentials — ever."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="underline-offset-4 hover:underline" style={{ color: "var(--brass-text)" }}>
            Log in
          </Link>
        </>
      }
    >
      <form action={action} className="auth-form">
        <Field label="Full name" name="name" autoComplete="name" placeholder="Haris Khan" required />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          defaultValue={state.email}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          minLength={8}
          error={state.error}
          required
        />

        <label
          className="mt-1 flex cursor-pointer items-start gap-3 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          <input
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 flex-none rounded-[5px] accent-[var(--color-brass)]"
          />
          <span>
            I agree to the{" "}
            <Link href="#" className="underline underline-offset-4">Terms</Link> and{" "}
            <Link href="#" className="underline underline-offset-4">Privacy Policy</Link>.
          </span>
        </label>

        <Button
          type="submit"
          variant="primary"
          arrow
          className="mt-3 w-full justify-center"
          disabled={pending}
        >
          {pending ? "Sending code…" : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
