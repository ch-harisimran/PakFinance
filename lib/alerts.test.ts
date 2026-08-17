import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAlerts, daysUntil, type AlertInput } from "@/lib/alerts";

/**
 * What the app tells you needs attention.
 *
 * Feeds both the notification bell and the dashboard's "Needs you" panel, so a
 * bug here either nags about nothing or — the failure that actually costs money
 * — stays silent about an installment falling due.
 *
 * The clock is frozen: these assertions are about the rules, not about the day
 * the suite happens to run.
 */

const P = (rupees: number) => Math.round(rupees * 100);

function loan(over: Partial<AlertInput["loans"][number]> = {}): AlertInput["loans"][number] {
  return {
    id: "l1",
    name: "Car loan",
    lender: "Meezan Bank",
    installment_paisa: P(42_500),
    due_day: 20,
    due_date: null,
    remainingPaisa: P(1_180_000),
    ...over,
  };
}

function goal(over: Partial<AlertInput["goals"][number]> = {}): AlertInput["goals"][number] {
  return {
    id: "g1",
    name: "Emergency fund",
    onTrack: true,
    monthlyNeededPaisa: P(64_000),
    target_date: "2027-01-01",
    ...over,
  };
}

function freeze(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("daysUntil", () => {
  it("counts to the next occurrence of a day of month", () => {
    const now = new Date("2026-08-16T09:00:00");
    expect(daysUntil(20, now)).toBe(4);
  });

  it("rolls into next month once the day has passed", () => {
    const now = new Date("2026-08-25T09:00:00");
    expect(daysUntil(20, now)).toBeGreaterThan(20);
  });
});

describe("buildAlerts", () => {
  it("is empty when nothing needs attention", () => {
    freeze("2026-08-01T09:00:00");
    expect(buildAlerts({ loans: [], goals: [] })).toEqual([]);
  });

  describe("installments", () => {
    it("warns inside the two-week window", () => {
      freeze("2026-08-16T09:00:00");
      const [item] = buildAlerts({ loans: [loan()], goals: [] });

      expect(item.kind).toBe("due");
      expect(item.title).toBe("Car loan installment");
      expect(item.when).toBe("Due in 4 days");
      expect(item.detail).toContain("Meezan Bank");
    });

    it("stays quiet beyond two weeks", () => {
      // Further out it is not news, it is a calendar.
      freeze("2026-08-01T09:00:00");
      expect(buildAlerts({ loans: [loan()], goals: [] })).toEqual([]);
    });

    it("still shows on the due day itself, whatever the hour", () => {
      // Regression: comparing a midnight due date against the current time made
      // the alert roll to next month from 00:01 onwards, so it vanished from the
      // bell on the exact day the payment was owed.
      for (const hour of ["00:01", "09:00", "23:59"]) {
        freeze(`2026-08-20T${hour}:00`);
        const [item] = buildAlerts({ loans: [loan()], goals: [] });
        expect(item?.when).toBe("Due today");
      }
    });

    it("ignores a loan that is already repaid", () => {
      freeze("2026-08-16T09:00:00");
      expect(buildAlerts({ loans: [loan({ remainingPaisa: 0 })], goals: [] })).toEqual([]);
    });

    it("ignores a loan with no due day and no due date", () => {
      freeze("2026-08-16T09:00:00");
      expect(buildAlerts({ loans: [loan({ due_day: null })], goals: [] })).toEqual([]);
    });
  });

  describe("one-off repayments", () => {
    it("uses the whole outstanding amount, not an installment", () => {
      freeze("2026-08-16T09:00:00");
      const [item] = buildAlerts({
        loans: [loan({ due_day: null, due_date: "2026-08-20", installment_paisa: null })],
        goals: [],
      });

      expect(item.title).toBe("Car loan repayment");
      expect(item.detail).toContain("1,180,000");
    });

    it("flags an overdue repayment rather than hiding it", () => {
      // A date in the past is the most urgent case there is, so it stays on the
      // list instead of falling out of the window.
      freeze("2026-08-16T09:00:00");
      const [item] = buildAlerts({
        loans: [loan({ due_day: null, due_date: "2026-08-13", installment_paisa: null })],
        goals: [],
      });

      expect(item.when).toBe("Overdue by 3 days");
    });
  });

  describe("goals", () => {
    it("flags one that is behind pace", () => {
      freeze("2026-08-01T09:00:00");
      const [item] = buildAlerts({ loans: [], goals: [goal({ onTrack: false })] });

      expect(item.kind).toBe("goal");
      expect(item.title).toContain("behind schedule");
    });

    it("says nothing about a goal on pace", () => {
      freeze("2026-08-01T09:00:00");
      expect(buildAlerts({ loans: [], goals: [goal()] })).toEqual([]);
    });

    it("says nothing about a goal with no target date", () => {
      // Without a date there is no pace to be behind.
      freeze("2026-08-01T09:00:00");
      expect(buildAlerts({ loans: [], goals: [goal({ onTrack: false, target_date: null })] })).toEqual([]);
    });
  });

  describe("setup prompts", () => {
    it("appear only when counts are supplied", () => {
      freeze("2026-08-01T09:00:00");
      const withCounts = buildAlerts({
        loans: [],
        goals: [],
        counts: { accounts: 0, trades: 0, funds: 0, goals: 0 },
      });

      expect(withCounts.every((a) => a.kind === "setup")).toBe(true);
      expect(withCounts).toHaveLength(3);
    });

    it("are omitted entirely for the notification bell", () => {
      // "Add a bank account" is onboarding, not something new to be notified of.
      freeze("2026-08-01T09:00:00");
      expect(buildAlerts({ loans: [], goals: [] })).toEqual([]);
    });

    it("drop away once the thing exists", () => {
      freeze("2026-08-01T09:00:00");
      const items = buildAlerts({
        loans: [],
        goals: [],
        counts: { accounts: 2, trades: 4, funds: 1, goals: 1 },
      });

      expect(items).toEqual([]);
    });
  });
});
