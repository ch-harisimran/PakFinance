import { describe, expect, it } from "vitest";
import {
  toPaisa,
  fromPaisa,
  paisaFull,
  paisaCompact,
  formatFull,
  formatCompact,
  formatPct,
  formatSigned,
  axisMax,
} from "@/lib/money";

/**
 * Money formatting and conversion.
 *
 * `toPaisa` is the boundary between what a user types and what the database
 * stores. Everything downstream assumes integer paisa, so a rounding slip here
 * becomes a permanent error in someone's ledger.
 */

describe("toPaisa", () => {
  it("converts rupees to integer paisa", () => {
    expect(toPaisa(1)).toBe(100);
    expect(toPaisa(1234.56)).toBe(123_456);
  });

  it("survives the float cases that break naive multiplication", () => {
    // 19.99 * 100 is 1998.9999999999998 in IEEE 754. Truncating gives 1998 —
    // one paisa lost on every such amount, forever. Rounding is what saves it.
    expect(toPaisa(19.99)).toBe(1999);
    expect(toPaisa(0.07)).toBe(7);
    expect(toPaisa(8.29)).toBe(829);
    expect(toPaisa(1234.56)).toBe(123_456);
  });

  it("always yields an integer, whatever the input precision", () => {
    // Paisa is the smallest unit there is, so a third decimal place is not a
    // quantity of money and its rounding direction is not worth specifying.
    // What matters is that nothing fractional ever reaches a bigint column.
    for (const rupees of [1.005, 0.001, 99.999, 2.345]) {
      expect(Number.isInteger(toPaisa(rupees))).toBe(true);
    }
  });

  it("accepts strings, with or without grouping commas", () => {
    expect(toPaisa("1,250,000")).toBe(125_000_000);
    expect(toPaisa("42500.50")).toBe(4_250_050);
  });

  it("treats unparseable input as zero rather than NaN", () => {
    // NaN in a bigint column is a write failure at best and a corrupt total at
    // worst; zero is the only safe answer for a field the user left as junk.
    expect(toPaisa("")).toBe(0);
    expect(toPaisa("abc")).toBe(0);
    expect(toPaisa(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("handles negative amounts, which is how money out is stored", () => {
    expect(toPaisa(-2500)).toBe(-250_000);
  });

  it("round-trips through fromPaisa", () => {
    for (const rupees of [0, 1, 19.99, 1234.56, -87.05]) {
      expect(fromPaisa(toPaisa(rupees))).toBeCloseTo(rupees, 2);
    }
  });
});

describe("formatFull", () => {
  it("groups thousands and defaults to whole rupees", () => {
    expect(formatFull(2_450_059)).toBe("2,450,059");
  });

  it("honours a decimal count, for per-share prices", () => {
    expect(formatFull(218.4, 2)).toBe("218.40");
  });

  it("formats from paisa without the caller doing the division", () => {
    expect(paisaFull(245_005_900)).toBe("2,450,059");
    expect(paisaFull(21_840, 2)).toBe("218.40");
  });
});

describe("formatCompact", () => {
  it("abbreviates in international notation", () => {
    expect(formatCompact(2_450_058)).toBe("2.45M");
    expect(formatCompact(9_500)).toBe("9.5K");
  });

  it("abbreviates in lakh and crore for a subcontinental reader", () => {
    // 2,450,058 is 24.5 lakh. A Pakistani reader takes that in faster than
    // "2.45M", which is the whole point of the preference.
    expect(formatCompact(2_450_058, "subcontinental")).toBe("24.5L");
    expect(formatCompact(35_000_000, "subcontinental")).toBe("3.5Cr");
  });

  it("leaves small numbers alone in both notations", () => {
    expect(formatCompact(750)).toBe("750");
    expect(formatCompact(750, "subcontinental")).toBe("750");
  });

  it("marks negatives with a typographic minus, not a hyphen", () => {
    // U+2212 is deliberate: it is the width of a digit, so a column of figures
    // stays aligned. Asserted here so nobody "fixes" it back to a hyphen.
    expect(formatCompact(-2_450_058)).toBe("−2.45M");
  });

  it("formats from paisa", () => {
    expect(paisaCompact(245_005_800)).toBe("2.45M");
    expect(paisaCompact(245_005_800, "subcontinental")).toBe("24.5L");
  });
});

describe("formatPct", () => {
  it("signs movement so gain and loss never look alike", () => {
    expect(formatPct(12.34)).toBe("+12.34%");
    expect(formatPct(-4.5)).toBe("−4.50%");
  });

  it("leaves flat unsigned — no movement is not a gain", () => {
    expect(formatPct(0)).toBe("0.00%");
  });

  it("always shows two decimals, so widths do not jitter", () => {
    expect(formatPct(5)).toBe("+5.00%");
  });
});

describe("formatSigned", () => {
  it("marks direction on money in and out", () => {
    expect(formatSigned(25_000)).toBe("+25,000");
    expect(formatSigned(-25_000)).toBe("−25,000");
    expect(formatSigned(0)).toBe("0");
  });
});

describe("axisMax", () => {
  it("returns a round ceiling above the data", () => {
    const max = axisMax([120, 4_800, 9_100]);
    expect(max).toBeGreaterThanOrEqual(9_100);
  });

  it("does not return zero for an all-zero series", () => {
    // A zero axis maximum divides by zero when scaling bar heights.
    expect(axisMax([0, 0])).toBeGreaterThan(0);
  });

  it("handles an empty series", () => {
    expect(Number.isFinite(axisMax([]))).toBe(true);
  });
});
