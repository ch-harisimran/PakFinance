-- ── Persistent quick-unlock PIN ─────────────────────────────────────────────
--
-- The PIN used to exist only as the key that encrypted a refresh token in
-- localStorage. That made it a property of one session on one browser: signing
-- out revoked the token, so the blob became useless and the next sign-in had to
-- choose a new PIN. Clearing site data lost it the same way.
--
-- The PIN is now the user's, not the session's. It survives sign-out, a cleared
-- browser and a new device, and changes only when its owner changes it.
--
-- The verifier is scrypt, not a plain digest. Six digits is a 10^6 space that a
-- fast hash would fall to instantly; scrypt's memory cost is what makes each
-- guess expensive. It still must never leave the server, because an attacker
-- holding salt and hash can grind that space offline no matter the cost factor —
-- hence the REVOKE below. Verification happens in a rate-limited server action.
ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "pin_salt"   text,
  ADD COLUMN IF NOT EXISTS "pin_hash"   text,
  ADD COLUMN IF NOT EXISTS "pin_set_at" timestamptz;
--> statement-breakpoint

-- `pin_set_at` stays readable: the client has to know whether to show "Enter
-- your PIN" or "Set one up", and a timestamp reveals nothing that helps a guess.
-- The salt and hash do not, and RLS alone would not have stopped the owner's own
-- browser — the very thing the lock defends against — from reading them.
REVOKE SELECT ("pin_salt", "pin_hash") ON "profiles" FROM authenticated;
--> statement-breakpoint
REVOKE SELECT ("pin_salt", "pin_hash") ON "profiles" FROM anon;
--> statement-breakpoint

-- Likewise no client may write them: the PIN is set through a server action that
-- does the hashing, so a forged UPDATE cannot install a verifier of its own
-- choosing and turn the lock into one the attacker holds the key to.
REVOKE UPDATE ("pin_salt", "pin_hash", "pin_set_at") ON "profiles" FROM authenticated;
--> statement-breakpoint
REVOKE UPDATE ("pin_salt", "pin_hash", "pin_set_at") ON "profiles" FROM anon;
