import { and, eq, inArray, sql as raw } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { runTrigger } from "@/lib/market/run-context";
import { syncRuns } from "@/lib/db/schema/market";
import { loans, loanPayments, loanRemindersSent, profiles } from "@/lib/db/schema/app";
import { karachiNow } from "@/lib/market/sessions";
import { paisaFull } from "@/lib/money";
import { emailConfigured, sendEmail } from "@/lib/notify/email";
import { reminderDueFor, daysBetween } from "@/lib/notify/due-dates";

/**
 * Loan repayment reminders.
 *
 * Runs as the system through Drizzle, because it computes for every user — the
 * `postgres` role carries BYPASSRLS, which is why it can read across users and
 * write the sent-ledger that no client is allowed to write.
 *
 * The ledger is checked BEFORE sending and written AFTER, and the unique index
 * on (loan_id, due_date, channel) is the real guard: two overlapping runs race
 * to insert and the loser gets a constraint violation instead of sending a
 * second email. Nobody wants two reminders about the same installment.
 */

export type ReminderResult =
  | { action: "skipped"; reason: string; detail?: string }
  | { action: "sent"; sent: number; failed: number; considered: number; date: string };

interface Candidate {
  loanId: string;
  userId: string;
  name: string;
  lender: string | null;
  installmentPaisa: number | null;
  remainingPaisa: number;
  dueDate: string;
  isInstallment: boolean;
}

export async function runLoanReminders({ dryRun = false } = {}): Promise<ReminderResult> {
  const today = karachiNow().date;

  if (!dryRun && !emailConfigured()) {
    return {
      action: "skipped",
      reason: "email-not-configured",
      detail: "Set BREVO_API_KEY and BREVO_SENDER.",
    };
  }

  // Sequential, not Promise.all — see the warning in lib/db/client.ts about
  // Drizzle hanging on fan-out wider than the pool.
  const rows = await db
    .select()
    .from(loans)
    .where(and(eq(loans.reminderEnabled, true), eq(loans.isSettled, false)));

  if (!rows.length) {
    return { action: "skipped", reason: "no-reminders-set", detail: today };
  }

  const paid = await db
    .select({
      loanId: loanPayments.loanId,
      total: raw<number>`coalesce(sum(${loanPayments.amountPaisa}),0)::bigint`,
    })
    .from(loanPayments)
    .where(inArray(loanPayments.loanId, rows.map((l) => l.id)))
    .groupBy(loanPayments.loanId);

  const paidByLoan = new Map(paid.map((p) => [p.loanId, Number(p.total)]));

  const candidates: Candidate[] = [];
  for (const l of rows) {
    const due = reminderDueFor(
      {
        dueDay: l.dueDay,
        dueDate: l.dueDate,
        isSettled: l.isSettled,
        reminderEnabled: l.reminderEnabled,
        reminderDaysBefore: l.reminderDaysBefore,
      },
      today,
    );
    if (!due) continue;

    const remaining = Math.max(0, l.principalPaisa - (paidByLoan.get(l.id) ?? 0));
    // A loan the ledger says is fully repaid needs no reminder, even if nobody
    // ticked "settled".
    if (remaining <= 0) continue;

    candidates.push({
      loanId: l.id,
      userId: l.userId,
      name: l.name,
      lender: l.lender,
      installmentPaisa: l.installmentPaisa,
      remainingPaisa: remaining,
      dueDate: due,
      isInstallment: !l.dueDate && l.dueDay !== null,
    });
  }

  if (!candidates.length) {
    return { action: "skipped", reason: "nothing-due", detail: today };
  }

  // Drop the ones already sent. The unique index still backstops this.
  const already = await db
    .select({ loanId: loanRemindersSent.loanId, dueDate: loanRemindersSent.dueDate })
    .from(loanRemindersSent)
    .where(inArray(loanRemindersSent.loanId, candidates.map((c) => c.loanId)));

  const sentKeys = new Set(already.map((a) => `${a.loanId}|${a.dueDate}`));
  const pending = candidates.filter((c) => !sentKeys.has(`${c.loanId}|${c.dueDate}`));

  if (!pending.length) {
    return { action: "skipped", reason: "already-sent", detail: today };
  }

  const emails = await recipientEmails(pending.map((p) => p.userId));

  if (dryRun) {
    for (const p of pending) {
      console.log(
        `would email ${emails.get(p.userId)?.email ?? "<no address>"}: ` +
          `${p.name} due ${p.dueDate} (${daysBetween(today, p.dueDate)} days)`,
      );
    }
    return { action: "sent", sent: 0, failed: 0, considered: pending.length, date: today };
  }

  const [run] = await db
    .insert(syncRuns)
    .values({ job: "loan-reminders", status: "running", trigger: runTrigger() })
    .returning({ id: syncRuns.id });

  let sent = 0;
  let failed = 0;

  for (const p of pending) {
    const to = emails.get(p.userId);
    if (!to?.email) {
      failed++;
      continue;
    }

    try {
      const mail = renderReminder(p, to.name, today);
      await sendEmail({ to: to.email, toName: to.name, ...mail });

      // Written only after the send succeeded. If this insert fails the user got
      // one email and may get one more tomorrow — the tolerable direction to
      // fail, versus recording a send that never happened and going silent.
      await db.insert(loanRemindersSent).values({
        userId: p.userId,
        loanId: p.loanId,
        dueDate: p.dueDate,
      });
      sent++;
    } catch (e) {
      failed++;
      console.error(`reminder failed for loan ${p.loanId}:`, (e as Error).message);
    }
  }

  await db
    .update(syncRuns)
    .set({
      status: failed && !sent ? "error" : "ok",
      rowsWritten: sent,
      error: failed ? `${failed} failed` : null,
      finishedAt: new Date(),
    })
    .where(eq(syncRuns.id, run.id));

  return { action: "sent", sent, failed, considered: pending.length, date: today };
}

/**
 * Addresses live in auth.users, which PostgREST does not expose — this job
 * reaches them only because it connects as `postgres`. The display name comes
 * from `profiles`, falling back to the metadata captured at sign-up.
 */
async function recipientEmails(userIds: string[]) {
  const rows = (await db.execute(
    raw`select u.id, u.email, coalesce(p.full_name, u.raw_user_meta_data->>'full_name') as name
        from auth.users u
        left join ${profiles} p on p.user_id = u.id
        where u.id = any(${userIds}::uuid[])`,
  )) as unknown as { id: string; email: string | null; name: string | null }[];

  return new Map(rows.map((r) => [r.id, { email: r.email, name: r.name }]));
}

function renderReminder(c: Candidate, name: string | null, today: string) {
  const days = daysBetween(today, c.dueDate);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;

  const amount = c.isInstallment && c.installmentPaisa
    ? `PKR ${paisaFull(c.installmentPaisa)}`
    : `PKR ${paisaFull(c.remainingPaisa)}`;

  const what = c.isInstallment ? "installment" : "repayment";
  const subject = `${c.name}: ${amount} due ${when}`;
  const greeting = name ? `Assalam-o-alaikum ${name},` : "Assalam-o-alaikum,";
  const toWhom = c.lender ? ` to ${c.lender}` : "";

  const text = [
    greeting,
    "",
    `Your ${what} on ${c.name} is due ${when}, on ${c.dueDate}.`,
    "",
    `Amount:      ${amount}${toWhom}`,
    `Outstanding: PKR ${paisaFull(c.remainingPaisa)}`,
    "",
    "Once you have paid, log it in PakFinance so the outstanding balance stays right.",
    "",
    "— PakFinance",
    "You are getting this because you set a reminder on this loan. Turn it off in the loan's settings.",
  ].join("\n");

  // Inline styles and a table: every email client strips <style> blocks, and
  // more than one of them still does not do flexbox.
  const html = `
<div style="background:#0A0B0D;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#111318;border:1px solid #23262D;border-radius:16px">
    <tr><td style="padding:28px 28px 20px">
      <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#C9A227;font-weight:600">PakFinance</div>
      <h1 style="margin:14px 0 0;font-size:19px;line-height:1.35;color:#F4F2EE;font-weight:600">
        ${escapeHtml(c.name)} is due ${when}
      </h1>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.6;color:#A7ADBA">
        ${escapeHtml(greeting)} your ${what} falls due on
        <strong style="color:#F4F2EE">${c.dueDate}</strong>${escapeHtml(toWhom)}.
      </p>
    </td></tr>
    <tr><td style="padding:0 28px">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-top:1px solid #23262D;border-bottom:1px solid #23262D">
        <tr>
          <td style="padding:16px 0;font-size:13px;color:#A7ADBA">Amount due</td>
          <td style="padding:16px 0;font-size:18px;color:#F4F2EE;font-weight:600;text-align:right">${amount}</td>
        </tr>
        <tr>
          <td style="padding:0 0 16px;font-size:13px;color:#A7ADBA">Outstanding after this</td>
          <td style="padding:0 0 16px;font-size:13px;color:#A7ADBA;text-align:right">PKR ${paisaFull(c.remainingPaisa)}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding:20px 28px 28px">
      <p style="margin:0;font-size:13px;line-height:1.6;color:#A7ADBA">
        Once you have paid, log it in PakFinance so your outstanding balance stays right.
      </p>
      <p style="margin:18px 0 0;font-size:11px;line-height:1.6;color:#6B7280">
        You are getting this because you set a reminder on this loan.
        Turn it off in the loan's settings.
      </p>
    </td></tr>
  </table>
</div>`.trim();

  return { subject, html, text };
}

/** Loan and lender names are user input and go straight into the HTML body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
