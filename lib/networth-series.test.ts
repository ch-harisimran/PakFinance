import { describe, expect, it } from "vitest";
import { withLiveToday } from "@/lib/networth-series";

const p = (date: string, valuePaisa: number) => ({ date, valuePaisa });

describe("withLiveToday", () => {
  it("appends today when the job has not run yet", () => {
    const series = [p("2026-08-15", 1000), p("2026-08-16", 2000)];
    expect(withLiveToday(series, "2026-08-17", 3000)).toEqual([
      p("2026-08-15", 1000),
      p("2026-08-16", 2000),
      p("2026-08-17", 3000),
    ]);
  });

  it("replaces today's snapshot rather than adding a second point for it", () => {
    // The 13:30 job wrote 2000; the user then entered an asset worth 500 more.
    const series = [p("2026-08-16", 1000), p("2026-08-17", 2000)];
    const merged = withLiveToday(series, "2026-08-17", 2500);

    expect(merged).toHaveLength(2);
    expect(merged.at(-1)).toEqual(p("2026-08-17", 2500));
  });

  it("gives a brand-new account a single point, not a line", () => {
    // One point cannot be a chart, and NetWorthHero requires two before drawing.
    expect(withLiveToday([], "2026-08-17", 500)).toEqual([p("2026-08-17", 500)]);
  });

  it("turns one snapshot plus today into a drawable series", () => {
    expect(withLiveToday([p("2026-08-16", 100)], "2026-08-17", 200)).toHaveLength(2);
  });

  it("keeps history ascending with today last", () => {
    const series = [p("2026-08-10", 1), p("2026-08-11", 2), p("2026-08-12", 3)];
    const merged = withLiveToday(series, "2026-08-17", 9);
    const dates = merged.map((x) => x.date);
    expect(dates).toEqual([...dates].sort());
    expect(dates.at(-1)).toBe("2026-08-17");
  });

  it("drops a future-dated snapshot so the line cannot draw backwards", () => {
    const series = [p("2026-08-16", 100), p("2026-08-18", 999)];
    const merged = withLiveToday(series, "2026-08-17", 200);
    expect(merged.map((x) => x.date)).toEqual(["2026-08-16", "2026-08-17"]);
  });

  it("carries a negative net worth through unchanged", () => {
    // More debt than assets is a real state, not a bug to clamp at zero.
    expect(withLiveToday([], "2026-08-17", -4500).at(-1)?.valuePaisa).toBe(-4500);
  });

  it("does not mutate the input", () => {
    const series = [p("2026-08-17", 1)];
    const copy = structuredClone(series);
    withLiveToday(series, "2026-08-17", 2);
    expect(series).toEqual(copy);
  });
});
