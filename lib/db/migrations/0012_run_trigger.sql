-- Record HOW a job run was started.
--
-- Every workflow is green when clicked, which proves the code, the secrets and
-- the runner. It does not prove the schedule fires — and that is the failure
-- that leaves no trace: GitHub disables cron on repositories with 60 days of
-- inactivity, and a workflow that simply never runs produces no error, no log
-- and no red tick. Nobody notices until the data is missing.
--
-- GitHub Actions sets GITHUB_EVENT_NAME to `schedule` for cron and
-- `workflow_dispatch` for a manual click. Recording it turns "did the schedule
-- fire?" from a guess into a query.
ALTER TABLE "market"."sync_runs" ADD COLUMN IF NOT EXISTS "trigger" text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "sync_runs_job_trigger_idx"
  ON "market"."sync_runs" ("job", "trigger", "started_at" DESC);
