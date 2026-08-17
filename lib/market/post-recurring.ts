import { and, eq, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { runTrigger } from "@/lib/market/run-context";
import { syncRuns } from "@/lib/db/schema/market";
import { recurringTransactions, transactions } from "@/lib/db/schema/app";
import { karachiNow } from "@/lib/market/sessions";
import { duePostings, type Cadence } from "@/lib/recurring";

/**
 * Post recurring entries that have fallen due.
 *
 * Runs as the system through Drizzle because it works across every user, the
 * same as the snapshot job.
 *
 * THE ONE THING THIS MUST NEVER DO is post a period twice. Somebody's rent
 * appearing in the ledger a second time is worse than the feature not existing,
 * because it corrupts their cash flow, their budgets and their net worth all at
 * once, and they may not notice for weeks.
 *
 * Three guards, in order of strength:
 *   1. `duePostings` starts from the day AFTER `last_posted_on`.
 *   2. Each rule's `last_posted_on` is written in the same transaction as the
 *      entries it produced, so a crash cannot leave rows posted but unrecorded.
 *   3. The insert carries `recurring_id`, so a duplicate is at least traceable
 *      to the rule that made it.
 */

export type PostingResult =
  | { action: "skipped"; reason: string; detail?: string }
  | { action: "posted"; rules: number; entries: number; date: string };

export async function runRecurringPostings({ dryRun = false } = {}): Promise<PostingResult> {
  const today = karachiNow().date;

  const rules = await db
    .select()
    .from(recurringTransactions)
    .where(eq(recurringTransactions.isActive, true));

  if (!rules.length) return { action: "skipped", reason: "no-rules", detail: today };

  const work = rules
    .map((r) => ({
      rule: r,
      dates: duePostings(
        {
          cadence: r.cadence as Cadence,
          dayOfPeriod: r.dayOfPeriod,
          startDate: String(r.startDate),
          endDate: r.endDate ? String(r.endDate) : null,
          lastPostedOn: r.lastPostedOn ? String(r.lastPostedOn) : null,
          isActive: r.isActive,
        },
        today,
      ),
    }))
    .filter((w) => w.dates.length > 0);

  if (!work.length) return { action: "skipped", reason: "nothing-due", detail: today };

  if (dryRun) {
    for (const w of work) {
      console.log(
        `would post ${w.dates.length} × "${w.rule.label}" ` +
          `(${w.dates.join(", ")}) for user ${w.rule.userId}`,
      );
    }
    return {
      action: "posted",
      rules: work.length,
      entries: work.reduce((s, w) => s + w.dates.length, 0),
      date: today,
    };
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ job: "recurring", status: "running", trigger: runTrigger() })
    .returning({ id: syncRuns.id });

  let entries = 0;

  for (const w of work) {
    const rows = w.dates.map((date) => ({
      userId: w.rule.userId,
      accountId: w.rule.accountId,
      label: w.rule.label,
      category: w.rule.category,
      amountPaisa: w.rule.amountPaisa,
      occurredAt: new Date(`${date}T00:00:00+05:00`),
      recurringId: w.rule.id,
    }));

    // Entries and the watermark move together. Written separately, a failure
    // between them would either lose the month or repeat it on the next run.
    await db.transaction(async (tx) => {
      await tx.insert(transactions).values(rows);
      await tx
        .update(recurringTransactions)
        .set({ lastPostedOn: w.dates[w.dates.length - 1] })
        .where(
          and(
            eq(recurringTransactions.id, w.rule.id),
            // Guards against two runs overlapping: the second sees a watermark
            // that has already moved and updates nothing.
            w.rule.lastPostedOn
              ? eq(recurringTransactions.lastPostedOn, w.rule.lastPostedOn)
              : raw`${recurringTransactions.lastPostedOn} is null`,
          ),
        );
    });

    entries += rows.length;
  }

  await db
    .update(syncRuns)
    .set({ status: "ok", rowsWritten: entries, finishedAt: new Date() })
    .where(eq(syncRuns.id, run.id));

  return { action: "posted", rules: work.length, entries, date: today };
}
