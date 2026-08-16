/** Temporary: exercise the reminder date arithmetic. No database, no email. */
import { nextMonthlyDue, daysBetween, reminderDueFor } from "../lib/notify/due-dates";

let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${String(actual)}${ok ? "" : ` (expected ${String(expected)})`}`);
}

console.log("--- nextMonthlyDue ---");
check("due 5th, today the 1st", nextMonthlyDue(5, "2026-08-01"), "2026-08-05");
check("due 5th, today the 5th (today counts)", nextMonthlyDue(5, "2026-08-05"), "2026-08-05");
check("due 5th, today the 6th -> next month", nextMonthlyDue(5, "2026-08-06"), "2026-09-05");
check("due 31st in a 30-day month", nextMonthlyDue(31, "2026-11-01"), "2026-11-30");
check("due 31st, February", nextMonthlyDue(31, "2027-02-01"), "2027-02-28");
check("due 31st, leap February", nextMonthlyDue(31, "2028-02-01"), "2028-02-29");
check("December rolls into January", nextMonthlyDue(5, "2026-12-06"), "2027-01-05");
check("due 30th, Jan 31 -> February", nextMonthlyDue(30, "2026-01-31"), "2026-02-28");

console.log("\n--- daysBetween ---");
check("same day", daysBetween("2026-08-16", "2026-08-16"), 0);
check("three days", daysBetween("2026-08-16", "2026-08-19"), 3);
check("across a month", daysBetween("2026-08-30", "2026-09-02"), 3);
check("past date is negative", daysBetween("2026-08-16", "2026-08-14"), -2);

console.log("\n--- reminderDueFor ---");
const monthly = {
  dueDay: 5,
  dueDate: null,
  isSettled: false,
  reminderEnabled: true,
  reminderDaysBefore: 3,
};

check("4 days out -> too early", reminderDueFor(monthly, "2026-09-01"), null);
check("exactly 3 days out -> fires", reminderDueFor(monthly, "2026-09-02"), "2026-09-05");
check("1 day out -> still fires", reminderDueFor(monthly, "2026-09-04"), "2026-09-05");
check("on the day -> fires", reminderDueFor(monthly, "2026-09-05"), "2026-09-05");
check(
  "day after -> rolls to next month, too early",
  reminderDueFor(monthly, "2026-09-06"),
  null,
);
check("reminder off", reminderDueFor({ ...monthly, reminderEnabled: false }, "2026-09-02"), null);
check("loan settled", reminderDueFor({ ...monthly, isSettled: true }, "2026-09-02"), null);
check(
  "zero notice fires only on the day",
  reminderDueFor({ ...monthly, reminderDaysBefore: 0 }, "2026-09-04"),
  null,
);
check(
  "zero notice, on the day",
  reminderDueFor({ ...monthly, reminderDaysBefore: 0 }, "2026-09-05"),
  "2026-09-05",
);

const once = {
  dueDay: null,
  dueDate: "2026-10-20",
  isSettled: false,
  reminderEnabled: true,
  reminderDaysBefore: 7,
};
check("one-off, 8 days out -> too early", reminderDueFor(once, "2026-10-12"), null);
check("one-off, 7 days out -> fires", reminderDueFor(once, "2026-10-13"), "2026-10-20");
check("one-off, on the day", reminderDueFor(once, "2026-10-20"), "2026-10-20");
check("one-off, past -> never again", reminderDueFor(once, "2026-10-21"), null);
check(
  "no dates at all",
  reminderDueFor({ ...monthly, dueDay: null, dueDate: null }, "2026-09-02"),
  null,
);

console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
