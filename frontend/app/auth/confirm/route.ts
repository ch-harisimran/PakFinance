import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase's confirmation links land.
 *
 * Used by the email-change flow: Supabase mails a link to both the old and the
 * new address, each carrying a `token_hash`, and the change only completes once
 * they are followed. Verifying the token here — rather than letting Supabase
 * redirect straight to the app — is what lets us set the session cookie on our
 * own origin and send the user somewhere useful afterwards.
 *
 * A GET that changes state is unusual, but the shape is dictated by what an
 * email client can do: a link, followed once, from a mail app.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  // Only ever an in-app path, never an absolute URL from the query string —
  // otherwise this is an open redirect with a valid session attached.
  const requested = url.searchParams.get("next") ?? "/dashboard/settings";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/dashboard/settings";

  if (!tokenHash || !type) {
    redirect(`${next}?confirm=invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  // The link is single-use and time-limited, so "invalid" usually means it was
  // already followed or has expired — the settings screen says as much.
  redirect(`${next}?confirm=${error ? "invalid" : "ok"}`);
}
