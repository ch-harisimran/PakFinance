import { describe, expect, it } from "vitest";
import { nextOccurrence, duePostings, describeCadence, type RecurringRule } from "@/lib/recurring";

/**
 * Recurring entries.
 *
 * The requirement that matters: a rule must never post the same period twice.
 * Charging somebody's rent a second time would make the feature worse than not
 * having it, so the double-post cases are tested hardest.
 */

const monthly: RecurringRule = {
  cadence: "MONTHLY",
  dayOfPeriod: 5,
  startDate: "2026-01-05",
  isActive: true,
};

describe("nextOccurrence", () => {
  it("finds the day later this month", () => {
    expect(nextOccurrence(monthly, "2026-03-01")).toBe("2026-03-05");
  });

  it("counts today as due", () => {
    expect(nextOccurrence(monthly, "2026-03-05")).toBe("2026-03-05");
  });

  it("rolls to next month once the day has passed", () => {
    expect(nextOccurrence(monthly, "2026-03-06")).toBe("2026-04-05");
  });

  it("clamps to the last day of a short month", () => {
    const endOfMonth = { ...monthly, dayOfPeriod: 31, startDate: "2026-01-31" };
    expect(nextOccurrence(endOfMonth, "2026-02-01")).toBe("2026-02-28");
    expect(nextOccurrence(endOfMonth, "2026-04-01")).toBe("2026-04-30");
  });

  it("never runs before the rule starts", () => {
    expect(nextOccurrence(monthly, "2025-06-01")).toBe("2026-01-05");
  });

  it("keeps quarterly anchored to the start month", () => {
    const quarterly: RecurringRule = { ...monthly, cadence: "QUARTERLY" };
    // Jan start means Apr, Jul, Oct — not whenever the job happened to look.
    expect(nextOccurrence(quarterly, "2026-02-01")).toBe("2026-04-05");
    expect(nextOccurrence(quarterly, "2026-05-01")).toBe("2026-07-05");
  });

  it("handles yearly", () => {
    const yearly: RecurringRule = { ...monthly, cadence: "YEARLY" };
    expect(nextOccurrence(yearly, "2026-06-01")).toBe("2027-01-05");
  });

  it("finds the next matching weekday for weekly rules", () => {
    // 2026-01-05 is a Monday; dayOfPeriod 1 is Monday.
    const weekly: RecurringRule = { ...monthly, cadence: "WEEKLY", dayOfPeriod: 1 };
    expect(nextOccurrence(weekly, "2026-01-06")).toBe("2026-01-12");
    expect(nextOccurrence(weekly, "2026-01-12")).toBe("2026-01-12");
  });
});

describe("duePostings", () => {
  it("returns nothing before the first due date", () => {
    expect(duePostings(monthly, "2026-01-04")).toEqual([]);
  });

  it("returns the first occurrence once due", () => {
    expect(duePostings(monthly, "2026-01-05")).toEqual(["2026-01-05"]);
  });

  it("catches up every missed period, oldest first", () => {
    // A job that has not run for three months must post all three, not just the
    // most recent — the two older months are real money that happened.
    expect(duePostings(monthly, "2026-03-10")).toEqual([
      "2026-01-05",
      "2026-02-05",
      "2026-03-05",
    ]);
  });

  it("posts nothing more once the period is recorded", () => {
    const posted = { ...monthly, lastPostedOn: "2026-03-05" };
    expect(duePostings(posted, "2026-03-10")).toEqual([]);
  });

  it("does not re-post the recorded day itself", () => {
    // The guard: starting from lastPostedOn rather than the day after would
    // emit the same period on every run, charging rent daily.
    const posted = { ...monthly, lastPostedOn: "2026-02-05" };
    expect(duePostings(posted, "2026-02-05")).toEqual([]);
    expect(duePostings(posted, "2026-03-05")).toEqual(["2026-03-05"]);
  });

  it("stops at the end date", () => {
    const ending = { ...monthly, endDate: "2026-02-28" };
    expect(duePostings(ending, "2026-06-01")).toEqual(["2026-01-05", "2026-02-05"]);
  });

  it("posts nothing while paused", () => {
    expect(duePostings({ ...monthly, isActive: false }, "2026-06-01")).toEqual([]);
  });

  it("cannot run away, however long it has been left", () => {
    // A rule untouched for twenty years should not try to post 240 entries.
    const stale = { ...monthly, startDate: "2006-01-05" };
    expect(duePostings(stale, "2026-08-16").length).toBeLessThanOrEqual(24);
  });
});

describe("describeCadence", () => {
  it("reads as English", () => {
    expect(describeCadence({ cadence: "MONTHLY", dayOfPeriod: 1 })).toBe("Monthly on the 1st");
    expect(describeCadence({ cadence: "MONTHLY", dayOfPeriod: 5 })).toBe("Monthly on the 5th");
    expect(describeCadence({ cadence: "QUARTERLY", dayOfPeriod: 3 })).toBe("Quarterly on the 3rd");
    expect(describeCadence({ cadence: "WEEKLY", dayOfPeriod: 1 })).toBe("Weekly on Monday");
  });
});
