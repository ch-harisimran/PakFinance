import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client, reading the session from cookies.
 *
 * Use this in server components, route handlers and server actions whenever the
 * request acts *as the user* — it carries their JWT, so RLS applies and a
 * mistake cannot leak another user's rows.
 *
 * For jobs that must act as the system (the sync, the snapshot), use the
 * Drizzle client with the service-role connection instead; that bypasses RLS
 * deliberately and must never be reachable from a user request.
 */
export async function createClient(forwardCallerIdentity = false) {
  const cookieStore = await cookies();

  /**
   * Optionally pass the BROWSER's identity through to GoTrue.
   *
   * Sign-in happens inside a server action, so the request GoTrue sees comes
   * from the Vercel function — and it records that: `auth.sessions.user_agent`
   * ends up as "node" and the ip as Vercel's egress address. The "Signed-in
   * devices" list then shows every session as "Server or script" from an AWS
   * IP, which is useless for spotting one you do not recognise.
   *
   * Only the calls that CREATE a session need this, so it is opt-in rather than
   * the default — every other request would pay a `headers()` read for nothing.
   */
  let extra: Record<string, string> | undefined;
  if (forwardCallerIdentity) {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ua = h.get("user-agent");
    const ip = h.get("x-forwarded-for");
    extra = {
      ...(ua ? { "User-Agent": ua } : {}),
      ...(ip ? { "X-Forwarded-For": ip } : {}),
    };
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(extra ? { global: { headers: extra } } : {}),
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a server component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}

/** The signed-in user, or null. Never trust a client-supplied user id. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
