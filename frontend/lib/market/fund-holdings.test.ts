import { describe, expect, it } from "vitest";
import { buildFundPositions, valueFunds, type FundOrder } from "@/lib/market/fund-holdings";

/**
 * Mutual fund positions.
 *
 * Funds differ from equities in ways that trip up code written for shares:
 * units are fractional, there is no market price between NAV publications, and
 * a dividend usually arrives as extra units rather than cash.
 */

const P = (rupees: number) => Math.round(rupees * 100);

function order(over: Partial<FundOrder> & Pick<FundOrder, "type" | "tradedAt">): FundOrder {
  return { fundId: "f1", units: 0, navPaisa: 0, ...over };
}

describe("buildFundPositions", () => {
  it("holds fractional units without rounding them away", () => {
    const [p] = buildFundPositions([
      order({ type: "BUY", units: 412.6317, navPaisa: P(100), tradedAt: "2026-01-05" }),
    ]);

    // 412.6317 units is an ordinary fund holding. Rounding to whole units would
    // silently discard money.
    expect(p.units).toBeCloseTo(412.6317, 6);
    expect(p.costPaisa).toBe(P(41_263.17));
  });

  it("averages NAV across purchases", () => {
    const [p] = buildFundPositions([
      order({ type: "BUY", units: 100, navPaisa: P(50), tradedAt: "2026-01-05" }),
      order({ type: "BUY", units: 100, navPaisa: P(70), tradedAt: "2026-02-05" }),
    ]);

    expect(p.units).toBe(200);
    expect(p.avgNavPaisa).toBeCloseTo(P(60), 6);
  });

  it("treats a reinvested dividend as free units", () => {
    const [p] = buildFundPositions([
      order({ type: "BUY", units: 100, navPaisa: P(100), tradedAt: "2026-01-05" }),
      order({ type: "DIVIDEND", units: 10, navPaisa: P(100), tradedAt: "2026-03-05" }),
    ]);

    expect(p.units).toBe(110);
    // Money in did not change, so the average NAV falls. Booking the dividend
    // as a purchase would invent a cost and hide the actual return.
    expect(p.costPaisa).toBe(P(10_000));
    expect(p.avgNavPaisa).toBeCloseTo(P(100) / 1.1, 4);
  });

  it("realises a redemption against average NAV", () => {
    const [p] = buildFundPositions([
      order({ type: "BUY", units: 100, navPaisa: P(100), tradedAt: "2026-01-05" }),
      order({ type: "REDEEM", units: 40, navPaisa: P(120), tradedAt: "2026-04-05" }),
    ]);

    expect(p.units).toBe(60);
    expect(p.realisedPaisa).toBe(P(800)); // 40 × (120 − 100)
    expect(p.costPaisa).toBe(P(6_000));
  });

  it("cannot redeem more units than are held", () => {
    const [p] = buildFundPositions([
      order({ type: "BUY", units: 100, navPaisa: P(100), tradedAt: "2026-01-05" }),
      order({ type: "REDEEM", units: 250, navPaisa: P(120), tradedAt: "2026-04-05" }),
    ]);

    expect(p.units).toBe(0);
    expect(p.costPaisa).toBe(0);
  });

  it("remembers the most recent NAV the user transacted at", () => {
    const [p] = buildFundPositions([
      order({ type: "BUY", units: 100, navPaisa: P(100), tradedAt: "2026-01-05" }),
      order({ type: "BUY", units: 50, navPaisa: P(118), tradedAt: "2026-06-05" }),
    ]);

    expect(p.lastNavPaisa).toBe(P(118));
    expect(p.lastNavDate).toBe("2026-06-05");
  });
});

describe("valueFunds", () => {
  const positions = buildFundPositions([
    order({ type: "BUY", units: 100, navPaisa: P(100), tradedAt: "2026-01-05" }),
  ]);

  it("prefers the official NAV and says so", () => {
    const [v] = valueFunds(positions, new Map([["f1", { navPaisa: P(130), date: "2026-08-14" }]]));

    expect(v.navSource).toBe("official");
    expect(v.valuePaisa).toBe(P(13_000));
    expect(v.returnPct).toBeCloseTo(30, 6);
  });

  it("falls back to the user's own NAV, labelled honestly", () => {
    const [v] = valueFunds(positions, new Map());

    // The claim on screen must match the source. Calling a self-entered price
    // "official" would be a claim the product cannot keep.
    expect(v.navSource).toBe("own");
    expect(v.valuePaisa).toBe(P(10_000));
  });

  it("values at cost when there is no price at all", () => {
    const priceless = buildFundPositions([
      order({ type: "DIVIDEND", units: 10, navPaisa: 0, tradedAt: "2026-01-05" }),
      order({ type: "BUY", units: 100, navPaisa: 0, tradedAt: "2026-01-06" }),
    ]);
    const [v] = valueFunds(priceless, new Map());

    expect(v.navSource).toBe("none");
    expect(v.valuePaisa).toBe(v.costPaisa);
  });

  it("drops fully redeemed positions", () => {
    const closed = buildFundPositions([
      order({ type: "BUY", units: 100, navPaisa: P(100), tradedAt: "2026-01-05" }),
      order({ type: "REDEEM", units: 100, navPaisa: P(120), tradedAt: "2026-04-05" }),
    ]);

    expect(valueFunds(closed, new Map())).toEqual([]);
  });
});
