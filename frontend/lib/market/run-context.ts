/**
 * How the current job run was started.
 *
 * GitHub Actions sets GITHUB_EVENT_NAME on every step: `schedule` for cron,
 * `workflow_dispatch` for a manual click. Recording it is what separates
 * "the workflow works" from "the workflow is running" — two very different
 * claims, and only the second one keeps the data flowing.
 */
export type RunTrigger = "schedule" | "workflow_dispatch" | "api" | "local";

export function runTrigger(): RunTrigger {
  // GITHUB_EVENT_NAME is a default Actions variable — it needs no wiring in the
  // workflow files, it is simply present on every step.
  const event = process.env.GITHUB_EVENT_NAME;
  if (event === "schedule") return "schedule";
  if (event === "workflow_dispatch") return "workflow_dispatch";
  if (process.env.GITHUB_ACTIONS) return "workflow_dispatch";

  // Next sets NEXT_RUNTIME inside the server; reaching this code there means the
  // run came in over HTTP through /api/cron/*.
  if (process.env.NEXT_RUNTIME) return "api";

  return "local";
}
