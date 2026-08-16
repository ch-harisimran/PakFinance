"use client";

import { Suspense } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { signIn, type ActionState } from "@/app/(auth)/actions";
import { submitting } from "@/lib/form";

/**
 * Log in — form on the LEFT, interactive panel on the right.
 *
 * No OTP step here. Supabase cannot issue email OTP as a second factor on every
 * login, and for returning users the PIN unlock is the fast path instead.
 */
function LoginForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(signIn, {});
  const next = useSearchParams().get("next") ?? "/dashboard";

  return (
    <form onSubmit={submitting(action)} className="auth-form">
      <input type="hidden" name="next" value={next} />

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
        autoComplete="current-password"
        placeholder="Your password"
        error={state.error}
        required
      />

      <div className="flex items-center justify-between">
        <label
          className="flex cursor-pointer items-center gap-2.5 text-[13px]"
          style={{ color: "var(--text-muted)" }}
        >
          <input
            type="checkbox"
            name="remember"
            value="1"
            className="h-4 w-4 rounded-[5px] accent-[var(--color-brass)]"
          />
          Keep me signed in
        </label>
        <Link
          href="/forgot-password"
          className="text-[13px] underline-offset-4 hover:underline"
          style={{ color: "var(--brass-text)" }}
        >
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        variant="primary"
        arrow
        className="mt-3 w-full justify-center"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Log in"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up where you left off."
      subtitle="Your portfolio has been keeping score while you were away."
      footer={
        <>
          New to PakFinance?{" "}
          <Link href="/signup" className="underline-offset-4 hover:underline" style={{ color: "var(--brass-text)" }}>
            Create an account
          </Link>
        </>
      }
    >
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={<div className="h-[300px]" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
