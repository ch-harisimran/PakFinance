-- ── The admin console's own credential ──────────────────────────────────────
--
-- Uploading the MUFAP report writes `market.funds` and `market.fund_navs`, which
-- are ONE catalogue shared by every user — not rows owned by the caller. A user
-- session is the wrong authority for that, so the console asks for a second
-- password. If an app session is ever taken (an unlocked laptop, a stolen
-- cookie), the attacker still cannot rewrite the prices everyone is valued
-- against.
--
-- WHO the admin is comes from ADMIN_EMAIL in the environment, never from this
-- table and never from anything a request carries. There is deliberately no way
-- to grant admin from inside the app: no invite, no role column, no first-user
-- -wins. Someone who registers the admin address after the fact still cannot set
-- a password, because a verifier already exists and changing it requires the old
-- one.
--
-- scrypt, and the hash is unreadable by clients: RLS is enabled AND forced with
-- no policies at all, which denies every role outright. Only the server reaches
-- this, through Drizzle as `postgres`. Same posture as `rate_limits`.
CREATE TABLE IF NOT EXISTS "admin_auth" (
  "user_id"      uuid PRIMARY KEY REFERENCES auth.users("id") ON DELETE CASCADE,
  "pass_salt"    text NOT NULL,
  "pass_hash"    text NOT NULL,
  -- The console session. The cookie holds the raw token; only its hash is stored,
  -- so a leak of this table cannot be replayed as a login.
  "session_hash" text,
  "session_expires_at" timestamptz,
  -- Wrong passwords lock the console for a while. The shared rate limiter counts
  -- attempts per identity and IP; this is the durable lock that survives both.
  "failed_attempts" integer NOT NULL DEFAULT 0,
  "locked_until" timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now(),
  "updated_at"   timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

ALTER TABLE "admin_auth" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin_auth" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Belt and braces alongside the deny-all policy set: even if a policy were added
-- by mistake later, the client roles hold no privilege on the table at all.
REVOKE ALL ON "admin_auth" FROM authenticated;--> statement-breakpoint
REVOKE ALL ON "admin_auth" FROM anon;
