import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  numeric,
  smallint,
  boolean,
  date,
  timestamp,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { funds, securities } from "@/lib/db/schema/market";

/**
 * The `public` schema — everything a user owns.
 *
 * Unlike `market`, these tables ARE exposed through PostgREST, because the
 * browser legitimately needs to read a user's own rows. Row Level Security is
 * therefore not optional: see migration 0002, which enables it and adds the
 * policies in the same transaction as these tables are created.
 *
 * MONEY IS ALWAYS INTEGER PAISA. `PKR 1,234.56` is stored as `123456`. Never a
 * float — lib/money.ts already formats from integers. Paisa amounts stay far
 * below 2^53 (PKR 10 crore = 10,000,000,000 paisa), so `mode: "number"` is safe
 * and much easier to work with than BigInt.
 */

const paisa = (name: string) => bigint(name, { mode: "number" });

export const accountKind = pgEnum("account_kind", [
  "CURRENT",
  "SAVINGS",
  "CASH",
  "WALLET",
]);

export const loanKind = pgEnum("loan_kind", [
  "PERSONAL",
  "CAR",
  "HOME",
  "CREDIT_CARD",
  "OTHER",
]);

export const loanDirection = pgEnum("loan_direction", ["BORROWED", "LENT"]);

export const goalStatus = pgEnum("goal_status", ["ACTIVE", "ACHIEVED", "PAUSED"]);

export const tradeType = pgEnum("trade_type", [
  "BUY",
  "SELL",
  "DIVIDEND",
  "BONUS",
  "RIGHT",
]);

export const fundOrderType = pgEnum("fund_order_type", ["BUY", "REDEEM", "DIVIDEND"]);

/** Mirrors auth.users. The FK to auth.users is added in the RLS migration. */
export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  fullName: text("full_name"),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  timezone: text("timezone").notNull().default("Asia/Karachi"),
  currency: text("currency").notNull().default("PKR"),
  /** "international" | "subcontinental" — drives lib/money.ts formatting. */
  notation: text("notation").notNull().default("international"),
  theme: text("theme").notNull().default("dark"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    kind: accountKind("kind").notNull().default("CURRENT"),
    /** Last four digits only — never a full account number. */
    maskedNumber: text("masked_number"),
    balancePaisa: paisa("balance_paisa").notNull().default(0),
    /** When the user last confirmed this balance. Drives the freshness chip. */
    asOf: timestamp("as_of", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // RLS policies filter on user_id; without this index every read is a
  // sequential scan of the whole table.
  (t) => [index("accounts_user_idx").on(t.userId)],
);

/**
 * Money in and out. Deliberately separate from trades and fund orders — the
 * sidebar draws a line between Money and Investments and the schema keeps it.
 */
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    category: text("category"),
    note: text("note"),
    /** Positive = money in, negative = money out. */
    amountPaisa: paisa("amount_paisa").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transactions_user_idx").on(t.userId, t.occurredAt),
    index("transactions_account_idx").on(t.accountId),
  ],
);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    lender: text("lender"),
    kind: loanKind("kind").notNull().default("PERSONAL"),
    /** BORROWED = you owe it. LENT = someone owes you. */
    direction: loanDirection("direction").notNull().default("BORROWED"),
    principalPaisa: paisa("principal_paisa").notNull(),
    /** Annual markup rate, percent. 16.5 means 16.5%. */
    markupRate: numeric("markup_rate", { precision: 6, scale: 3 }),
    tenureMonths: smallint("tenure_months"),
    installmentPaisa: paisa("installment_paisa"),
    startDate: date("start_date").notNull(),
    /** Day of month the installment falls due, 1–31. */
    dueDay: smallint("due_day"),
    isSettled: boolean("is_settled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loans_user_idx").on(t.userId)],
);

/**
 * Payments are the source of truth for the outstanding balance — it is derived,
 * never stored. A stored balance and a payment log drift apart the first time
 * one of them is edited.
 */
export const loanPayments = pgTable(
  "loan_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    amountPaisa: paisa("amount_paisa").notNull(),
    principalPaisa: paisa("principal_paisa"),
    markupPaisa: paisa("markup_paisa"),
    lateFeePaisa: paisa("late_fee_paisa"),
    paidAt: date("paid_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loan_payments_loan_idx").on(t.loanId, t.paidAt), index("loan_payments_user_idx").on(t.userId)],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    category: text("category"),
    targetPaisa: paisa("target_paisa").notNull(),
    targetDate: date("target_date"),
    status: goalStatus("status").notNull().default("ACTIVE"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goals_user_idx").on(t.userId)],
);

/** Saved amount is the sum of these, never a stored column. */
export const goalContributions = pgTable(
  "goal_contributions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    amountPaisa: paisa("amount_paisa").notNull(),
    occurredAt: date("occurred_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("goal_contributions_goal_idx").on(t.goalId, t.occurredAt),
    index("goal_contributions_user_idx").on(t.userId),
  ],
);

/* ── Investment ledgers (wired up when PSX and MUFAP land) ────────────────── */

export const stockTransactions = pgTable(
  "stock_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    symbol: text("symbol")
      .notNull()
      .references(() => securities.symbol),
    type: tradeType("type").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 4 }).notNull(),
    pricePaisa: paisa("price_paisa").notNull(),
    commissionPaisa: paisa("commission_paisa").notNull().default(0),
    otherChargesPaisa: paisa("other_charges_paisa").notNull().default(0),
    tradedAt: date("traded_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_txn_user_idx").on(t.userId, t.symbol)],
);

export const fundTransactions = pgTable(
  "fund_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    fundId: uuid("fund_id")
      .notNull()
      .references(() => funds.id),
    type: fundOrderType("type").notNull(),
    units: numeric("units", { precision: 18, scale: 4 }).notNull(),
    navPaisa: paisa("nav_paisa").notNull(),
    amountPaisa: paisa("amount_paisa").notNull(),
    tradedAt: date("traded_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fund_txn_user_idx").on(t.userId, t.fundId)],
);

/** One row per user per day, written by the snapshot job. */
export const netWorthDaily = pgTable(
  "net_worth_daily",
  {
    userId: uuid("user_id").notNull(),
    sessionDate: date("session_date").notNull(),
    assetsPaisa: paisa("assets_paisa").notNull(),
    liabilitiesPaisa: paisa("liabilities_paisa").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.sessionDate] })],
);
