import { describe, expect, it } from "vitest";
import { buildHoldings, valueHoldings, portfolioSeries, type Trade } from "@/lib/market/holdings";

/**
 * Cost basis is the arithmetic everything else rests on: the portfolio value,
 * the return percentage, the insights in the PDF, the daily net-worth snapshot.
 * A silent error here is wrong money on every screen at once.
 *
 * Amounts are in paisa throughout — 100 paisa to the rupee.
 */

const P = (rupees: number) => Math.round(rupees * 100);

function trade(over: Partial<Trade> & Pick<Trade, "type" | "tradedAt">): Trade {
  return {
    symbol: "OGDC",
    quantity: 0,
    pricePaisa: 0,
    chargesPaisa: 0,
    ...over,
  };
}

describe("buildHoldings", () => {
  it("returns nothing for no trades", () => {
    expect(buildHoldings([])).toEqual([]);
  });

  it("carries charges into the book cost", () => {
    const [h] = buildHoldings([
      trade({ type: "BUY", quantity: 100, pricePaisa: P(200), chargesPaisa: P(150), tradedAt: "2026-01-05" }),
    ]);

    // Charges are part of what you paid, so they belong in the cost basis —
    // otherwise the position shows a profit before the price has moved.
    expect(h.costPaisa).toBe(P(20_150));
    expect(h.avgCostPaisa).toBeCloseTo(P(201.5), 6);
    expect(h.qty).toBe(100);
  });

  it("averages the cost across two buys at different prices", () => {
    const [h] = buildHoldings([
      trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
      trade({ type: "BUY", quantity: 300, pricePaisa: P(240), tradedAt: "2026-02-05" }),
    ]);

    expect(h.qty).toBe(400);
    expect(h.costPaisa).toBe(P(92_000));
    expect(h.avgCostPaisa).toBeCloseTo(P(230), 6);
  });

  it("replays trades in date order regardless of input order", () => {
    const ordered = buildHoldings([
      trade({ type: "BUY", quantity: 100, pricePaisa: P(100), tradedAt: "2026-01-05" }),
      trade({ type: "SELL", quantity: 50, pricePaisa: P(150), tradedAt: "2026-03-05" }),
    ]);
    const shuffled = buildHoldings([
      trade({ type: "SELL", quantity: 50, pricePaisa: P(150), tradedAt: "2026-03-05" }),
      trade({ type: "BUY", quantity: 100, pricePaisa: P(100), tradedAt: "2026-01-05" }),
    ]);

    expect(shuffled).toEqual(ordered);
  });

  describe("BONUS shares", () => {
    it("raises quantity without adding cost, so average cost falls", () => {
      const [h] = buildHoldings([
        trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "BONUS", quantity: 100, tradedAt: "2026-02-05" }),
      ]);

      expect(h.qty).toBe(200);
      expect(h.costPaisa).toBe(P(20_000));
      // Halved, because the same money now buys twice the shares. Treating a
      // bonus as a purchase at market price would invent a cost never paid.
      expect(h.avgCostPaisa).toBeCloseTo(P(100), 6);
    });
  });

  describe("SELL", () => {
    it("realises against average cost and reduces the remaining book cost", () => {
      const [h] = buildHoldings([
        trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "SELL", quantity: 40, pricePaisa: P(250), tradedAt: "2026-03-05" }),
      ]);

      expect(h.qty).toBe(60);
      expect(h.realisedPaisa).toBe(P(2_000)); // 40 × (250 − 200)
      expect(h.costPaisa).toBe(P(12_000)); // 60 still held at 200
    });

    it("subtracts charges from the realised gain", () => {
      const [h] = buildHoldings([
        trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "SELL", quantity: 40, pricePaisa: P(250), chargesPaisa: P(300), tradedAt: "2026-03-05" }),
      ]);

      expect(h.realisedPaisa).toBe(P(1_700));
    });

    it("cannot sell more than is held", () => {
      const [h] = buildHoldings([
        trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "SELL", quantity: 500, pricePaisa: P(250), tradedAt: "2026-03-05" }),
      ]);

      expect(h.qty).toBe(0);
      expect(h.costPaisa).toBe(0);
      // Only the 100 actually held are realised, not the 500 claimed.
      expect(h.realisedPaisa).toBe(P(5_000));
    });

    it("selling everything leaves no average cost to divide by", () => {
      const [h] = buildHoldings([
        trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "SELL", quantity: 100, pricePaisa: P(250), tradedAt: "2026-03-05" }),
      ]);

      expect(h.qty).toBe(0);
      expect(h.avgCostPaisa).toBe(0);
      expect(Number.isFinite(h.avgCostPaisa)).toBe(true);
    });
  });

  describe("DIVIDEND", () => {
    it("is cash, not a change in position", () => {
      const [h] = buildHoldings([
        trade({ type: "BUY", quantity: 1000, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "DIVIDEND", quantity: 1000, pricePaisa: P(5), tradedAt: "2026-04-05" }),
      ]);

      expect(h.qty).toBe(1000);
      expect(h.costPaisa).toBe(P(200_000));
      expect(h.dividendPaisa).toBe(P(5_000));
    });
  });

  it("keeps separate positions per symbol", () => {
    const holdings = buildHoldings([
      trade({ symbol: "OGDC", type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
      trade({ symbol: "LUCK", type: "BUY", quantity: 10, pricePaisa: P(1_000), tradedAt: "2026-01-06" }),
    ]);

    expect(holdings).toHaveLength(2);
    expect(holdings.find((h) => h.symbol === "LUCK")?.costPaisa).toBe(P(10_000));
  });
});

describe("corporate actions", () => {
  const bought = trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" });

  describe("SPLIT", () => {
    it("multiplies shares and leaves the money paid alone", () => {
      const [h] = buildHoldings(
        [bought],
        [{ symbol: "OGDC", kind: "SPLIT", exDate: "2026-03-01", ratioFrom: 1, ratioTo: 10 }],
      );

      expect(h.qty).toBe(1000);
      expect(h.costPaisa).toBe(P(20_000));
      // The same money in ten times the pieces. Anything else invents or
      // destroys value the user never gained or lost.
      expect(h.avgCostPaisa).toBeCloseTo(P(20), 6);
    });

    it("does not touch shares bought after the ex-date", () => {
      const [h] = buildHoldings(
        [
          bought,
          trade({ type: "BUY", quantity: 500, pricePaisa: P(20), tradedAt: "2026-03-02" }),
        ],
        [{ symbol: "OGDC", kind: "SPLIT", exDate: "2026-03-01", ratioFrom: 1, ratioTo: 10 }],
      );

      // 100 split into 1000, plus 500 bought already-adjusted.
      expect(h.qty).toBe(1500);
      expect(h.costPaisa).toBe(P(30_000));
    });

    it("applies after a trade on the same day, since ex-date shares trade adjusted", () => {
      const [h] = buildHoldings(
        [
          bought,
          trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-03-01" }),
        ],
        [{ symbol: "OGDC", kind: "SPLIT", exDate: "2026-03-01", ratioFrom: 1, ratioTo: 2 }],
      );

      expect(h.qty).toBe(400);
    });

    it("ignores a split in a symbol not held", () => {
      const [h] = buildHoldings(
        [bought],
        [{ symbol: "LUCK", kind: "SPLIT", exDate: "2026-03-01", ratioFrom: 1, ratioTo: 10 }],
      );

      expect(h.qty).toBe(100);
      expect(buildHoldings([bought], [])).toHaveLength(1);
    });

    it("survives a nonsense ratio without destroying the position", () => {
      const [h] = buildHoldings(
        [bought],
        [{ symbol: "OGDC", kind: "SPLIT", exDate: "2026-03-01", ratioFrom: 0, ratioTo: 0 }],
      );

      expect(h.qty).toBe(100);
      expect(Number.isFinite(h.avgCostPaisa)).toBe(true);
    });
  });

  describe("SYMBOL_CHANGE", () => {
    it("moves the position, keeping quantity and cost", () => {
      const holdings = buildHoldings(
        [bought],
        [{ symbol: "OGDC", kind: "SYMBOL_CHANGE", exDate: "2026-04-01", newSymbol: "OGDCL" }],
      );

      expect(holdings.map((h) => h.symbol)).toEqual(["OGDCL"]);
      expect(holdings[0].qty).toBe(100);
      expect(holdings[0].costPaisa).toBe(P(20_000));
    });

    it("merges into an existing position under the new ticker", () => {
      const holdings = buildHoldings(
        [
          bought,
          trade({ symbol: "OGDCL", type: "BUY", quantity: 50, pricePaisa: P(200), tradedAt: "2026-02-01" }),
        ],
        [{ symbol: "OGDC", kind: "SYMBOL_CHANGE", exDate: "2026-04-01", newSymbol: "OGDCL" }],
      );

      expect(holdings).toHaveLength(1);
      expect(holdings[0].qty).toBe(150);
      expect(holdings[0].costPaisa).toBe(P(30_000));
    });

    it("carries realised gains and dividends across", () => {
      const holdings = buildHoldings(
        [
          bought,
          trade({ type: "SELL", quantity: 40, pricePaisa: P(250), tradedAt: "2026-02-01" }),
          trade({ type: "DIVIDEND", quantity: 60, pricePaisa: P(5), tradedAt: "2026-03-01" }),
        ],
        [{ symbol: "OGDC", kind: "SYMBOL_CHANGE", exDate: "2026-04-01", newSymbol: "OGDCL" }],
      );

      // Money already banked under the old ticker is historical fact.
      expect(holdings[0].symbol).toBe("OGDCL");
      expect(holdings[0].realisedPaisa).toBe(P(2_000));
      expect(holdings[0].dividendPaisa).toBe(P(300));
    });

    it("does nothing without a destination rather than guessing one", () => {
      const holdings = buildHoldings(
        [bought],
        [{ symbol: "OGDC", kind: "SYMBOL_CHANGE", exDate: "2026-04-01", newSymbol: null }],
      );

      expect(holdings.map((h) => h.symbol)).toEqual(["OGDC"]);
    });
  });

  describe("MERGER", () => {
    it("exchanges shares at the ratio and moves the cost across", () => {
      const holdings = buildHoldings(
        [bought],
        [
          {
            symbol: "OGDC",
            kind: "MERGER",
            exDate: "2026-05-01",
            newSymbol: "NEWCO",
            ratioFrom: 2,
            ratioTo: 1,
          },
        ],
      );

      // Two old shares become one new one; the money paid is unchanged, so the
      // average cost per share doubles.
      expect(holdings[0].symbol).toBe("NEWCO");
      expect(holdings[0].qty).toBe(50);
      expect(holdings[0].costPaisa).toBe(P(20_000));
      expect(holdings[0].avgCostPaisa).toBeCloseTo(P(400), 6);
    });
  });

  it("applies a split then a symbol change in order", () => {
    const holdings = buildHoldings(
      [bought],
      [
        { symbol: "OGDC", kind: "SPLIT", exDate: "2026-03-01", ratioFrom: 1, ratioTo: 10 },
        { symbol: "OGDC", kind: "SYMBOL_CHANGE", exDate: "2026-04-01", newSymbol: "OGDCL" },
      ],
    );

    expect(holdings).toHaveLength(1);
    expect(holdings[0].symbol).toBe("OGDCL");
    expect(holdings[0].qty).toBe(1000);
  });

  it("leaves holdings untouched when no actions are supplied", () => {
    // The overwhelmingly common case: nobody should pay for this feature.
    expect(buildHoldings([bought])).toEqual(buildHoldings([bought], []));
  });
});

describe("valueHoldings", () => {
  const quotes = new Map([["OGDC", { pricePaisa: P(250), changePct: 1.2 }]]);

  it("values against the quote and computes the return", () => {
    const [v] = valueHoldings(
      buildHoldings([trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" })]),
      quotes,
    );

    expect(v.valuePaisa).toBe(P(25_000));
    expect(v.unrealisedPaisa).toBe(P(5_000));
    expect(v.returnPct).toBeCloseTo(25, 6);
  });

  it("falls back to book cost when there is no quote", () => {
    const [v] = valueHoldings(
      buildHoldings([trade({ symbol: "XYZ", type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" })]),
      new Map(),
    );

    // Valuing an unpriced holding at zero would look like the money vanished.
    expect(v.lastPaisa).toBeNull();
    expect(v.valuePaisa).toBe(P(20_000));
    expect(v.unrealisedPaisa).toBe(0);
  });

  it("drops fully sold positions and sorts by value", () => {
    const valued = valueHoldings(
      buildHoldings([
        trade({ symbol: "OGDC", type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ symbol: "LUCK", type: "BUY", quantity: 10, pricePaisa: P(100), tradedAt: "2026-01-05" }),
        trade({ symbol: "LUCK", type: "SELL", quantity: 10, pricePaisa: P(120), tradedAt: "2026-02-05" }),
      ]),
      quotes,
    );

    expect(valued.map((v) => v.symbol)).toEqual(["OGDC"]);
  });
});

describe("portfolioSeries", () => {
  const bars = new Map([
    [
      "OGDC",
      new Map([
        ["2026-01-05", P(200)],
        ["2026-01-06", P(210)],
        ["2026-01-07", P(220)],
      ]),
    ],
  ]);

  it("is empty without trades", () => {
    expect(portfolioSeries([], bars)).toEqual([]);
  });

  it("starts at the first trade, never before it", () => {
    const series = portfolioSeries(
      [trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-06" })],
      bars,
    );

    // A position you did not own yet must not appear in your history.
    expect(series.map((p) => p.date)).toEqual(["2026-01-06", "2026-01-07"]);
    expect(series[0].valuePaisa).toBe(P(21_000));
    expect(series[1].valuePaisa).toBe(P(22_000));
  });

  it("reflects a sale from the day it happened", () => {
    const series = portfolioSeries(
      [
        trade({ type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ type: "SELL", quantity: 50, pricePaisa: P(210), tradedAt: "2026-01-06" }),
      ],
      bars,
    );

    expect(series[0].valuePaisa).toBe(P(20_000)); // 100 × 200
    expect(series[1].valuePaisa).toBe(P(10_500)); // 50 × 210
  });

  it("carries the last close forward when a scrip does not trade", () => {
    const gappy = new Map([
      [
        "OGDC",
        new Map([
          ["2026-01-05", P(200)],
          ["2026-01-07", P(220)],
        ]),
      ],
      ["LUCK", new Map([["2026-01-06", P(1_000)]])],
    ]);

    const series = portfolioSeries(
      [
        trade({ symbol: "OGDC", type: "BUY", quantity: 100, pricePaisa: P(200), tradedAt: "2026-01-05" }),
        trade({ symbol: "LUCK", type: "BUY", quantity: 10, pricePaisa: P(1_000), tradedAt: "2026-01-05" }),
      ],
      gappy,
    );

    const byDate = new Map(series.map((p) => [p.date, p.valuePaisa]));
    // On the 6th OGDC has no print; it is still worth its last close, not zero.
    expect(byDate.get("2026-01-06")).toBe(P(20_000) + P(10_000));
  });
});
