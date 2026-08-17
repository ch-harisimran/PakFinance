import {
  pgTable,
  pgEnum,
  uuid,
  text,
  bigint,
  numeric,
  smallint,
  integer,
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
 *
 * SOME TABLES HERE ARE NEVER IMPORTED, AND THAT IS CORRECT. User-owned rows are
 * read and written through Supabase/PostgREST so that RLS applies, not through
 * Drizzle — so `goalContributions`, `committeePayments` and `zakatAssessments`
 * have no importer. They are not dead code: this file is the canonical
 * description of the database, and drizzle-kit diffs migrations against it.
 * Delete a table from here and the next generated migration proposes DROPping
 * it, taking the data with it.
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
  /**
   * Quick-unlock PIN verifier. Server-side only — clients have SELECT and
   * UPDATE revoked on the salt and hash (migration 0013), so the PIN can be set
   * and checked but never read back or overwritten from a browser.
   */
  pinSalt: text("pin_salt"),
  pinHash: text("pin_hash"),
  /** Null means no PIN. Readable by the client, which only needs the boolean. */
  pinSetAt: timestamp("pin_set_at", { withTimezone: true }),
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
    /**
     * For a loan repaid in one go — money from a relative, a committee — rather
     * than monthly. A loan uses `dueDay` OR `dueDate`, not both.
     */
    dueDate: date("due_date"),
    isSettled: boolean("is_settled").notNull().default(false),
    /** Email the user before the next repayment falls due. */
    reminderEnabled: boolean("reminder_enabled").notNull().default(false),
    /** Lead time in days. 0 means "on the day". */
    reminderDaysBefore: smallint("reminder_days_before").notNull().default(3),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loans_user_idx").on(t.userId)],
);

/**
 * What the reminder job has already sent.
 *
 * Keyed by the repayment date rather than the send date, so the uniqueness holds
 * across months and a re-run — retried workflow, overlapping cron, manual
 * trigger — cannot email the same person about the same installment twice.
 */
export const loanRemindersSent = pgTable(
  "loan_reminders_sent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    dueDate: date("due_date").notNull(),
    channel: text("channel").notNull().default("email"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loan_reminders_sent_user_idx").on(t.userId)],
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

export const assetKind = pgEnum("asset_kind", [
  "GOLD",
  "SILVER",
  "PROPERTY",
  "VEHICLE",
  "CRYPTO",
  "FOREIGN_CURRENCY",
  "OTHER",
]);

export const recurrence = pgEnum("recurrence", ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]);

/**
 * What you own that is not a share, a fund unit or a bank balance.
 *
 * Gold above all: it is how a great many Pakistani households hold wealth, and
 * it is Zakat-relevant. There is no gold or property price feed, so `valuePaisa`
 * is stated by the user and dated — an honest manual number beats an invented
 * automatic one.
 */
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    kind: assetKind("kind").notNull().default("OTHER"),
    name: text("name").notNull(),
    /** Optional context: 11 tola, 250 sq yd, 0.4 BTC. */
    quantity: numeric("quantity", { precision: 18, scale: 4 }),
    unit: text("unit"),
    costPaisa: paisa("cost_paisa"),
    valuePaisa: paisa("value_paisa").notNull().default(0),
    asOf: date("as_of").notNull(),
    /** The user decides: rulings differ, and this app is not a mufti. */
    zakatable: boolean("zakatable").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assets_user_idx").on(t.userId)],
);

/** A monthly ceiling per category. Spend is derived from the ledger, never stored. */
export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  category: text("category").notNull(),
  limitPaisa: paisa("limit_paisa").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Entries that repeat: salary, rent, utilities.
 *
 * `lastPostedOn` is the idempotency guard — the job posts only when the due date
 * has arrived and has not already been posted, so a retried run cannot charge a
 * month's rent twice.
 */
export const recurringTransactions = pgTable(
  "recurring_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    category: text("category"),
    /** Signed like transactions: positive in, negative out. */
    amountPaisa: paisa("amount_paisa").notNull(),
    cadence: recurrence("cadence").notNull().default("MONTHLY"),
    /** 1–31 for monthly and longer; 0–6 (Sunday first) for weekly. */
    dayOfPeriod: smallint("day_of_period").notNull().default(1),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    lastPostedOn: date("last_posted_on"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recurring_user_idx").on(t.userId)],
);

/**
 * A committee (BC): N members each pay in monthly, one takes the pot each round.
 *
 * Fits nothing else in this schema because it is two things in sequence — saving
 * before your turn, a debt repaid by instalment after it.
 */
export const committees = pgTable(
  "committees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    organiser: text("organiser"),
    members: smallint("members").notNull(),
    monthlyPaisa: paisa("monthly_paisa").notNull(),
    startMonth: date("start_month").notNull(),
    /** Which round is yours, 1-based. Null until the draw decides. */
    payoutPosition: smallint("payout_position"),
    payoutReceived: boolean("payout_received").notNull().default(false),
    payoutDate: date("payout_date"),
    isSettled: boolean("is_settled").notNull().default(false),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("committees_user_idx").on(t.userId)],
);

export const committeePayments = pgTable(
  "committee_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    committeeId: uuid("committee_id")
      .notNull()
      .references(() => committees.id, { onDelete: "cascade" }),
    amountPaisa: paisa("amount_paisa").notNull(),
    paidAt: date("paid_at").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("committee_payments_user_idx").on(t.userId)],
);

/**
 * A Zakat assessment, kept as a record.
 *
 * The nisab is stored with the assessment rather than recomputed: it tracks the
 * gold price, so re-deriving an old year against today's nisab would give a
 * different answer to the one the user actually acted on.
 */
export const zakatAssessments = pgTable(
  "zakat_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    assessedOn: date("assessed_on").notNull(),
    nisabPaisa: paisa("nisab_paisa").notNull(),
    assetsPaisa: paisa("assets_paisa").notNull(),
    deductionsPaisa: paisa("deductions_paisa").notNull().default(0),
    zakatablePaisa: paisa("zakatable_paisa").notNull(),
    duePaisa: paisa("due_paisa").notNull(),
    paidPaisa: paisa("paid_paisa").notNull().default(0),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("zakat_user_idx").on(t.userId, t.assessedOn)],
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

/**
 * The admin console's password and session.
 *
 * Server-only: RLS is forced with no policies and the client roles hold no
 * privilege (migration 0015), so this is reachable through Drizzle as `postgres`
 * and nowhere else. WHO the admin is lives in ADMIN_EMAIL, not here — this table
 * only answers "has that person set a console password, and is it this one".
 */
export const adminAuth = pgTable("admin_auth", {
  userId: uuid("user_id").primaryKey(),
  passSalt: text("pass_salt").notNull(),
  passHash: text("pass_hash").notNull(),
  /** Hash of the console session token; the cookie carries the raw value. */
  sessionHash: text("session_hash"),
  sessionExpiresAt: timestamp("session_expires_at", { withTimezone: true }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
