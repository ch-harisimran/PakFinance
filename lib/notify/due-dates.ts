/**
 * When is this loan's next repayment?
 *
 * Pure date arithmetic, no database and no clock of its own — `today` is always
 * passed in. That is what lets the reminder job be reasoned about without
 * waiting for the 5th of next month to find out whether it works.
 *
 * All dates are plain YYYY-MM-DD strings in Pakistan Standard Time. PKT is
 * UTC+5 with no daylight saving, which is why a date string is enough here and
 * a timestamp would only invite timezone bugs.
 */

export interface DueLoan {
  dueDay: number | null;
  dueDate: string | null;
  isSettled: boolean;
  reminderEnabled: boolean;
  reminderDaysBefore: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Days in a given month, month being 0-indexed. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The next occurrence of a day-of-month on or after `today`.
 *
 * Clamped to the month's length, so a loan due on the 31st falls due on the 30th
 * in November and the 28th in February rather than silently rolling into the
 * next month — which is how the bank treats it too.
 */
export function nextMonthlyDue(dueDay: number, today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const year = y;
  const month = m - 1;

  const thisMonth = Math.min(dueDay, daysInMonth(year, month));
  if (thisMonth >= d) return iso(year, month, thisMonth);

  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  return iso(nextYear, nextMonth, Math.min(dueDay, daysInMonth(nextYear, nextMonth)));
}

/** Whole numbers of days between two YYYY-MM-DD strings. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / 864e5);
}

/**
 * The repayment date this loan should be reminded about, or null if none is due
 * for a reminder today.
 *
 * A one-off loan (`dueDate`) is reminded once and then never again — once that
 * date has passed there is nothing left to remind about. A monthly loan
 * (`dueDay`) rolls forward every month until the loan is settled.
 */
export function reminderDueFor(loan: DueLoan, today: string): string | null {
  if (!loan.reminderEnabled || loan.isSettled) return null;

  const due = loan.dueDate ?? (loan.dueDay ? nextMonthlyDue(loan.dueDay, today) : null);
  if (!due) return null;

  const lead = daysBetween(today, due);

  // Fire on the lead day, and keep firing up to the due date itself: a job that
  // failed to run on exactly the right morning should still send a late
  // reminder rather than skip the month entirely. The sent-ledger stops it
  // repeating once one has gone out.
  if (lead < 0 || lead > loan.reminderDaysBefore) return null;
  return due;
}
