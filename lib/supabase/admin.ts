import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. READ THIS BEFORE USING IT.
 *
 * This key bypasses Row Level Security entirely and can act as any user. It is
 * the one credential in the project that, if it ever reached a browser, would
 * expose every user's finances at once. Hence:
 *
 *   - `server-only` above, so importing it from a client component is a build
 *     error rather than a breach.
 *   - Read from SUPABASE_SERVICE_ROLE_KEY, never a NEXT_PUBLIC_ variable.
 *   - No session persistence: this client must never pick up, refresh or write
 *     the cookies of whoever happens to be signed in.
 *
 * Use it ONLY for operations the Auth admin API requires and a user-scoped
 * client genuinely cannot do. Today that is exactly one thing: deleting an
 * account. Everything else in the app goes through lib/supabase/server.ts as
 * the user, with RLS applying.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — account deletion needs the Auth admin API.",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
