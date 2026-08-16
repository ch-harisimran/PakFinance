-- ── Actually hide the PIN verifier ──────────────────────────────────────────
--
-- Migration 0013's column-level REVOKEs were no-ops, and silently so. Postgres
-- checks table-level privileges first: Supabase grants ALL on every table in
-- `public` to `anon` and `authenticated`, and a column-level REVOKE cannot take
-- away a privilege held at table level. Verified after applying 0013 —
-- `information_schema.column_privileges` still showed SELECT and UPDATE on
-- pin_salt and pin_hash for both roles.
--
-- The only way to express "every column except these" is to drop the table-wide
-- privilege and grant the columns back individually. Which means this list has
-- to be maintained: a column added to `profiles` later gets NO client access
-- until it is added here. That is the safer direction to fail in — a missing
-- grant surfaces immediately as a permission error, whereas the alternative
-- leaks a secret quietly, exactly as 0013 did.
--
-- RLS still applies on top of all of this. Grants decide which columns a role
-- may touch at all; RLS decides which rows. The PIN needs both, because the
-- attacker this defends against is holding the owner's own session.

REVOKE SELECT, UPDATE, INSERT ON "profiles" FROM authenticated;
--> statement-breakpoint
REVOKE SELECT, UPDATE, INSERT ON "profiles" FROM anon;
--> statement-breakpoint

-- Readable: everything except the salt and the hash. `pin_set_at` is included
-- deliberately — the client must know whether a PIN exists to choose between
-- "Enter your PIN" and "Set one up", and a timestamp helps no one guess it.
GRANT SELECT (
  "user_id", "full_name", "phone", "avatar_url", "timezone", "currency",
  "notation", "theme", "created_at", "pin_set_at"
) ON "profiles" TO authenticated;
--> statement-breakpoint

-- Writable: only the fields the settings screen edits. The PIN columns are
-- absent, so `setPin` must go through the server action that hashes properly —
-- a forged PostgREST update cannot install a verifier of its own choosing.
GRANT UPDATE (
  "full_name", "phone", "avatar_url", "timezone", "currency", "notation", "theme"
) ON "profiles" TO authenticated;
--> statement-breakpoint

-- Sign-up inserts the row; it has no business setting a PIN at creation.
GRANT INSERT (
  "user_id", "full_name", "phone", "avatar_url", "timezone", "currency",
  "notation", "theme"
) ON "profiles" TO authenticated;
