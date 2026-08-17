-- Corporate actions that the user cannot record as a trade, and fund identity
-- that survives a rename.
--
-- ── Why some actions and not others ────────────────────────────────────────
--
-- The trade form already offers BONUS and RIGHT, and people enter them, because
-- that is how their broker note reads. If this table also applied a BONUS the
-- shares would be counted twice and the position would silently double.
--
-- So the division is by who records what:
--
--   BONUS, RIGHT, DIVIDEND   the user enters them as trades. Rows may exist here
--                            for reference, but nothing applies them to holdings.
--   SPLIT, SYMBOL_CHANGE,    there is no way to enter these as a trade, and
--   MERGER                   ignoring them corrupts cost basis. These are applied.
--
-- `new_symbol` carries the destination for a symbol change or a merger.
ALTER TYPE "market"."action_kind" ADD VALUE IF NOT EXISTS 'SYMBOL_CHANGE';--> statement-breakpoint
ALTER TYPE "market"."action_kind" ADD VALUE IF NOT EXISTS 'MERGER';--> statement-breakpoint

ALTER TABLE "market"."corporate_actions" ADD COLUMN IF NOT EXISTS "new_symbol" text;--> statement-breakpoint
ALTER TABLE "market"."corporate_actions" ADD COLUMN IF NOT EXISTS "note" text;--> statement-breakpoint

-- One action per symbol per kind per ex-date. Re-seeding the same file must
-- correct rows rather than stack duplicate splits on top of each other, which
-- would multiply somebody's share count by the ratio twice.
CREATE UNIQUE INDEX IF NOT EXISTS "corp_actions_once"
  ON "market"."corporate_actions" ("symbol", "kind", "ex_date");
--> statement-breakpoint

-- ── Fund identity ──────────────────────────────────────────────────────────
--
-- Funds are identified by (lower(name), category) because MUFAP publishes no
-- stable code. That works until an AMC renames a fund — "NBP Islamic Income
-- Fund" becoming "NBP Islamic Savings Fund" creates a second row, and a user's
-- units sit against the old one while new NAVs land on the new one.
--
-- An alias maps a previously seen name onto the fund it really is. The NAV sync
-- checks it before creating anything, so a rename is a one-line fix instead of a
-- split position.
CREATE TABLE IF NOT EXISTS "market"."fund_aliases" (
  "alias"      text PRIMARY KEY,
  "fund_id"    uuid NOT NULL REFERENCES "market"."funds"("id") ON DELETE CASCADE,
  "note"       text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "fund_aliases_fund_idx"
  ON "market"."fund_aliases" ("fund_id");
