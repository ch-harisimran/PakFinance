import {
  pgSchema,
  text,
  boolean,
  timestamp,
  numeric,
  bigint,
  smallint,
  date,
  time,
  uuid,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/**
 * The `market` schema — reference and price data.
 *
 * Deliberately NOT in `public`. The anon key ships to every browser, so any
 * table in `public` is reachable through PostgREST; our price history is
 * exactly the thing we must not redistribute while unlicensed. These tables are
 * read server-side only, which is also faster (no PostgREST hop).
 *
 * See BACKEND-PLAN.md §2.
 */
export const market = pgSchema("market");

export const securityKind = market.enum("security_kind", [
  "EQUITY",
  "ETF",
  "REIT",
  "PREF",
  "DEBT",
]);

export const actionKind = market.enum("action_kind", [
  "BONUS",
  "SPLIT",
  "RIGHT",
  "DIVIDEND",
]);

/**
 * Every tradable symbol PSX returns. The universe is discovered from the feed
 * rather than curated, so new listings appear on their own.
 */
export const securities = market.table(
  "securities",
  {
    symbol: text("symbol").primaryKey(),
    name: text("name").notNull(),
    kind: securityKind("kind").notNull(),
    sector: text("sector"),
    board: text("board"),
    /**
     * Symbols that stop appearing in the feed are marked inactive — never
     * deleted. A user may hold one, and removing the row would destroy their
     * transaction history and corrupt every past net-worth figure.
     */
    isActive: boolean("is_active").notNull().default(true),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("securities_active_idx").on(t.isActive)],
);

/**
 * One row per symbol, overwritten each sync.
 *
 * This table is why the dashboard is fast: it reads ~600 rows by primary key
 * instead of scanning a history table that grows forever.
 */
export const priceLatest = market.table("price_latest", {
  symbol: text("symbol")
    .primaryKey()
    .references(() => securities.symbol),
  price: numeric("price", { precision: 14, scale: 4 }).notNull(),
  ldcp: numeric("ldcp", { precision: 14, scale: 4 }),
  dayHigh: numeric("day_high", { precision: 14, scale: 4 }),
  dayLow: numeric("day_low", { precision: 14, scale: 4 }),
  volume: bigint("volume", { mode: "number" }),
  changePct: numeric("change_pct", { precision: 8, scale: 4 }),
  asOf: timestamp("as_of", { withTimezone: true }).notNull(),
});

/** Intraday snapshots. Pruned after 90 days — detail stops mattering quickly. */
export const prices = market.table(
  "prices",
  {
    symbol: text("symbol")
      .notNull()
      .references(() => securities.symbol),
    price: numeric("price", { precision: 14, scale: 4 }).notNull(),
    // mode "number": PSX daily volumes peak around 2.5e8, far under 2^53, and
    // JS numbers are far easier to work with than BigInt throughout the app.
    volume: bigint("volume", { mode: "number" }),
    asOf: timestamp("as_of", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.asOf] }), index("prices_as_of_idx").on(t.asOf)],
);

/**
 * One row per symbol per trading day. Never pruned.
 *
 * Written by the forced session-close snapshot. This is the table that makes a
 * three-year chart possible in three years' time, and a missed close can never
 * be backfilled without a licensed historical feed.
 */
export const pricesDaily = market.table(
  "prices_daily",
  {
    symbol: text("symbol")
      .notNull()
      .references(() => securities.symbol),
    sessionDate: date("session_date").notNull(),
    open: numeric("open", { precision: 14, scale: 4 }),
    high: numeric("high", { precision: 14, scale: 4 }),
    low: numeric("low", { precision: 14, scale: 4 }),
    close: numeric("close", { precision: 14, scale: 4 }).notNull(),
    // mode "number": PSX daily volumes peak around 2.5e8, far under 2^53, and
    // JS numbers are far easier to work with than BigInt throughout the app.
    volume: bigint("volume", { mode: "number" }),
  },
  (t) => [primaryKey({ columns: [t.symbol, t.sessionDate] })],
);

/**
 * Open-end mutual funds. Not traded on PSX — bought and redeemed from the AMC
 * at NAV, published once daily by MUFAP.
 */
export const funds = market.table("funds", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  amc: text("amc").notNull(),
  category: text("category").notNull(),
  isIslamic: boolean("is_islamic").notNull().default(false),
  mufapCode: text("mufap_code").unique(),
  isActive: boolean("is_active").notNull().default(true),
  /**
   * NULL for seeded and MUFAP-sourced funds; a user id for one someone added
   * themselves. Without this a user whose fund is missing from the catalogue
   * could not record it at all, since there is no NAV feed populating this
   * table yet.
   */
  createdBy: uuid("created_by"),
  /** MUFAP table of origin: Open-End Funds, ETF, VPS, Employer Pension. */
  sector: text("sector"),
  rating: text("rating"),
});

export const fundNavs = market.table(
  "fund_navs",
  {
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id),
    nav: numeric("nav", { precision: 14, scale: 4 }).notNull(),
    sessionDate: date("session_date").notNull(),
  },
  (t) => [primaryKey({ columns: [t.fundId, t.sessionDate] })],
);

/**
 * Bonus issues, splits and rights.
 *
 * Without these a 100% bonus halves the raw price overnight and the chart shows
 * a crash that never happened. Ships with v1 because retrofitting means
 * reprocessing years of rows.
 */
export const corporateActions = market.table(
  "corporate_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: text("symbol")
      .notNull()
      .references(() => securities.symbol),
    kind: actionKind("kind").notNull(),
    exDate: date("ex_date").notNull(),
    ratioFrom: numeric("ratio_from", { precision: 10, scale: 4 }),
    ratioTo: numeric("ratio_to", { precision: 10, scale: 4 }),
    amount: numeric("amount", { precision: 14, scale: 4 }),
  },
  (t) => [index("corp_actions_symbol_idx").on(t.symbol, t.exDate)],
);

/**
 * Trading sessions, in a table rather than in code.
 *
 * PSX shortens hours through Ramadan every year and closes for Eid, Ashura and
 * Independence Day. Hardcoded hours are wrong for about a month a year and
 * silently wrong on holidays.
 *
 * Times are Asia/Karachi (UTC+5, no DST).
 */
export const sessions = market.table(
  "sessions",
  {
    weekday: smallint("weekday").notNull(), // 1 = Monday … 5 = Friday
    seq: smallint("seq").notNull(), // Friday has two sessions
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
    label: text("label"),
  },
  (t) => [primaryKey({ columns: [t.weekday, t.seq] })],
);

export const marketHolidays = market.table("market_holidays", {
  holidayDate: date("holiday_date").primaryKey(),
  reason: text("reason").notNull(),
});

/** Operational log for every cron invocation — including the ones that no-op. */
export const syncRuns = market.table(
  "sync_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    status: text("status").notNull(), // ok | skipped | error
    reason: text("reason"), // holiday | closed | too-soon
    rowsWritten: bigint("rows_written", { mode: "number" }),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("sync_runs_job_idx").on(t.job, t.startedAt)],
);
