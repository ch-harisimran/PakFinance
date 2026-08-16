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

/**
 * A corporate action that changes a position without the user trading.
 *
 * Only the three kinds nobody can record as a trade. BONUS, RIGHT and DIVIDEND
 * are deliberately absent: the user enters those from their broker note, and
 * applying them here as well would double the shares.
 */
export interface CorporateAction {
  symbol: string;
  kind: "SPLIT" | "SYMBOL_CHANGE" | "MERGER";
  exDate: string; // YYYY-MM-DD
  /** SPLIT and MERGER: each old share becomes `ratioTo / ratioFrom` new ones. */
  ratioFrom?: number | null;
  ratioTo?: number | null;
  /** SYMBOL_CHANGE and MERGER: where the position moves to. */
  newSymbol?: string | null;
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
export function buildHoldings(trades: Trade[], actions: CorporateAction[] = []): Holding[] {
  const map = new Map<string, Holding>();

  const get = (symbol: string): Holding => {
    let h = map.get(symbol);
    if (!h) {
      h = { symbol, qty: 0, costPaisa: 0, avgCostPaisa: 0, realisedPaisa: 0, dividendPaisa: 0 };
      map.set(symbol, h);
    }
    return h;
  };

  /**
   * Trades and corporate actions are merged into one timeline and replayed
   * together, because the order between them changes the answer: shares bought
   * after a split are already split-adjusted and must not be multiplied again.
   *
   * An action on the same date as a trade is applied AFTER it — the ex-date is
   * the first day the shares trade adjusted, so anything bought that day is
   * bought at the old terms.
   */
  const timeline: ({ at: string; rank: number } & (
    | { event: "trade"; trade: Trade }
    | { event: "action"; action: CorporateAction }
  ))[] = [
    ...trades.map((trade) => ({ at: trade.tradedAt, rank: 0, event: "trade" as const, trade })),
    ...actions.map((action) => ({ at: action.exDate, rank: 1, event: "action" as const, action })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.rank - b.rank);

  for (const entry of timeline) {
    if (entry.event === "action") {
      applyAction(map, get, entry.action);
      continue;
    }

    const t = entry.trade;
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

/**
 * Apply one corporate action to the positions held at that moment.
 *
 * A split changes how many pieces the same money is divided into; it does not
 * change the money. So quantity scales and book cost does not, which is what
 * makes the average cost fall by exactly the ratio. Realised gains and dividends
 * already banked are historical fact and are carried across untouched.
 */
function applyAction(
  map: Map<string, Holding>,
  get: (symbol: string) => Holding,
  action: CorporateAction,
): void {
  const existing = map.get(action.symbol);
  // Nothing held in this symbol at the ex-date: the action is not ours.
  if (!existing || (existing.qty <= 0 && existing.realisedPaisa === 0)) return;

  const from = Number(action.ratioFrom ?? 1);
  const to = Number(action.ratioTo ?? 1);
  const factor = from > 0 && to > 0 ? to / from : 1;

  if (action.kind === "SPLIT") {
    existing.qty *= factor;
    existing.avgCostPaisa = existing.qty > 0 ? existing.costPaisa / existing.qty : 0;
    return;
  }

  // SYMBOL_CHANGE and MERGER both move the position to another ticker; a merger
  // additionally exchanges shares at a ratio. Without `newSymbol` there is
  // nowhere to move it, so the row is ignored rather than guessed at.
  const destination = action.newSymbol;
  if (!destination) return;

  const target = get(destination);
  const movedQty = existing.qty * (action.kind === "MERGER" ? factor : 1);

  target.qty += movedQty;
  target.costPaisa += existing.costPaisa;
  target.realisedPaisa += existing.realisedPaisa;
  target.dividendPaisa += existing.dividendPaisa;
  target.avgCostPaisa = target.qty > 0 ? target.costPaisa / target.qty : 0;

  // The old ticker no longer exists. Dropping the row entirely — rather than
  // leaving a zeroed one — keeps it out of the holdings table and the sector
  // split, where a dead symbol with no price would show as unclassified.
  map.delete(action.symbol);
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
  actions: CorporateAction[] = [],
): { date: string; valuePaisa: number }[] {
  if (!trades.length) return [];

  const byDate = [...trades].sort((a, b) => a.tradedAt.localeCompare(b.tradedAt));
  const start = byDate[0].tradedAt;

  /**
   * Actions matter here as much as they do to cost basis, for a different
   * reason: PSX's historical closes are already split-adjusted, so replaying
   * unadjusted quantities against them draws a cliff on the ex-date that never
   * happened. Adjusting the quantity at the same moment keeps the curve smooth
   * and true.
   */
  const byExDate = [...actions].sort((a, b) => a.exDate.localeCompare(b.exDate));
  let actionCursor = 0;

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

    // Then every action up to and including this date, after the day's trades
    // for the same reason as in buildHoldings.
    while (actionCursor < byExDate.length && byExDate[actionCursor].exDate <= date) {
      const a = byExDate[actionCursor++];
      const held = qty.get(a.symbol) ?? 0;
      if (held <= 0) continue;

      const from = Number(a.ratioFrom ?? 1);
      const to = Number(a.ratioTo ?? 1);
      const factor = from > 0 && to > 0 ? to / from : 1;

      if (a.kind === "SPLIT") {
        qty.set(a.symbol, held * factor);
      } else if (a.newSymbol) {
        qty.set(a.newSymbol, (qty.get(a.newSymbol) ?? 0) + held * (a.kind === "MERGER" ? factor : 1));
        qty.set(a.symbol, 0);
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
