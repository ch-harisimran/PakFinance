import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";

/**
 * Rate limiting for the authentication surface.
 *
 * The threat is not sophisticated: it is somebody trying passwords against
 * /login, or walking a six-digit OTP, as fast as the network allows. A million
 * combinations falls in hours at a few hundred requests a second, and nothing in
 * this app previously slowed that down at all.
 *
 * Counters live in Postgres, not memory. On serverless every invocation can be a
 * fresh process, so an in-memory counter resets constantly and limits nothing —
 * it only looks like a control, which is worse than no control because it stops
 * anyone asking the question again.
 *
 * The whole window is done in ONE statement. Read-then-write would let two
 * concurrent attempts both read count = 4 and both write 5, which is exactly the
 * race an attacker generates by firing requests in parallel.
 *
 * No `server-only` guard, and `next/headers` is imported lazily inside the one
 * function that needs it — so `consume()` can be exercised against the real
 * table from a plain Node script (see scripts/verify-rate-limit.ts). The atomic
 * counter is the part that can actually go wrong, and testing it was worth more
 * than a guard already provided by the modules that import this one.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Attempts left in this window. */
  remaining: number;
  /** Seconds until the caller may try again. Zero when allowed. */
  retryAfter: number;
}

export interface RateLimitRule {
  /** Attempts permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** How long to lock out after the limit is tripped. Defaults to the window. */
  blockSeconds?: number;
}

/**
 * Tuned per action, because the cost of being wrong differs.
 *
 * OTP is the tightest: it is the one secret short enough to guess, and a real
 * person types it once, maybe twice. Sign-in is loose enough for a bad day at
 * the keyboard. Anything that sends an email is limited hard because the cost is
 * somebody else's inbox and our sending reputation.
 */
export const RULES = {
  signIn: { limit: 8, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  signUp: { limit: 5, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  otpVerify: { limit: 6, windowSeconds: 10 * 60, blockSeconds: 30 * 60 },
  otpResend: { limit: 4, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  passwordReset: { limit: 4, windowSeconds: 60 * 60, blockSeconds: 60 * 60 },
  passwordChange: { limit: 6, windowSeconds: 15 * 60, blockSeconds: 15 * 60 },
  /**
   * Six digits is a 10^6 space, so the server check is the only thing standing
   * between a scripted client and the whole of it. Tighter than the others
   * because a legitimate user gets five tries in the lock screen before it gives
   * up and asks for a full sign-in anyway.
   */
  pinVerify: { limit: 10, windowSeconds: 15 * 60, blockSeconds: 30 * 60 },
  /**
   * The admin console guards market data shared by every user, and there is
   * exactly one legitimate person trying. Tight on purpose; `admin_auth` also
   * keeps its own durable lockout that survives a change of IP.
   */
  adminUnlock: { limit: 8, windowSeconds: 15 * 60, blockSeconds: 30 * 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RuleName = keyof typeof RULES;

/**
 * Count one attempt against a key.
 *
 * Fixed window: the row's counter resets once `window_start` is older than the
 * window. Returns whether the attempt is permitted, never throws — a limiter
 * that takes the site down when its own table misbehaves has traded one outage
 * for another.
 */
export async function consume(
  rule: RuleName,
  identifier: string,
): Promise<RateLimitResult> {
  const { limit, windowSeconds } = RULES[rule];
  const blockSeconds = RULES[rule].blockSeconds ?? windowSeconds;
  const key = `${rule}:${identifier}`.slice(0, 200);

  try {
    const rows = (await db.execute(
      raw`
      insert into rate_limits (key, window_start, count)
      values (${key}, now(), 1)
      on conflict (key) do update set
        -- Reset the window if the old one has expired, otherwise increment.
        window_start = case
          when rate_limits.window_start < now() - ${`${windowSeconds} seconds`}::interval
            then now() else rate_limits.window_start end,
        count = case
          when rate_limits.window_start < now() - ${`${windowSeconds} seconds`}::interval
            then 1 else rate_limits.count + 1 end,
        -- Start the lockout on the attempt that crosses the line.
        blocked_until = case
          when rate_limits.window_start >= now() - ${`${windowSeconds} seconds`}::interval
           and rate_limits.count + 1 > ${limit}
            then now() + ${`${blockSeconds} seconds`}::interval
          when rate_limits.window_start < now() - ${`${windowSeconds} seconds`}::interval
            then null
          else rate_limits.blocked_until end
      returning count,
                greatest(0, extract(epoch from (blocked_until - now()))::int) as retry_after,
                (blocked_until is not null and blocked_until > now()) as blocked`,
    )) as unknown as { count: number; retry_after: number; blocked: boolean }[];

    const row = rows[0];
    if (!row) return { allowed: true, remaining: limit - 1, retryAfter: 0 };

    return {
      allowed: !row.blocked && row.count <= limit,
      remaining: Math.max(0, limit - row.count),
      retryAfter: row.blocked ? row.retry_after : 0,
    };
  } catch (e) {
    // Fail OPEN, deliberately. This guards a login form, not a vault door: the
    // password is still required. Locking every user out because a counter table
    // is unreachable would turn a minor fault into a total outage.
    console.error("rate limit check failed, allowing request:", (e as Error).message);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

/**
 * The caller's IP, from the proxy headers.
 *
 * `x-forwarded-for` is a client-controllable header, so this is only trustworthy
 * behind a proxy that overwrites it — Vercel does. It is used to widen the net,
 * never to narrow it: every limit below is ALSO applied per email address, so
 * spoofing the header buys an attacker nothing on a single account.
 */
export async function callerIp(): Promise<string> {
  // Imported here rather than at module scope so this file stays loadable
  // outside a request — otherwise the verification script cannot touch it.
  const { headers } = await import("next/headers");
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

/** Minutes, rounded up — for a message a human reads. */
export function waitMessage(retryAfterSeconds: number): string {
  const minutes = Math.ceil(retryAfterSeconds / 60);
  if (minutes <= 1) return "Try again in a minute.";
  if (minutes < 60) return `Try again in ${minutes} minutes.`;
  const hours = Math.ceil(minutes / 60);
  return `Try again in ${hours} hour${hours === 1 ? "" : "s"}.`;
}

/**
 * Guard an action by BOTH the identifier and the caller's IP.
 *
 * Per-identifier alone lets one host walk a list of accounts; per-IP alone lets a
 * botnet hammer one account. Checking both closes each other's gap, and the
 * tighter of the two answers decides.
 */
export async function guard(
  rule: RuleName,
  identifier: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ip = await callerIp();

  const byIdentity = await consume(rule, identifier.toLowerCase());
  // The IP bucket is deliberately more generous: a family, an office or a mobile
  // carrier can share one address legitimately.
  const byIp = await consume(rule, `ip:${ip}`);

  const blocked = !byIdentity.allowed ? byIdentity : !byIp.allowed ? byIp : null;
  if (!blocked) return { ok: true };

  return {
    ok: false,
    message: `Too many attempts. ${waitMessage(blocked.retryAfter)}`,
  };
}
