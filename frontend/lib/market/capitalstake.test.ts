import { describe, expect, it } from "vitest";
import { planNavWrites, type CsFund, type CsNav, type LocalFund } from "@/lib/market/capitalstake";

const fund = (id: string, name: string, symbol = ""): CsFund => ({
  id,
  name,
  symbol,
  amc_id: "amc",
});
const nav = (fundId: string, date: string, value: number): CsNav => ({
  date,
  fund_id: fundId,
  nav: value,
});

describe("planNavWrites", () => {
  it("writes a NAV when exactly one local fund matches by name", () => {
    const report = planNavWrites(
      [fund("p1", "ABL Cash Fund")],
      [nav("p1", "2026-08-17", 12.3456)],
      [{ id: "l1", name: "ABL Cash Fund" }],
    );
    expect(report.writes).toEqual([{ fundId: "l1", nav: 12.3456, sessionDate: "2026-08-17" }]);
    expect(report.ambiguous).toEqual([]);
  });

  it("matches regardless of case and internal whitespace", () => {
    const report = planNavWrites(
      [fund("p1", "  ABL   CASH   fund ")],
      [nav("p1", "2026-08-17", 10)],
      [{ id: "l1", name: "ABL Cash Fund" }],
    );
    expect(report.writes).toHaveLength(1);
  });

  /**
   * The reason this function exists. Eight names in the real catalogue are
   * shared by several sub-plans, and picking one would misvalue a holding
   * invisibly.
   */
  it("refuses to write when a name matches more than one local fund", () => {
    const locals: LocalFund[] = [
      { id: "eq", name: "Meezan Tahaffuz Pension Fund" },
      { id: "dt", name: "Meezan Tahaffuz Pension Fund" },
      { id: "mm", name: "Meezan Tahaffuz Pension Fund" },
    ];
    const report = planNavWrites(
      [fund("p1", "Meezan Tahaffuz Pension Fund")],
      [nav("p1", "2026-08-17", 88)],
      locals,
    );
    expect(report.writes).toEqual([]);
    expect(report.ambiguous).toEqual(["Meezan Tahaffuz Pension Fund"]);
  });

  it("reports an ambiguous name once, not once per quote", () => {
    const locals = [
      { id: "a", name: "Atlas Pension Fund" },
      { id: "b", name: "Atlas Pension Fund" },
    ];
    const report = planNavWrites(
      [fund("p1", "Atlas Pension Fund")],
      [nav("p1", "2026-08-16", 10), nav("p1", "2026-08-17", 11)],
      locals,
    );
    expect(report.ambiguous).toEqual(["Atlas Pension Fund"]);
  });

  it("ignores a NAV whose fund is absent from the provider catalogue", () => {
    const report = planNavWrites([], [nav("ghost", "2026-08-17", 10)], [{ id: "l1", name: "X" }]);
    expect(report.writes).toEqual([]);
  });

  it("counts provider funds we do not hold, without failing", () => {
    // They list the whole market; we seed a subset. Not an error.
    const report = planNavWrites(
      [fund("p1", "Some Fund We Lack")],
      [nav("p1", "2026-08-17", 10)],
      [{ id: "l1", name: "Different Fund" }],
    );
    expect(report.writes).toEqual([]);
    expect(report.unmatchedProvider).toBe(1);
  });

  it("counts an unmatched provider fund once across many dates", () => {
    const report = planNavWrites(
      [fund("p1", "Absent Fund")],
      [nav("p1", "2026-08-16", 9), nav("p1", "2026-08-17", 10)],
      [{ id: "l1", name: "Other" }],
    );
    expect(report.unmatchedProvider).toBe(1);
  });

  it("lists local funds the feed never covered, so gaps are visible", () => {
    const report = planNavWrites(
      [fund("p1", "Covered Fund")],
      [nav("p1", "2026-08-17", 10)],
      [
        { id: "l1", name: "Covered Fund" },
        { id: "l2", name: "Never Quoted Fund" },
      ],
    );
    expect(report.unmatchedLocal).toEqual(["Never Quoted Fund"]);
  });

  it("drops a non-positive or non-finite NAV", () => {
    // A zero NAV would value a holding at nothing and look like a real crash.
    const report = planNavWrites(
      [fund("p1", "F")],
      [nav("p1", "2026-08-17", 0), nav("p1", "2026-08-16", -1), nav("p1", "2026-08-15", NaN)],
      [{ id: "l1", name: "F" }],
    );
    expect(report.writes).toEqual([]);
  });

  it("keeps one write per date for a multi-day range", () => {
    const report = planNavWrites(
      [fund("p1", "F")],
      [nav("p1", "2026-08-15", 10), nav("p1", "2026-08-16", 11), nav("p1", "2026-08-17", 12)],
      [{ id: "l1", name: "F" }],
    );
    expect(report.writes.map((w) => w.sessionDate)).toEqual([
      "2026-08-15",
      "2026-08-16",
      "2026-08-17",
    ]);
  });

  it("handles an empty feed without throwing", () => {
    const report = planNavWrites([], [], []);
    expect(report).toEqual({
      writes: [],
      ambiguous: [],
      unmatchedProvider: 0,
      unmatchedLocal: [],
    });
  });
});
