/**
 * Mutual fund positions.
 *
 * Pure functions over an order list. Funds differ from equities in ways that
 * matter to the arithmetic:
 *
 *   - You hold UNITS, not shares, and units are fractional — 412.6317 is normal.
 *   - There is no market price. Value is always units × NAV, and NAV moves once
 *     a day after the close.
 *   - A dividend is usually reinvested as extra units rather than paid as cash,
 *     so it changes the unit count without changing the money you put in.
 */

export type FundOrderType = "BUY" | "REDEEM" | "DIVIDEND";

export interface FundOrder {
  fundId: string;
  type: FundOrderType;
  units: number;
  navPaisa: number;
  tradedAt: string; // YYYY-MM-DD
}

export interface FundPosition {
  fundId: string;
  units: number;
  /** Money actually put in, net of redemptions at cost. */
  costPaisa: number;
  avgNavPaisa: number;
  realisedPaisa: number;
  /** Most recent NAV seen in this user's own orders. */
  lastNavPaisa: number | null;
  lastNavDate: string | null;
}

export function buildFundPositions(orders: FundOrder[]): FundPosition[] {
  const byDate = [...orders].sort((a, b) => a.tradedAt.localeCompare(b.tradedAt));
  const map = new Map<string, FundPosition>();

  const get = (fundId: string): FundPosition => {
    let p = map.get(fundId);
    if (!p) {
      p = {
        fundId,
        units: 0,
        costPaisa: 0,
        avgNavPaisa: 0,
        realisedPaisa: 0,
        lastNavPaisa: null,
        lastNavDate: null,
      };
      map.set(fundId, p);
    }
    return p;
  };

  for (const o of byDate) {
    const p = get(o.fundId);

    switch (o.type) {
      case "BUY": {
        p.units += o.units;
        p.costPaisa += Math.round(o.units * o.navPaisa);
        break;
      }
      case "REDEEM": {
        const sold = Math.min(o.units, p.units);
        const costOut = Math.round(p.avgNavPaisa * sold);
        p.realisedPaisa += Math.round(sold * o.navPaisa) - costOut;
        p.units -= sold;
        p.costPaisa = Math.max(0, p.costPaisa - costOut);
        break;
      }
      case "DIVIDEND": {
        // Reinvested units: the holding grows, the money invested does not, so
        // average NAV falls. Treating it as a purchase would invent a cost.
        p.units += o.units;
        break;
      }
    }

    p.avgNavPaisa = p.units > 0 ? p.costPaisa / p.units : 0;

    // Every order carries the NAV that applied on its date — which is the
    // official NAV. Until the MUFAP feed exists, this is the price source.
    if (o.navPaisa > 0 && (!p.lastNavDate || o.tradedAt >= p.lastNavDate)) {
      p.lastNavPaisa = o.navPaisa;
      p.lastNavDate = o.tradedAt;
    }
  }

  return [...map.values()];
}

export interface ValuedFund extends FundPosition {
  navPaisa: number | null;
  navDate: string | null;
  /** "official" once MUFAP lands; "own" while priced from the user's orders. */
  navSource: "official" | "own" | "none";
  valuePaisa: number;
  gainPaisa: number;
  returnPct: number;
}

/**
 * Attach a NAV. Official MUFAP prices win where present; otherwise the most
 * recent NAV from the user's own orders. A position with neither is valued at
 * cost rather than zero — showing nothing would look like the money vanished.
 */
export function valueFunds(
  positions: FundPosition[],
  official: Map<string, { navPaisa: number; date: string }>,
): ValuedFund[] {
  return positions
    .filter((p) => p.units > 0)
    .map((p) => {
      const feed = official.get(p.fundId);
      const navPaisa = feed?.navPaisa ?? p.lastNavPaisa;
      const navDate = feed?.date ?? p.lastNavDate;
      const navSource: ValuedFund["navSource"] = feed ? "official" : p.lastNavPaisa ? "own" : "none";

      const value = navPaisa === null ? p.costPaisa : Math.round(p.units * navPaisa);
      const gain = value - p.costPaisa;

      return {
        ...p,
        navPaisa,
        navDate,
        navSource,
        valuePaisa: value,
        gainPaisa: gain,
        returnPct: p.costPaisa > 0 ? (gain / p.costPaisa) * 100 : 0,
      };
    })
    .sort((a, b) => b.valuePaisa - a.valuePaisa);
}
