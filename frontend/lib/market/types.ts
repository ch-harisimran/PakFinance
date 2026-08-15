/**
 * The seam between PakFinance and whoever supplies market data.
 *
 * Everything above this interface is written against `MarketDataProvider`, so
 * moving from the public data portal to a licensed PSX Data Vendor feed is a
 * one-file change rather than a rewrite. See BACKEND-PLAN.md §1.
 */

export type SecurityKind = "EQUITY" | "ETF" | "REIT" | "PREF" | "DEBT";

/** One row of the market watch — a live quote plus the day's OHLC. */
export interface Quote {
  symbol: string;
  sectorCode: string | null;
  /** Index memberships: KSE100, KMI30, ALLSHR … */
  indices: string[];
  kind: SecurityKind;
  ldcp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  current: number;
  change: number | null;
  changePct: number | null;
  volume: number | null;
}

/** One end-of-day bar. The public feed carries close and volume only. */
export interface DailyBar {
  /** Trading date, YYYY-MM-DD in Asia/Karachi. */
  date: string;
  close: number;
  volume: number | null;
  prevClose: number | null;
}

export interface MarketDataProvider {
  /** Whole market in one request. */
  getMarketWatch(): Promise<Quote[]>;
  /** Daily history for one symbol, oldest first. */
  getDailyHistory(symbol: string): Promise<DailyBar[]>;
}
