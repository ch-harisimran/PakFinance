import { describe, expect, it } from "vitest";
import { nextMonthlyDue, daysBetween, reminderDueFor, type DueLoan } from "@/lib/notify/due-dates";

/**
 * Reminder timing.
 *
 * This decides whether a real email goes to a real person about a real payment.
 * It fires once a month at most, so a bug here can hide for weeks and then
 * either spam somebody or — worse — stay silent through a missed installment.
 *
 * Previously a standalone script; folded into the suite so it runs on every
 * change rather than when someone remembers.
 */

const monthly: DueLoan = {
  dueDay: 5,
  dueDate: null,
  isSettled: false,
  reminderEnabled: true,
  reminderDaysBefore: 3,
};

describe("nextMonthlyDue", () => {
  it("finds the due day later this month", () => {
    expect(nextMonthlyDue(5, "2026-08-01")).toBe("2026-08-05");
  });

  it("counts today as still due", () => {
    expect(nextMonthlyDue(5, "2026-08-05")).toBe("2026-08-05");
  });

  it("rolls to next month once the day has passed", () => {
    expect(nextMonthlyDue(5, "2026-08-06")).toBe("2026-09-05");
  });

  it("clamps to the last day of a short month", () => {
    // A loan due on the 31st is due on the 30th in November, which is how the
    // bank treats it. Rolling into December would skip a payment entirely.
    expect(nextMonthlyDue(31, "2026-11-01")).toBe("2026-11-30");
    expect(nextMonthlyDue(31, "2027-02-01")).toBe("2027-02-28");
    expect(nextMonthlyDue(31, "2028-02-01")).toBe("2028-02-29");
    expect(nextMonthlyDue(30, "2026-01-31")).toBe("2026-02-28");
  });

  it("crosses the year boundary", () => {
    expect(nextMonthlyDue(5, "2026-12-06")).toBe("2027-01-05");
  });
});

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween("2026-08-16", "2026-08-16")).toBe(0);
    expect(daysBetween("2026-08-16", "2026-08-19")).toBe(3);
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3);
  });

  it("goes negative once the date has passed", () => {
    expect(daysBetween("2026-08-16", "2026-08-14")).toBe(-2);
  });
});

describe("reminderDueFor", () => {
  it("stays quiet before the notice window opens", () => {
    expect(reminderDueFor(monthly, "2026-09-01")).toBeNull();
  });

  it("fires on the lead day and every day up to the due date", () => {
    expect(reminderDueFor(monthly, "2026-09-02")).toBe("2026-09-05");
    expect(reminderDueFor(monthly, "2026-09-04")).toBe("2026-09-05");
    expect(reminderDueFor(monthly, "2026-09-05")).toBe("2026-09-05");
  });

  it("keeps firing after a missed day, because the ledger stops repeats", () => {
    // The window is deliberately not a single day: a job that failed to run on
    // exactly the right morning should still send a late reminder. Sending
    // twice is prevented by loan_reminders_sent, not by narrowing this.
    const windowDays = ["2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"];
    for (const day of windowDays) {
      expect(reminderDueFor(monthly, day)).toBe("2026-09-05");
    }
  });

  it("rolls forward once the date passes", () => {
    expect(reminderDueFor(monthly, "2026-09-06")).toBeNull();
  });

  it("honours zero notice as on-the-day only", () => {
    const sameDay = { ...monthly, reminderDaysBefore: 0 };
    expect(reminderDueFor(sameDay, "2026-09-04")).toBeNull();
    expect(reminderDueFor(sameDay, "2026-09-05")).toBe("2026-09-05");
  });

  it("says nothing when the reminder is off", () => {
    expect(reminderDueFor({ ...monthly, reminderEnabled: false }, "2026-09-02")).toBeNull();
  });

  it("says nothing once the loan is settled", () => {
    expect(reminderDueFor({ ...monthly, isSettled: true }, "2026-09-02")).toBeNull();
  });

  it("says nothing when no date is set at all", () => {
    expect(reminderDueFor({ ...monthly, dueDay: null, dueDate: null }, "2026-09-02")).toBeNull();
  });

  describe("one-off loans", () => {
    const once: DueLoan = {
      dueDay: null,
      dueDate: "2026-10-20",
      isSettled: false,
      reminderEnabled: true,
      reminderDaysBefore: 7,
    };

    it("waits for the notice window", () => {
      expect(reminderDueFor(once, "2026-10-12")).toBeNull();
      expect(reminderDueFor(once, "2026-10-13")).toBe("2026-10-20");
      expect(reminderDueFor(once, "2026-10-20")).toBe("2026-10-20");
    });

    it("never fires again once the date has gone", () => {
      // Unlike a monthly loan there is no next occurrence to roll to.
      expect(reminderDueFor(once, "2026-10-21")).toBeNull();
      expect(reminderDueFor(once, "2027-01-01")).toBeNull();
    });
  });
});
