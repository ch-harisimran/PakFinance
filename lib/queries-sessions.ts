import "server-only";

import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Active sessions.
 *
 * `auth.sessions` is not exposed through PostgREST — the client library only
 * ever knows about its own session — so this reads it with Drizzle, whose role
 * carries BYPASSRLS. Every query is scoped to the verified user id from the
 * session cookie; a caller-supplied id is never trusted.
 *
 * Supabase records `user_agent` and `ip` per session, which is enough to answer
 * the only question that matters here: is there a device signed in that I do not
 * recognise, and can I get rid of it.
 */

export interface SessionRow {
  id: string;
  device: string;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  /** The session making this request. Cannot be revoked from here. */
  current: boolean;
}

/**
 * The session id is a claim inside the access token.
 *
 * Decoded, not verified, and deliberately so: `getUser()` has already checked
 * the token against Supabase before we get here, and this only decides which row
 * to label "this device". Nothing is authorised on the strength of it.
 */
function sessionIdFromToken(accessToken: string | undefined): string | null {
  if (!accessToken) return null;
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  try {
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      session_id?: string;
    };
    return json.session_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Turn a user agent into something a person can recognise.
 *
 * Not a full UA parser — those are large, and wrong often enough that the extra
 * precision is not worth the dependency. Order matters: Edge and Chrome both
 * claim to be Safari, so the more specific tests come first.
 */
export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  if (ua === "node" || /node|undici|axios|curl/i.test(ua)) return "Server or script";

  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /chrome|crios/i.test(ua)
        ? "Chrome"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /safari/i.test(ua)
            ? "Safari"
            : null;

  const os = /windows/i.test(ua)
    ? "Windows"
    : /android/i.test(ua)
      ? "Android"
      : /iphone|ipad|ipod/i.test(ua)
        ? "iOS"
        : /mac os x|macintosh/i.test(ua)
          ? "macOS"
          : /linux/i.test(ua)
            ? "Linux"
            : null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "Unknown device";
}

export async function getSessions(): Promise<SessionRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const currentId = sessionIdFromToken(session?.access_token);

  const rows = (await db.execute(
    raw`select id::text          as id,
               user_agent,
               host(ip)          as ip,
               -- to_json gives RFC 3339 with a "+00:00" offset. A plain text
               -- cast gives "+00", which is not a valid ISO offset, and every
               -- attempt to normalise it produced Invalid Date.
               to_json(created_at)#>>'{}' as created_at,
               to_json(updated_at)#>>'{}' as updated_at
          from auth.sessions
         where user_id = ${user.id}::uuid
         order by updated_at desc`,
  )) as unknown as {
    id: string;
    user_agent: string | null;
    ip: string | null;
    created_at: string;
    updated_at: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    device: describeDevice(r.user_agent),
    ip: r.ip,
    createdAt: r.created_at,
    lastSeenAt: r.updated_at,
    current: r.id === currentId,
  }));
}

/**
 * Sign one device out.
 *
 * Deleting the session row invalidates its refresh token, so the device is
 * signed out as soon as its access token expires — within the hour — and cannot
 * renew.
 *
 * The owner is derived here, not passed in. This runs through Drizzle, which
 * bypasses row-level security, so the `and user_id =` clause is the ONLY thing
 * stopping a caller ending somebody else's session with a guessed id — and a
 * parameter would put that guarantee in the hands of every future caller.
 */
export async function revokeSession(sessionId: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const rows = (await db.execute(
    raw`delete from auth.sessions
         where id = ${sessionId}::uuid
           and user_id = ${user.id}::uuid
     returning 1`,
  )) as unknown as unknown[];

  return rows.length;
}
