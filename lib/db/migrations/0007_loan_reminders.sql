-- Loan repayment reminders.
--
-- Two shapes of loan, because Pakistani borrowing has both: a bank facility with
-- a monthly installment (`due_day`, already here), and a single sum owed to a
-- person or a committee, repaid once on an agreed date (`due_date`, added now).
-- A reminder can be set on either.
--
-- `loan_reminders_sent` is the idempotency ledger. Sending email is the one
-- thing in this app the user cannot undo and cannot be shielded from by a
-- transaction, so the job records what it sent and refuses to send the same
-- (loan, due date) twice — a retried workflow, an overlapping cron and a manual
-- run all collapse to one email.
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "due_date" date;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "reminder_enabled" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "reminder_days_before" smallint NOT NULL DEFAULT 3;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "loan_reminders_sent" (
  "id"       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"  uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "loan_id"  uuid NOT NULL REFERENCES "loans"("id") ON DELETE CASCADE,
  -- The repayment date this reminder was about, NOT the day it was sent.
  -- That is what makes the uniqueness below meaningful across months.
  "due_date" date NOT NULL,
  "channel"  text NOT NULL DEFAULT 'email',
  "sent_at"  timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "loan_reminders_sent_once"
  ON "loan_reminders_sent" ("loan_id", "due_date", "channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loan_reminders_sent_user_idx"
  ON "loan_reminders_sent" ("user_id");
--> statement-breakpoint

-- Same posture as every other user-owned table: closed by default, then granted.
ALTER TABLE "loan_reminders_sent" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loan_reminders_sent" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

DROP POLICY IF EXISTS "loan_reminders_sent_select_own" ON "loan_reminders_sent";--> statement-breakpoint
CREATE POLICY "loan_reminders_sent_select_own"
  ON "loan_reminders_sent" FOR SELECT TO authenticated
  USING ("user_id" = (SELECT auth.uid()));
--> statement-breakpoint

-- Deliberately no INSERT/UPDATE/DELETE policy. Only the reminder job writes
-- here, and it connects as `postgres` for exactly that reason: a client that
-- could forge a "already sent" row could silence its own reminders.
