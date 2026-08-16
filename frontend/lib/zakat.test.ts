import { describe, expect, it } from "vitest";
import { calculateZakat, nisabFrom, nextHawl, ZAKAT_RATE, type ZakatInput } from "@/lib/zakat";

/**
 * Zakat arithmetic.
 *
 * Held to a higher standard than the rest of the app: this is an act of worship,
 * and someone will pay real money on the strength of the number. The tests cover
 * the threshold behaviour especially, because "nisab is a threshold, not an
 * allowance" is the single easiest thing to get wrong.
 */

const P = (rupees: number) => Math.round(rupees * 100);

const base: ZakatInput = {
  cashPaisa: 0,
  stocksPaisa: 0,
  fundsPaisa: 0,
  otherAssetsPaisa: 0,
  receivablesPaisa: 0,
  committeesPaisa: 0,
  deductionsPaisa: 0,
  // ~PKR 30,000 per gram of gold, a plausible 2026 figure.
  metalPricePerGramPaisa: P(30_000),
  basis: "gold",
};

describe("nisabFrom", () => {
  it("uses 87.48g for gold", () => {
    expect(nisabFrom("gold", P(30_000))).toBe(Math.round(87.48 * P(30_000)));
  });

  it("uses 612.36g for silver", () => {
    expect(nisabFrom("silver", P(350))).toBe(Math.round(612.36 * P(350)));
  });

  it("puts the silver threshold well below the gold one at real prices", () => {
    // This is why the choice matters: silver nisab catches far more people, and
    // picking it for them would be deciding something that is theirs to decide.
    const gold = nisabFrom("gold", P(30_000));
    const silver = nisabFrom("silver", P(350));
    expect(silver).toBeLessThan(gold);
  });
});

describe("calculateZakat", () => {
  it("assesses the whole amount once nisab is met, not just the excess", () => {
    const nisab = nisabFrom("gold", P(30_000)); // ~PKR 2,624,400
    const result = calculateZakat({ ...base, cashPaisa: nisab + P(100_000) });

    expect(result.meetsNisab).toBe(true);
    // Nisab is a threshold. Charging 2.5% of only the surplus would understate
    // the amount by orders of magnitude.
    expect(result.duePaisa).toBe(Math.round(result.zakatablePaisa * ZAKAT_RATE));
    expect(result.duePaisa).toBeGreaterThan(Math.round(P(100_000) * ZAKAT_RATE));
  });

  it("owes nothing below nisab", () => {
    const result = calculateZakat({ ...base, cashPaisa: P(50_000) });

    expect(result.meetsNisab).toBe(false);
    expect(result.duePaisa).toBe(0);
    // The pool is still reported, so the user can see how close they are.
    expect(result.zakatablePaisa).toBe(P(50_000));
  });

  it("treats exactly nisab as meeting it", () => {
    const nisab = nisabFrom("gold", P(30_000));
    const result = calculateZakat({ ...base, cashPaisa: nisab });

    expect(result.meetsNisab).toBe(true);
    expect(result.duePaisa).toBe(Math.round(nisab * ZAKAT_RATE));
  });

  it("charges one fortieth", () => {
    const result = calculateZakat({ ...base, cashPaisa: P(4_000_000) });
    expect(result.duePaisa).toBe(P(100_000));
  });

  it("adds every source into the pool", () => {
    const result = calculateZakat({
      ...base,
      cashPaisa: P(500_000),
      stocksPaisa: P(1_200_000),
      fundsPaisa: P(400_000),
      otherAssetsPaisa: P(900_000),
      receivablesPaisa: P(150_000),
      committeesPaisa: P(60_000),
    });

    expect(result.assetsPaisa).toBe(P(3_210_000));
    expect(result.zakatablePaisa).toBe(P(3_210_000));
  });

  it("subtracts deductible debts", () => {
    const result = calculateZakat({
      ...base,
      cashPaisa: P(3_000_000),
      deductionsPaisa: P(500_000),
    });

    expect(result.deductionsPaisa).toBe(P(500_000));
    expect(result.zakatablePaisa).toBe(P(2_500_000));
  });

  it("never goes negative when debts exceed assets", () => {
    // Owing more than you hold means nothing is due — not a refund.
    const result = calculateZakat({
      ...base,
      cashPaisa: P(100_000),
      deductionsPaisa: P(900_000),
    });

    expect(result.zakatablePaisa).toBe(0);
    expect(result.duePaisa).toBe(0);
  });

  it("ignores a negative deduction rather than treating it as an asset", () => {
    const result = calculateZakat({ ...base, cashPaisa: P(4_000_000), deductionsPaisa: -P(500_000) });
    expect(result.deductionsPaisa).toBe(0);
    expect(result.zakatablePaisa).toBe(P(4_000_000));
  });

  it("owes nothing when no metal price is known", () => {
    // Without a price there is no nisab, and guessing one would be inventing the
    // threshold that decides whether somebody owes Zakat at all.
    const result = calculateZakat({
      ...base,
      cashPaisa: P(10_000_000),
      metalPricePerGramPaisa: 0,
    });

    expect(result.nisabPaisa).toBe(0);
    expect(result.meetsNisab).toBe(false);
    expect(result.duePaisa).toBe(0);
  });

  it("shows its working, and only for what applies", () => {
    const result = calculateZakat({ ...base, cashPaisa: P(3_000_000), stocksPaisa: P(500_000) });

    const keys = result.lines.map((l) => l.key);
    expect(keys).toContain("cash");
    expect(keys).toContain("stocks");
    // Zero rows are omitted rather than padding the table with nothing.
    expect(keys).not.toContain("funds");
    expect(keys).not.toContain("deductions");
  });

  it("flags the contested treatments rather than silently choosing", () => {
    const result = calculateZakat({ ...base, cashPaisa: P(3_000_000), stocksPaisa: P(500_000) });
    const stocks = result.lines.find((l) => l.key === "stocks");
    expect(stocks?.note).toBeTruthy();
  });
});

describe("nextHawl", () => {
  it("is a lunar year on, not a solar one", () => {
    const next = nextHawl("2026-08-16");
    // ~354 days, so it lands before the same date next Gregorian year.
    expect(next < "2027-08-16").toBe(true);
    expect(next > "2027-07-01").toBe(true);
  });
});
