-- Sector names, and index membership as data rather than a packed string.
--
-- TWO SEPARATE PROBLEMS, both visible on the PSX screen today:
--
-- 1. `securities.sector` holds a PSX code ("0813"), so the UI reads
--    "Sector 0813". The market watch feed carries the code and never the name,
--    so a lookup table is the only honest fix — the alternative is guessing at
--    a mapping and mislabelling somebody's portfolio. It starts empty and the
--    UI falls back to the code until it is seeded.
--
-- 2. `securities.board` holds "ALLSHR,KMI30,KSE100,KSE30" — a list crammed into
--    a text column. Answering "show me my KSE-100 holdings" means a LIKE against
--    a comma-separated string, which matches KSE100PR when you wanted KSE100.
--    A real array with a GIN index answers it exactly and fast.
CREATE TABLE IF NOT EXISTS "market"."sectors" (
  "code" text PRIMARY KEY,
  "name" text NOT NULL
);
--> statement-breakpoint

ALTER TABLE "market"."securities" ADD COLUMN IF NOT EXISTS "indices" text[];--> statement-breakpoint

-- Backfill from the packed column. NULLIF guards the rows where board is empty:
-- string_to_array('', ',') yields {''} rather than NULL, which would leave a
-- phantom membership in an index whose name is the empty string.
UPDATE "market"."securities"
   SET "indices" = string_to_array(NULLIF(btrim("board"), ''), ',')
 WHERE "indices" IS NULL;
--> statement-breakpoint

-- Membership lookups are "does this array contain KSE100", which is exactly what
-- GIN answers without scanning every row.
CREATE INDEX IF NOT EXISTS "securities_indices_idx"
  ON "market"."securities" USING GIN ("indices");
--> statement-breakpoint

-- `board` stays for now, written by the sync alongside the array, so a rollback
-- does not lose anything. It should be dropped once nothing reads it.
COMMENT ON COLUMN "market"."securities"."board" IS
  'Deprecated: superseded by the indices array. Kept until the next release.';
