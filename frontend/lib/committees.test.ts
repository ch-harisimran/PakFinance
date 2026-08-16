import { describe, expect, it } from "vitest";
import {
  committeePosition,
  committeeBalanceSheet,
  monthsBetween,
  addMonths,
  type Committee,
} from "@/lib/committees";

const P = (rupees: number) => Math.round(rupees * 100);

const committee: Committee = {
  members: 12,
  monthlyPaisa: P(25_000),
  startMonth: "2026-01-05",
  payoutPosition: 6,
  payoutReceived: false,
  isSettled: false,
};

describe("month arithmetic", () => {
  it("counts whole calendar months", () => {
    expect(monthsBetween("2026-01-05", "2026-01-20")).toBe(0);
    expect(monthsBetween("2026-01-05", "2026-03-01")).toBe(2);
    expect(monthsBetween("2026-01-05", "2027-01-05")).toBe(12);
  });

  it("adds months, clamping to short ones", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
  });
});

describe("committeePosition", () => {
  it("counts the start month as the first round", () => {
    // A committee beginning this month has one contribution due, not zero.
    const p = committeePosition(committee, 0, "2026-01-10");
    expect(p.roundsElapsed).toBe(1);
    expect(p.dueToDatePaisa).toBe(P(25_000));
  });

  it("computes the pot from members and monthly amount", () => {
    const p = committeePosition(committee, 0, "2026-01-10");
    expect(p.potPaisa).toBe(P(300_000));
  });

  it("tracks arrears against the schedule", () => {
    const p = committeePosition(committee, P(50_000), "2026-03-10");

    expect(p.roundsElapsed).toBe(3);
    expect(p.dueToDatePaisa).toBe(P(75_000));
    expect(p.arrearsPaisa).toBe(P(25_000));
  });

  it("reports no arrears when paid ahead", () => {
    const p = committeePosition(committee, P(100_000), "2026-02-10");
    expect(p.arrearsPaisa).toBe(0);
  });

  it("stops counting rounds once the committee has run its length", () => {
    const p = committeePosition(committee, P(300_000), "2028-01-01");

    expect(p.roundsElapsed).toBe(12);
    expect(p.roundsRemaining).toBe(0);
    expect(p.dueToDatePaisa).toBe(P(300_000));
  });

  describe("before your turn", () => {
    it("is money owed to you", () => {
      const p = committeePosition(committee, P(75_000), "2026-03-10");

      // Paid in, nothing back yet: the committee owes you.
      expect(p.receivedPaisa).toBe(0);
      expect(p.netPaisa).toBe(P(75_000));
    });
  });

  describe("after your turn", () => {
    it("becomes money you owe", () => {
      const taken: Committee = { ...committee, payoutReceived: true };
      const p = committeePosition(taken, P(150_000), "2026-06-10");

      expect(p.receivedPaisa).toBe(P(300_000));
      // Taken the whole pot having paid in half of it: you are behind by the
      // difference until the remaining months are paid.
      expect(p.netPaisa).toBe(P(150_000) - P(300_000));
      expect(p.netPaisa).toBeLessThan(0);
    });

    it("evens out by the end", () => {
      const taken: Committee = { ...committee, payoutReceived: true };
      const p = committeePosition(taken, P(300_000), "2026-12-10");

      // Paid in the full pot and taken the full pot: square.
      expect(p.netPaisa).toBe(0);
      expect(p.roundsRemaining).toBe(0);
    });
  });

  it("estimates the payout month from the draw position", () => {
    const p = committeePosition(committee, 0, "2026-01-10");
    // Position 6 of a committee starting in January is June.
    expect(p.payoutMonth).toBe("2026-06-05");
  });

  it("has no payout month before the draw", () => {
    const undrawn: Committee = { ...committee, payoutPosition: null };
    expect(committeePosition(undrawn, 0, "2026-01-10").payoutMonth).toBeNull();
  });
});

describe("committeeBalanceSheet", () => {
  it("files un-collected contributions as an asset and post-payout obligations as a liability", () => {
    const saving = committeePosition(committee, P(75_000), "2026-03-10");
    const repaying = committeePosition(
      { ...committee, payoutReceived: true },
      P(150_000),
      "2026-06-10",
    );

    const sheet = committeeBalanceSheet([saving, repaying], [false, true]);

    // Money in but not yet collected is coming back to you.
    expect(sheet.assetPaisa).toBe(P(75_000));
    // Having taken the pot, the months still to pay are a real obligation.
    expect(sheet.liabilityPaisa).toBe(repaying.remainingPaisa);
  });

  it("is zero for no committees", () => {
    expect(committeeBalanceSheet([], [])).toEqual({ assetPaisa: 0, liabilityPaisa: 0 });
  });
});
