import { sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailConfigured, sendEmail } from "@/lib/notify/email";

/**
 * Job health, and telling somebody when it is bad.
 *
 * `sync_runs` has recorded failures since the beginning and nobody has ever been
 * told about one. A pipeline that fails quietly is indistinguishable from one
 * that works, right up until you need the data.
 *
 * It watches for two different things, and the second matters more:
 *
 *   1. A job that ran and errored. Loud, already recorded, easy.
 *   2. A job that has not succeeded in far too long. This is the dangerous one —
 *      a workflow that never fires, a schedule GitHub quietly disabled after 60
 *      days of repository inactivity, an expired credential. Nothing appears in
 *      the error log because nothing ran at all.
 *
 * The snapshot is the job worth losing sleep over: PSX closes can be backfilled,
 * but a missing net-worth row is missing forever.
 */

interface Watched {
  job: string;
  label: string;
  /** Hours after which a missing success is a problem. */
  staleAfterHours: number;
  note?: string;
}

const WATCHED: Watched[] = [
  {
    job: "snapshot",
    label: "Daily net-worth snapshot",
    staleAfterHours: 36,
    note: "A missed day is a permanent hole in every user's net-worth chart — this one cannot be backfilled.",
  },
  { job: "sync-psx", label: "PSX price sync", staleAfterHours: 96 },
  { job: "sync-nav", label: "MUFAP NAV sync", staleAfterHours: 24 * 14 },
  { job: "loan-reminders", label: "Loan repayment reminders", staleAfterHours: 36 },
];

export type WatchdogResult =
  | { action: "skipped"; reason: string }
  | { action: "checked"; problems: number; notified: boolean; detail: string[] };

export async function runWatchdog({ dryRun = false } = {}): Promise<WatchdogResult> {
  const problems: string[] = [];

  const errors = (await db.execute(
    raw`select job, error, started_at
          from market.sync_runs
         where status = 'error'
           and started_at > now() - interval '24 hours'
         order by started_at desc
         limit 20`,
  )) as unknown as { job: string; error: string | null; started_at: string }[];

  for (const e of errors) {
    problems.push(
      `${e.job} failed at ${String(e.started_at).slice(0, 19)} — ${e.error ?? "no message recorded"}`,
    );
  }

  const lastOk = (await db.execute(
    raw`select job, max(finished_at) as at
          from market.sync_runs
         where status = 'ok'
         group by job`,
  )) as unknown as { job: string; at: string | null }[];

  const okByJob = new Map(lastOk.map((r) => [r.job, r.at ? new Date(r.at) : null]));

  for (const w of WATCHED) {
    const at = okByJob.get(w.job);
    const hours = at ? (Date.now() - at.getTime()) / 3_600_000 : Number.POSITIVE_INFINITY;
    if (hours <= w.staleAfterHours) continue;

    problems.push(
      at
        ? `${w.label} has not succeeded since ${at.toISOString().slice(0, 16).replace("T", " ")} ` +
          `(${Math.floor(hours)}h ago, expected within ${w.staleAfterHours}h).${w.note ? ` ${w.note}` : ""}`
        : `${w.label} has never recorded a successful run.${w.note ? ` ${w.note}` : ""}`,
    );
  }

  if (!problems.length) {
    return { action: "checked", problems: 0, notified: false, detail: [] };
  }

  if (dryRun) {
    return { action: "checked", problems: problems.length, notified: false, detail: problems };
  }

  const to = process.env.ALERT_EMAIL;
  if (!to || !emailConfigured()) {
    // Still a useful exit code and log line for the workflow, even with no
    // mailer configured — the run goes red and someone looks.
    console.error("watchdog found problems but cannot email:\n" + problems.join("\n"));
    return { action: "checked", problems: problems.length, notified: false, detail: problems };
  }

  // One alert per day at most. A watchdog that mails every hour about the same
  // broken job trains you to filter it, which defeats the point.
  const [{ already }] = (await db.execute(
    raw`select count(*)::int as already
          from market.sync_runs
         where job = 'watchdog'
           and status = 'error'
           and started_at > now() - interval '20 hours'`,
  )) as unknown as { already: number }[];

  if (already > 0) {
    return { action: "checked", problems: problems.length, notified: false, detail: problems };
  }

  await sendEmail({
    to,
    subject: `PakFinance: ${problems.length} job problem${problems.length === 1 ? "" : "s"}`,
    text: ["Scheduled jobs need attention:", "", ...problems.map((p) => `• ${p}`), "", "— PakFinance watchdog"].join("\n"),
    html:
      `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6">` +
      `<p style="margin:0 0 12px"><strong>Scheduled jobs need attention</strong></p><ul>` +
      problems.map((p) => `<li style="margin-bottom:6px">${escapeHtml(p)}</li>`).join("") +
      `</ul><p style="color:#6B7280;font-size:12px">PakFinance watchdog</p></div>`,
  });

  await db.execute(
    raw`insert into market.sync_runs (job, status, reason, error, finished_at)
        values ('watchdog', 'error', 'problems-found', ${problems.join(" | ").slice(0, 500)}, now())`,
  );

  return { action: "checked", problems: problems.length, notified: true, detail: problems };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
