-- Fund identity is (name, category), not name alone.
--
-- Voluntary Pension Schemes publish sub-funds under one name: "ABL Pension
-- Fund" appears as VPS-Money Market, VPS-Debt and VPS-Equity, each with its own
-- NAV. Keying on name would collapse three prices into one and misvalue a
-- pension holding.

-- The starter catalogue was seeded from memory with invented category labels
-- ("Islamic Equity" where MUFAP says "Shariah Compliant Equity"), so it would
-- duplicate against the real feed. Drop the seeded rows that nobody has used;
-- MUFAP supplies the authoritative list on first sync.
DELETE FROM "market"."funds" f
WHERE f."created_by" IS NULL
  AND f."mufap_code" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "public"."fund_transactions" t WHERE t."fund_id" = f."id"
  );
--> statement-breakpoint

-- Case-insensitive: MUFAP's capitalisation is not stable between reports.
CREATE UNIQUE INDEX IF NOT EXISTS "funds_name_category_uniq"
  ON "market"."funds" (lower("name"), "category");
--> statement-breakpoint

-- Which MUFAP table the fund came from: Open-End, ETF, VPS, Pension.
-- Worth keeping distinct from category — a user browsing "my funds" cares that
-- something is a pension scheme, not just that it is equity-flavoured.
ALTER TABLE "market"."funds"
  ADD COLUMN IF NOT EXISTS "sector" text;
--> statement-breakpoint

ALTER TABLE "market"."funds"
  ADD COLUMN IF NOT EXISTS "rating" text;
