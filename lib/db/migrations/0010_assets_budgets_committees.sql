-- Everything a Pakistani balance sheet has that this app could not yet hold.
--
-- Five features, one migration, because they interlock: Zakat is computed over
-- assets, committees are both a saving and a borrowing, and budgets and
-- recurring entries both hang off the transaction ledger.
--
-- Money is integer paisa throughout, as everywhere else.

-- ── Other asset classes ────────────────────────────────────────────────────
--
-- Gold is the one that matters most here: it is how a great many Pakistani
-- households actually store wealth, it is Zakat-relevant, and the landing page
-- has been showing it in the allocation ring with nowhere to put it.
--
-- `quantity` and `unit` are optional context (11 tola, 250 sq yd); `value_paisa`
-- is what it is worth, stated by the user. There is no gold or property price
-- feed, and inventing one would be worse than asking.
CREATE TYPE "asset_kind" AS ENUM (
  'GOLD', 'SILVER', 'PROPERTY', 'VEHICLE', 'CRYPTO', 'FOREIGN_CURRENCY', 'OTHER'
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "assets" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "kind"           "asset_kind" NOT NULL DEFAULT 'OTHER',
  "name"           text NOT NULL,
  "quantity"       numeric(18, 4),
  "unit"           text,
  "cost_paisa"     bigint,
  "value_paisa"    bigint NOT NULL DEFAULT 0,
  "as_of"          date NOT NULL DEFAULT CURRENT_DATE,
  -- Not everything you own is Zakat-payable: a house you live in and the car
  -- you drive are not, gold and trade goods are. The user decides, because the
  -- rulings differ and this app is not a mufti.
  "zakatable"      boolean NOT NULL DEFAULT false,
  "note"           text,
  "created_at"     timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_user_idx" ON "assets" ("user_id");--> statement-breakpoint

-- ── Budgets ────────────────────────────────────────────────────────────────
--
-- One limit per category per user. Spend is derived from the transaction ledger
-- rather than stored, so a budget and its actual can never disagree.
CREATE TABLE IF NOT EXISTS "budgets" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "category"      text NOT NULL,
  "limit_paisa"   bigint NOT NULL,
  "is_active"     boolean NOT NULL DEFAULT true,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_user_category"
  ON "budgets" ("user_id", lower("category"));
--> statement-breakpoint

-- ── Recurring transactions ─────────────────────────────────────────────────
--
-- Salary, rent, utilities: the entries people retype every month.
--
-- `last_posted_on` is the idempotency guard, exactly like the loan reminder
-- ledger. The job posts an entry only when the due date has arrived AND has not
-- already been posted, so a retried run cannot double a month's rent.
CREATE TYPE "recurrence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "recurring_transactions" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"         uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "account_id"      uuid REFERENCES "accounts"("id") ON DELETE SET NULL,
  "label"           text NOT NULL,
  "category"        text,
  -- Signed, like transactions.amount_paisa: positive in, negative out.
  "amount_paisa"    bigint NOT NULL,
  "cadence"         "recurrence" NOT NULL DEFAULT 'MONTHLY',
  -- 1–31 for monthly and longer; 0–6 (Sunday first) for weekly.
  "day_of_period"   smallint NOT NULL DEFAULT 1,
  "start_date"      date NOT NULL DEFAULT CURRENT_DATE,
  "end_date"        date,
  "last_posted_on"  date,
  "is_active"       boolean NOT NULL DEFAULT true,
  "created_at"      timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "recurring_user_idx" ON "recurring_transactions" ("user_id");--> statement-breakpoint

-- Marks a transaction the job created, so it can be told from one typed by hand
-- and so a rule's history is traceable.
ALTER TABLE "transactions"
  ADD COLUMN IF NOT EXISTS "recurring_id" uuid REFERENCES "recurring_transactions"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- ── Committees (BC / ROSCA) ────────────────────────────────────────────────
--
-- A committee is a rotating savings pool: N people each put in the same amount
-- every month, and each month one member takes the whole pot. It is completely
-- ordinary in Pakistan and fits nothing else in this schema — before your turn
-- it behaves like saving, after it behaves like a debt you repay by instalment.
--
-- Position is derived: contributed so far, received or not, net.
CREATE TABLE IF NOT EXISTS "committees" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"          uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "name"             text NOT NULL,
  "organiser"        text,
  "members"          smallint NOT NULL,
  "monthly_paisa"    bigint NOT NULL,
  "start_month"      date NOT NULL,
  -- Which round is yours, 1-based. Null until the draw decides.
  "payout_position"  smallint,
  "payout_received"  boolean NOT NULL DEFAULT false,
  "payout_date"      date,
  "is_settled"       boolean NOT NULL DEFAULT false,
  "note"             text,
  "created_at"       timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committees_user_idx" ON "committees" ("user_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "committee_payments" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"       uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "committee_id"  uuid NOT NULL REFERENCES "committees"("id") ON DELETE CASCADE,
  "amount_paisa"  bigint NOT NULL,
  "paid_at"       date NOT NULL,
  "note"          text,
  "created_at"    timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committee_payments_idx"
  ON "committee_payments" ("committee_id", "paid_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committee_payments_user_idx"
  ON "committee_payments" ("user_id");
--> statement-breakpoint

-- ── Zakat assessments ──────────────────────────────────────────────────────
--
-- A record of what was assessed and paid, kept because the hawl (the lunar year
-- a sum must be held for) runs from one assessment to the next, and because
-- people want last year's working when they do this year's.
--
-- The nisab value is stored WITH the assessment: it moves with the gold price,
-- so recomputing an old assessment against today's nisab would give a different
-- answer to the one the user acted on.
CREATE TABLE IF NOT EXISTS "zakat_assessments" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"           uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "assessed_on"       date NOT NULL DEFAULT CURRENT_DATE,
  "nisab_paisa"       bigint NOT NULL,
  "assets_paisa"      bigint NOT NULL,
  "deductions_paisa"  bigint NOT NULL DEFAULT 0,
  "zakatable_paisa"   bigint NOT NULL,
  "due_paisa"         bigint NOT NULL,
  "paid_paisa"        bigint NOT NULL DEFAULT 0,
  "note"              text,
  "created_at"        timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "zakat_user_idx" ON "zakat_assessments" ("user_id", "assessed_on");--> statement-breakpoint

-- ── RLS, same posture as every other user-owned table ──────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'assets','budgets','recurring_transactions','committees',
    'committee_payments','zakat_assessments'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);

    EXECUTE format($p$
      CREATE POLICY %1$I ON public.%2$I FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$, t || '_select_own', t);

    EXECUTE format($p$
      CREATE POLICY %1$I ON public.%2$I FOR INSERT TO authenticated
        WITH CHECK (user_id = (SELECT auth.uid()))
    $p$, t || '_insert_own', t);

    EXECUTE format($p$
      CREATE POLICY %1$I ON public.%2$I FOR UPDATE TO authenticated
        USING (user_id = (SELECT auth.uid()))
        WITH CHECK (user_id = (SELECT auth.uid()))
    $p$, t || '_update_own', t);

    EXECUTE format($p$
      CREATE POLICY %1$I ON public.%2$I FOR DELETE TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$, t || '_delete_own', t);
  END LOOP;
END $$;
