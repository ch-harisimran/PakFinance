/**
 * Recurring entries: when is the next one due, and what is owed since we last
 * looked.
 *
 * Pure date arithmetic. The job that posts them is thin on purpose — everything
 * that could be wrong lives here, where it can be tested without waiting for
 * the first of the month.
 *
 * The hard requirement is that a rule NEVER posts the same period twice. That is
 * enforced two ways: `lastPostedOn` narrows the window, and the caller writes it
 * back after each post. Charging somebody's rent twice is the failure that would
 * make the feature not worth having.
 */

export type Cadence = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface RecurringRule {
  cadence: Cadence;
  /** 1–31 for monthly and longer; 0–6 (Sunday first) for weekly. */
  dayOfPeriod: number;
  startDate: string;
  endDate?: string | null;
  lastPostedOn?: string | null;
  isActive: boolean;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(`${s}T00:00:00Z`);
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

/**
 * The first occurrence on or after `from`.
 *
 * Monthly and longer clamp to the end of a short month, so a rule set for the
 * 31st falls due on the 30th in November and the 28th in February rather than
 * skipping those months entirely.
 */
export function nextOccurrence(rule: RecurringRule, from: string): string {
  const start = rule.startDate > from ? rule.startDate : from;

  if (rule.cadence === "WEEKLY") {
    const d = parse(start);
    const target = ((rule.dayOfPeriod % 7) + 7) % 7;
    const shift = (target - d.getUTCDay() + 7) % 7;
    d.setUTCDate(d.getUTCDate() + shift);
    return iso(d);
  }

  const step = rule.cadence === "MONTHLY" ? 1 : rule.cadence === "QUARTERLY" ? 3 : 12;
  const d = parse(start);
  let year = d.getUTCFullYear();
  let month = d.getUTCMonth();

  // Anchor the cycle to the start month so a quarterly rule lands on the same
  // months every year rather than drifting with whenever it was last checked.
  const anchor = parse(rule.startDate);
  const monthsSince = (year - anchor.getUTCFullYear()) * 12 + (month - anchor.getUTCMonth());
  const offset = ((monthsSince % step) + step) % step;
  if (offset !== 0) {
    month += step - offset;
    year += Math.floor(month / 12);
    month %= 12;
  }

  for (let guard = 0; guard < 64; guard++) {
    const day = Math.min(rule.dayOfPeriod, daysInMonth(year, month));
    const candidate = iso(new Date(Date.UTC(year, month, day)));
    if (candidate >= start) return candidate;

    month += step;
    year += Math.floor(month / 12);
    month %= 12;
  }

  return start;
}

/**
 * Every occurrence that has fallen due but not yet been posted, oldest first.
 *
 * Returns a list rather than a single date so a rule that has not run for three
 * months catches up correctly instead of silently losing two of them.
 */
export function duePostings(rule: RecurringRule, today: string, limit = 24): string[] {
  if (!rule.isActive) return [];

  // Start the day after the last post; otherwise the same period is emitted
  // again every time the job runs.
  const from = rule.lastPostedOn
    ? iso(new Date(parse(rule.lastPostedOn).getTime() + 864e5))
    : rule.startDate;

  const out: string[] = [];
  let cursor = from;

  for (let guard = 0; guard < limit; guard++) {
    const next = nextOccurrence(rule, cursor);
    if (next > today) break;
    if (rule.endDate && next > rule.endDate) break;

    out.push(next);
    cursor = iso(new Date(parse(next).getTime() + 864e5));
  }

  return out;
}

/** Human summary for the rule list: "Monthly on the 5th". */
export function describeCadence(rule: Pick<RecurringRule, "cadence" | "dayOfPeriod">): string {
  if (rule.cadence === "WEEKLY") {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return `Weekly on ${days[((rule.dayOfPeriod % 7) + 7) % 7]}`;
  }

  const d = rule.dayOfPeriod;
  const suffix = d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th";
  const every =
    rule.cadence === "MONTHLY" ? "Monthly" : rule.cadence === "QUARTERLY" ? "Quarterly" : "Yearly";

  return `${every} on the ${d}${suffix}`;
}
