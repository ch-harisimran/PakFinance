-- Rate limiting for the authentication surface.
--
-- Nothing currently stops an attacker trying passwords against /login, or
-- guessing a six-digit OTP, as fast as the network allows. A six-digit code has
-- a million combinations; at even a modest request rate that is hours, not
-- years. Supabase applies its own limits to email sending, but not to the
-- verification attempts that matter most here.
--
-- WHY POSTGRES AND NOT MEMORY: this app is destined for serverless, where every
-- invocation may be a fresh process. An in-memory counter would reset constantly
-- and limit nothing — it would only look like a control. A shared table is the
-- one store already available on every request.
--
-- Fixed window rather than sliding: one row per key, reset when the window has
-- expired. A sliding window needs a row per hit and a periodic sweep, which is
-- more machinery than a login form warrants.
CREATE TABLE IF NOT EXISTS "rate_limits" (
  -- "action:identifier", e.g. "signin:ip:203.0.113.4" or "otp:user@x.com".
  "key"          text PRIMARY KEY,
  "window_start" timestamptz NOT NULL DEFAULT now(),
  "count"        integer NOT NULL DEFAULT 0,
  -- Set when a limit is tripped, so a caller can be told how long to wait
  -- without recomputing it.
  "blocked_until" timestamptz
);
--> statement-breakpoint

-- The maintenance job prunes expired rows; this makes that cheap.
CREATE INDEX IF NOT EXISTS "rate_limits_window_idx" ON "rate_limits" ("window_start");
--> statement-breakpoint

-- Locked down completely. Only the server touches this, through Drizzle as
-- `postgres`; no user has any business reading or writing counters, least of all
-- their own. RLS with no policy denies everyone — which is exactly right here.
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limits" FORCE ROW LEVEL SECURITY;
