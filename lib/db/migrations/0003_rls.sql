-- Row Level Security for every user-owned table.
--
-- This is not optional. NEXT_PUBLIC_SUPABASE_ANON_KEY ships to every browser,
-- and any table in `public` is reachable through PostgREST with it. A table
-- here without RLS is readable and writable by the entire internet.
--
-- RLS enabled with no policy means DENY ALL, which is the correct direction to
-- fail: we start closed and grant deliberately.
--
-- Policies use (SELECT auth.uid()) rather than bare auth.uid(). Wrapped in a
-- subquery Postgres evaluates it once per query instead of once per row — on a
-- few thousand transactions that is the difference between milliseconds and a
-- visible stall.

-- Link profiles to Supabase Auth. Deleting the auth user removes the profile,
-- and every other table cascades from there.
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;
--> statement-breakpoint

ALTER TABLE "accounts"           ADD CONSTRAINT "accounts_user_fk"           FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "transactions"       ADD CONSTRAINT "transactions_user_fk"       FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "loans"              ADD CONSTRAINT "loans_user_fk"              FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "loan_payments"      ADD CONSTRAINT "loan_payments_user_fk"      FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "goals"              ADD CONSTRAINT "goals_user_fk"              FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_user_fk" FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "fund_transactions"  ADD CONSTRAINT "fund_transactions_user_fk"  FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "net_worth_daily"    ADD CONSTRAINT "net_worth_daily_user_fk"    FOREIGN KEY ("user_id") REFERENCES auth.users("id") ON DELETE CASCADE;--> statement-breakpoint

-- Enable RLS everywhere, then grant per table.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','accounts','transactions','loans','loan_payments',
    'goals','goal_contributions','stock_transactions','fund_transactions',
    'net_worth_daily'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- profiles keys on user_id itself; everything else on a user_id column.
CREATE POLICY "profiles_select" ON "profiles" FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "profiles_insert" ON "profiles" FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);--> statement-breakpoint
CREATE POLICY "profiles_update" ON "profiles" FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'accounts','transactions','loans','loan_payments',
    'goals','goal_contributions','stock_transactions','fund_transactions',
    'net_worth_daily'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)',
      t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)',
      t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)',
      t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id)',
      t || '_delete', t);
  END LOOP;
END $$;
--> statement-breakpoint

-- A new signup gets a profile row automatically, so the app never has to cope
-- with an authenticated user that has no profile.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- The `market` schema is NOT exposed through PostgREST. Revoke explicitly
-- rather than relying on it not being listed in the API settings.
REVOKE ALL ON SCHEMA market FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA market FROM anon, authenticated;
