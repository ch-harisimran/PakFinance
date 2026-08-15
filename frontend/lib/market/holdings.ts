/**
 * Cost basis and portfolio valuation.
 *
 * Pure functions over a trade list — no database, no network — so the arithmetic
 * that decides what a user's money is worth can be reasoned about and tested in
 * isolation.
 *
 * Weighted average cost, which is how Pakistani brokers and the CDC report, and
 * what a Pakistani investor will expect to see. FIFO would give different
 * realised figures and confuse anyone reconciling against their broker.
 */

export type TradeType = "BUY" | "SELL" | "DIVIDEND" | "BONUS" | "RIGHT";

export interface Trade {
  symbol: string;
  type: TradeType;
  quantity: number;
  pricePaisa: number;
  chargesPaisa: number;
  tradedAt: string; // YYYY-MM-DD
}

export interface Holding {
  symbol: string;
  qty: number;
  /** Remaining book cost of the shares still held. */
  costPaisa: number;
  avgCostPaisa: number;
  realisedPaisa: number;
  dividendPaisa: number;
}

/**
 * Replay trades in date order into positions.
 *
 * The subtle case is BONUS: share count rises, book cost does not, so the
 * average cost per share falls. Treating bonus shares as a purchase at the
 * market price would invent a cost that was never paid and understate the gain.
 */
export function buildHoldings(trades: Trade[]): Holding[] {
  const byDate = [...trades].sort((a, b) => a.tradedAt.localeCompare(b.tradedAt));
  const map = new Map<string, Holding>();

  const get = (symbol: string): Holding => {
    let h = map.get(symbol);
    if (!h) {
      h = { symbol, qty: 0, costPaisa: 0, avgCostPaisa: 0, realisedPaisa: 0, dividendPaisa: 0 };
      map.set(symbol, h);
    }
    return h;
  };

  for (const t of byDate) {
    const h = get(t.symbol);

    switch (t.type) {
      case "BUY":
      case "RIGHT": {
        h.qty += t.quantity;
        h.costPaisa += t.quantity * t.pricePaisa + t.chargesPaisa;
        break;
      }
      case "BONUS": {
        // Free shares: quantity up, cost unchanged.
        h.qty += t.quantity;
        break;
      }
      case "SELL": {
        const sold = Math.min(t.quantity, h.qty);
        const costOut = Math.round(h.avgCostPaisa * sold);
        h.realisedPaisa += sold * t.pricePaisa - costOut - t.chargesPaisa;
        h.qty -= sold;
        h.costPaisa = Math.max(0, h.costPaisa - costOut);
        break;
      }
      case "DIVIDEND": {
        // Cash received, not a change in position. `pricePaisa` is per share.
        h.dividendPaisa += t.quantity * t.pricePaisa - t.chargesPaisa;
        break;
      }
    }

    h.avgCostPaisa = h.qty > 0 ? h.costPaisa / h.qty : 0;
  }

  return [...map.values()];
}

export interface Valued extends Holding {
  lastPaisa: number | null;
  valuePaisa: number;
  unrealisedPaisa: number;
  returnPct: number;
  dayChangePct: number | null;
}

/** Attach live prices. Symbols with no quote value at book cost, not zero. */
export function valueHoldings(
  holdings: Holding[],
  quotes: Map<string, { pricePaisa: number; changePct: number | null }>,
): Valued[] {
  return holdings
    .filter((h) => h.qty > 0)
    .map((h) => {
      const q = quotes.get(h.symbol) ?? null;
      const last = q?.pricePaisa ?? null;
      const value = last === null ? h.costPaisa : Math.round(h.qty * last);
      const unrealised = value - h.costPaisa;
      return {
        ...h,
        lastPaisa: last,
        valuePaisa: value,
        unrealisedPaisa: unrealised,
        returnPct: h.costPaisa > 0 ? (unrealised / h.costPaisa) * 100 : 0,
        dayChangePct: q?.changePct ?? null,
      };
    })
    .sort((a, b) => b.valuePaisa - a.valuePaisa);
}

/**
 * Portfolio value on every trading day since the first trade.
 *
 * Quantities are replayed forward through time rather than applying today's
 * holdings to past prices — otherwise the chart would show a position you did
 * not own yet, and every historical figure would be fiction.
 *
 * `bars` is symbol → date → close (paisa).
 */
export function portfolioSeries(
  trades: Trade[],
  bars: Map<string, Map<string, number>>,
): { date: string; valuePaisa: number }[] {
  if (!trades.length) return [];

  const byDate = [...trades].sort((a, b) => a.tradedAt.localeCompare(b.tradedAt));
  const start = byDate[0].tradedAt;

  // Every date any held symbol has a bar for, from the first trade onward.
  const dates = new Set<string>();
  for (const perDate of bars.values()) {
    for (const d of perDate.keys()) if (d >= start) dates.add(d);
  }
  const timeline = [...dates].sort();
  if (!timeline.length) return [];

  const qty = new Map<string, number>();
  const lastKnown = new Map<string, number>();
  let cursor = 0;
  const out: { date: string; valuePaisa: number }[] = [];

  for (const date of timeline) {
    // Apply every trade up to and including this date.
    while (cursor < byDate.length && byDate[cursor].tradedAt <= date) {
      const t = byDate[cursor++];
      const held = qty.get(t.symbol) ?? 0;
      if (t.type === "BUY" || t.type === "RIGHT" || t.type === "BONUS") {
        qty.set(t.symbol, held + t.quantity);
      } else if (t.type === "SELL") {
        qty.set(t.symbol, Math.max(0, held - t.quantity));
      }
    }

    let total = 0;
    for (const [symbol, held] of qty) {
      if (held <= 0) continue;
      const close = bars.get(symbol)?.get(date) ?? lastKnown.get(symbol);
      // Carry the last close forward: a scrip that did not trade that day has
      // not become worthless, it simply has no print.
      if (close === undefined) continue;
      lastKnown.set(symbol, close);
      total += held * close;
    }

    out.push({ date, valuePaisa: Math.round(total) });
  }

  return out;
}
