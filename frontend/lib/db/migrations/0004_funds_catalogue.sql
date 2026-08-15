-- Fund catalogue.
--
-- `market.funds` is system reference data, like `market.securities`. But unlike
-- PSX symbols there is no feed populating it yet, so a user whose fund is
-- missing would be dead in the water. `created_by` lets someone add their own:
-- NULL means seeded or MUFAP-sourced, a uuid means user-added.
--
-- When the MUFAP sync lands it matches on `mufap_code`, fills in the seeded
-- rows, and can fold user-added duplicates into the official record.

ALTER TABLE "market"."funds"
  ADD COLUMN IF NOT EXISTS "created_by" uuid;
--> statement-breakpoint

-- Starter catalogue: the larger Pakistani AMCs and their best-known funds.
-- Deliberately small and unauthoritative — MUFAP is the source of truth and
-- will correct these. `mufap_code` is left NULL until the sync supplies it.
INSERT INTO "market"."funds" ("name", "amc", "category", "is_islamic") VALUES
  ('Meezan Islamic Fund',              'Al Meezan Investments', 'Islamic Equity',   true),
  ('Al Meezan Mutual Fund',            'Al Meezan Investments', 'Islamic Equity',   true),
  ('Meezan Islamic Income Fund',       'Al Meezan Investments', 'Islamic Income',   true),
  ('Meezan Rozana Amdani Fund',        'Al Meezan Investments', 'Islamic Money Market', true),
  ('UBL Liquidity Plus Fund',          'UBL Fund Managers',     'Money Market',     false),
  ('UBL Government Securities Fund',   'UBL Fund Managers',     'Income',           false),
  ('Al-Ameen Islamic Sovereign Fund',  'UBL Fund Managers',     'Islamic Income',   true),
  ('NBP Money Market Fund',            'NBP Fund Management',   'Money Market',     false),
  ('NBP Islamic Sarmaya Izafa Fund',   'NBP Fund Management',   'Islamic Asset Allocation', true),
  ('Atlas Income Fund',                'Atlas Asset Management','Income',           false),
  ('Atlas Money Market Fund',          'Atlas Asset Management','Money Market',     false),
  ('HBL Money Market Fund',            'HBL Asset Management',  'Money Market',     false),
  ('HBL Islamic Money Market Fund',    'HBL Asset Management',  'Islamic Money Market', true),
  ('MCB Pakistan Sovereign Fund',      'MCB Investment Mgmt',   'Income',           false),
  ('Alfalah GHP Money Market Fund',    'Alfalah Asset Mgmt',    'Money Market',     false),
  ('Alfalah GHP Islamic Stock Fund',   'Alfalah Asset Mgmt',    'Islamic Equity',   true),
  ('JS Cash Fund',                     'JS Investments',        'Money Market',     false),
  ('Faysal Islamic Savings Growth Fund','Faysal Asset Mgmt',    'Islamic Income',   true),
  ('Lakson Money Market Fund',         'Lakson Investments',    'Money Market',     false),
  ('Pakistan Cash Management Fund',    'MCB Investment Mgmt',   'Money Market',     false)
ON CONFLICT DO NOTHING;
