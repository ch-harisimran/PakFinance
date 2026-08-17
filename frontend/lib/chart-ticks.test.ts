import { describe, expect, it } from "vitest";
import { niceScale } from "@/lib/chart-ticks";

describe("niceScale", () => {
  it("labels the real net-worth range with round steps", () => {
    // 0 → 31,848,000 paisa: the span of the first two snapshots.
    const s = niceScale(0, 31_848_000);
    expect(s.ticks).toEqual([0, 10_000_000, 20_000_000, 30_000_000, 40_000_000]);
  });

  it("brackets the data rather than clipping it", () => {
    const s = niceScale(1234, 98_765);
    expect(s.lo).toBeLessThanOrEqual(1234);
    expect(s.hi).toBeGreaterThanOrEqual(98_765);
  });

  it("gives an awkward range a usable number of ticks", () => {
    // The round-up-only version produced exactly one tick here, which is not an
    // axis. This is the regression that motivated choosing the closest step.
    expect(niceScale(1234, 98_765).ticks.length).toBeGreaterThanOrEqual(4);
  });

  it("puts the first and last tick exactly on the plot bounds", () => {
    const s = niceScale(0, 31_848_000);
    expect(s.ticks[0]).toBe(s.lo);
    expect(s.ticks.at(-1)).toBe(s.hi);
  });

  it("is ascending and evenly spaced", () => {
    const s = niceScale(-3000, 3000);
    for (let i = 1; i < s.ticks.length; i++) {
      expect(s.ticks[i] - s.ticks[i - 1]).toBeCloseTo(s.step, 6);
    }
  });

  it("labels zero when the range straddles it", () => {
    // Net worth can be negative; the axis must show where the line crosses.
    expect(niceScale(-3000, 3000).ticks).toContain(0);
  });

  it("handles a wholly negative range", () => {
    const s = niceScale(-50_000, -1000);
    expect(s.lo).toBeLessThanOrEqual(-50_000);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("gives a flat series a plot to sit in the middle of", () => {
    const s = niceScale(500, 500);
    expect(s.lo).toBeLessThan(500);
    expect(s.hi).toBeGreaterThan(500);
    expect(s.ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("never subdivides below a whole paisa", () => {
    for (const [lo, hi] of [[0, 3], [0, 0.4], [0, 1]] as [number, number][]) {
      const s = niceScale(lo, hi);
      expect(s.step).toBeGreaterThanOrEqual(1);
      for (const t of s.ticks) expect(Number.isInteger(t)).toBe(true);
    }
  });

  it("keeps the tick count in a legible band across magnitudes", () => {
    for (const hi of [50, 5_000, 500_000, 50_000_000, 98_765_432_109]) {
      const s = niceScale(0, hi);
      expect(s.ticks.length).toBeGreaterThanOrEqual(2);
      expect(s.ticks.length).toBeLessThanOrEqual(9);
      expect(s.hi).toBeGreaterThanOrEqual(hi);
    }
  });

  it("survives non-finite input instead of emitting NaN ticks", () => {
    for (const s of [niceScale(NaN, 10), niceScale(0, Infinity)]) {
      expect(s.ticks.every((t) => Number.isFinite(t))).toBe(true);
      expect(s.ticks.length).toBeGreaterThanOrEqual(2);
    }
  });
});
