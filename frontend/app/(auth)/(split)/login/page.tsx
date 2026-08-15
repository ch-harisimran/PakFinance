"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

/**
 * Log in — form on the LEFT, interactive panel on the right. The mirror of
 * signup, so moving between them reads as the page turning over.
 */
export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    router.push("/verify?flow=login");
  };

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up where you left off."
      subtitle="We'll send a one-time code to your email to confirm it's you."
      footer={
        <>
          New to PakFinance?{" "}
          <Link href="/signup" className="underline-offset-4 hover:underline" style={{ color: "var(--brass-text)" }}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="auth-form">
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          required
        />

        <div className="flex items-center justify-between">
          <label
            className="flex cursor-pointer items-center gap-2.5 text-[13px]"
            style={{ color: "var(--text-muted)" }}
          >
            <input
              type="checkbox"
              className="h-4 w-4 rounded-[5px] accent-[var(--color-brass)]"
            />
            Keep me signed in
          </label>
          <Link
            href="#"
            className="text-[13px] underline-offset-4 hover:underline"
            style={{ color: "var(--brass-text)" }}
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" arrow className="mt-3 w-full justify-center" disabled={submitting}>
          {submitting ? "Sending code…" : "Log in"}
        </Button>
      </form>
    </AuthShell>
  );
}
