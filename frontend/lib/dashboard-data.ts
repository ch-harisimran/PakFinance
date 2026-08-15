/**
 * Dashboard fixture data.
 *
 * Every figure reconciles — holdings sum to the PSX total, assets minus
 * liabilities equals net worth, expense categories sum to the cash-flow
 * expense figure. The reference mock had 1,000 OGDC at ~7 rupees showing a
 * value of 2M; numbers that don't add up are the fastest way to lose a
 * finance user's trust, even in a prototype.
 *
 * `freshness` is per source, not global. PSX is delayed, NAVs are daily, and
 * anything manual is only as fresh as the last time you typed it.
 */

export type Freshness = { label: string; tone: "live" | "daily" | "manual" };

export const FRESH = {
  psx: { label: "Delayed 15m · 15:12 PKT", tone: "live" } satisfies Freshness,
  nav: { label: "NAV as of 14 Aug", tone: "daily" } satisfies Freshness,
  manual: { label: "You · 12 Aug", tone: "manual" } satisfies Freshness,
};

export const MARKET_OPEN = true;

/* ── Holdings ─────────────────────────────────────────────────────────────── */

export const HOLDINGS = [
  { sym: "OGDC", name: "Oil & Gas Development", qty: 1200, avg: 186.5, last: 218.4 },
  { sym: "HBL", name: "Habib Bank", qty: 2000, avg: 141.0, last: 154.2 },
  { sym: "MEBL", name: "Meezan Bank", qty: 800, avg: 264.0, last: 287.1 },
  { sym: "LUCK", name: "Lucky Cement", qty: 150, avg: 905.0, last: 1042.75 },
  { sym: "ENGRO", name: "Engro Corporation", qty: 450, avg: 322.0, last: 318.65 },
].map((h) => {
  // Round at the row, then total the rounded rows. Summing unrounded values and
  // rounding once at the end makes the displayed rows fail to add up to the
  // displayed total — LUCK at 150 × 1042.75 lands on .5 and throws the column
  // out by a rupee. Users add these up.
  const cost = Math.round(h.qty * h.avg);
  const value = Math.round(h.qty * h.last);
  return { ...h, cost, value, gain: value - cost, pct: ((value - cost) / cost) * 100 };
});

export const PSX_VALUE = HOLDINGS.reduce((s, h) => s + h.value, 0);
export const PSX_COST = HOLDINGS.reduce((s, h) => s + h.cost, 0);
export const PSX_GAIN_PCT = ((PSX_VALUE - PSX_COST) / PSX_COST) * 100;

/* ── Mutual funds ─────────────────────────────────────────────────────────── */

export const FUNDS = [
  { name: "Meezan Islamic Fund", amc: "Al Meezan", cat: "Islamic Equity", units: 4200, nav: 78.42 },
  { name: "UBL Liquidity Plus", amc: "UBL Funds", cat: "Money Market", units: 1500, nav: 112.87 },
  { name: "Atlas Income Fund", amc: "Atlas AMC", cat: "Income", units: 95, nav: 541.3 },
].map((f) => ({ ...f, value: Math.round(f.units * f.nav) }));

export const FUNDS_VALUE = FUNDS.reduce((s, f) => s + f.value, 0);

/* ── Cash & other ─────────────────────────────────────────────────────────── */

export const ACCOUNTS = [
  { name: "Meezan Bank", kind: "Current · ****4471", balance: 350000 },
  { name: "HBL", kind: "Savings · ****8820", balance: 420000 },
  { name: "Cash in hand", kind: "Manual", balance: 80000 },
];

export const BANK_VALUE = ACCOUNTS.reduce((s, a) => s + a.balance, 0);
export const GOLD_VALUE = 600000;

/* ── Balance sheet ────────────────────────────────────────────────────────── */

export const LIABILITIES = [
  { name: "Car loan", lender: "Meezan Bank", remaining: 470000, principal: 1250000, installment: 42300, dueInDays: 6 },
  { name: "Personal loan", lender: "HBL", remaining: 180000, principal: 400000, installment: 16800, dueInDays: 19 },
];

export const TOTAL_LIABILITIES = LIABILITIES.reduce((s, l) => s + l.remaining, 0);
export const TOTAL_ASSETS = PSX_VALUE + FUNDS_VALUE + BANK_VALUE + GOLD_VALUE;
export const NET_WORTH = TOTAL_ASSETS - TOTAL_LIABILITIES;

/** Categorical hues, not brass tints — see design/tokens.css. */
export const CHART = ["#C9A227", "#4E92B8", "#9080C8", "#C4A08A", "#5FA8A3", "#B9B4A8"];

export const ALLOCATION = [
  { key: "PSX equities", value: PSX_VALUE, color: CHART[0] },
  { key: "Mutual funds", value: FUNDS_VALUE, color: CHART[1] },
  { key: "Bank & cash", value: BANK_VALUE, color: CHART[2] },
  { key: "Gold", value: GOLD_VALUE, color: CHART[3] },
].map((a) => ({ ...a, pct: (a.value / TOTAL_ASSETS) * 100 }));

/* ── Net worth history ────────────────────────────────────────────────────── */

export const NET_WORTH_SERIES = [
  { m: "Sep", v: 1740000 },
  { m: "Oct", v: 1782000 },
  { m: "Nov", v: 1845000 },
  { m: "Dec", v: 1902000 },
  { m: "Jan", v: 1888000 },
  { m: "Feb", v: 1971000 },
  { m: "Mar", v: 2043000 },
  { m: "Apr", v: 2108000 },
  { m: "May", v: 2166000 },
  { m: "Jun", v: 2244000 },
  { m: "Jul", v: 2259700 },
  { m: "Aug", v: NET_WORTH },
];

/* ── Cash flow (August 2026) ──────────────────────────────────────────────── */

export const INCOME = 350000;
export const EXPENSES = 225000;
export const NET_FLOW = INCOME - EXPENSES;

export const CASH_FLOW = [
  { m: "Mar", income: 350000, expenses: 241000 },
  { m: "Apr", income: 350000, expenses: 198000 },
  { m: "May", income: 386000, expenses: 262000 },
  { m: "Jun", income: 350000, expenses: 214000 },
  { m: "Jul", income: 350000, expenses: 233000 },
  { m: "Aug", income: INCOME, expenses: EXPENSES },
];

export const EXPENSE_SPLIT = [
  { key: "Rent", value: 75000 },
  { key: "Loan installments", value: 59100 },
  { key: "Groceries", value: 42000 },
  { key: "Transport", value: 22000 },
  { key: "Utilities", value: 18500 },
  { key: "Other", value: 8400 },
].map((e) => ({ ...e, pct: (e.value / EXPENSES) * 100 }));

/* ── Transactions ─────────────────────────────────────────────────────────── */
/* Money movements, not trades. Trades belong in PSX Portfolio — the reference
   put stock columns under "Recent Transactions", which collapses the very
   distinction the sidebar makes. */

export const TRANSACTIONS = [
  { label: "Salary", meta: "Meezan Bank · 1 Aug", amount: 350000 },
  { label: "Rent", meta: "Standing instruction · 3 Aug", amount: -75000 },
  { label: "Car loan installment", meta: "Meezan Bank · 5 Aug", amount: -42300 },
  { label: "K-Electric", meta: "Utilities · 13 Aug", amount: -11200 },
  { label: "Groceries", meta: "Card · Imtiaz · 12 Aug", amount: -8500 },
];

/* ── Goals ────────────────────────────────────────────────────────────────── */

export const GOALS = [
  { name: "Emergency fund", have: 350000, target: 500000, eta: "Mar 2027", monthly: 12500, onTrack: true },
  { name: "New car", have: 1200000, target: 2000000, eta: "Nov 2028", monthly: 28000, onTrack: true },
  { name: "Dream home", have: 4500000, target: 10000000, eta: "Jun 2032", monthly: 84000, onTrack: false },
].map((g) => ({ ...g, pct: (g.have / g.target) * 100 }));

/* ── Zone 2: what needs you ───────────────────────────────────────────────── */

/* ── Detail-screen data ───────────────────────────────────────────────────── */

export const SECTORS = [
  { key: "Commercial Banks", value: 538080, color: CHART[0] },
  { key: "Oil & Gas", value: 262080, color: CHART[1] },
  { key: "Cement", value: 156413, color: CHART[2] },
  { key: "Fertiliser", value: 143393, color: CHART[3] },
].map((s) => ({ ...s, pct: (s.value / 1099966) * 100 }));

export const TRADES = [
  { type: "BUY" as const, sym: "OGDC", qty: 400, price: 201.5, date: "8 Aug 2026", charges: 620 },
  { type: "DIVIDEND" as const, sym: "HBL", qty: 2000, price: 4.5, date: "2 Aug 2026", charges: 0 },
  { type: "SELL" as const, sym: "PSO", qty: 250, price: 188.4, date: "28 Jul 2026", charges: 410 },
  { type: "BUY" as const, sym: "MEBL", qty: 300, price: 271.0, date: "19 Jul 2026", charges: 505 },
  { type: "BUY" as const, sym: "LUCK", qty: 50, price: 962.0, date: "11 Jul 2026", charges: 470 },
];

export const FUND_CATEGORIES = [
  { key: "Islamic Equity", value: 329364, color: CHART[0] },
  { key: "Money Market", value: 169305, color: CHART[1] },
  { key: "Income", value: 51424, color: CHART[2] },
].map((c) => ({ ...c, pct: (c.value / 550093) * 100 }));

export const FUND_ORDERS = [
  { type: "BUY" as const, fund: "Meezan Islamic Fund", units: 640, nav: 76.1, date: "5 Aug 2026" },
  { type: "BUY" as const, fund: "UBL Liquidity Plus", units: 220, nav: 112.4, date: "1 Aug 2026" },
  { type: "REDEEM" as const, fund: "Atlas Income Fund", units: 30, nav: 538.9, date: "21 Jul 2026" },
];

/** Amortization for the car loan — principal/markup split per installment. */
export const LOAN_SCHEDULE = [
  { n: 44, due: "5 Sep 2026", principal: 35950, markup: 6350, balance: 434050 },
  { n: 45, due: "5 Oct 2026", principal: 36440, markup: 5860, balance: 397610 },
  { n: 46, due: "5 Nov 2026", principal: 36940, markup: 5360, balance: 360670 },
  { n: 47, due: "5 Dec 2026", principal: 37440, markup: 4860, balance: 323230 },
  { n: 48, due: "5 Jan 2027", principal: 37950, markup: 4350, balance: 285280 },
  { n: 49, due: "5 Feb 2027", principal: 38470, markup: 3830, balance: 246810 },
];

export const GOAL_CONTRIBUTIONS = [
  { goal: "Emergency fund", amount: 12500, date: "5 Aug 2026" },
  { goal: "New car", amount: 28000, date: "5 Aug 2026" },
  { goal: "Dream home", amount: 60000, date: "3 Aug 2026" },
  { goal: "Emergency fund", amount: 12500, date: "5 Jul 2026" },
  { goal: "New car", amount: 28000, date: "5 Jul 2026" },
];

export const ATTENTION = [
  {
    kind: "due" as const,
    title: "Car loan installment",
    detail: "Rs 42,300 to Meezan Bank",
    when: "Due in 6 days",
    action: "Log payment",
  },
  {
    kind: "goal" as const,
    title: "Dream home is behind schedule",
    detail: "Rs 84,000/month needed to hit Jun 2032",
    when: "Off track",
    action: "Adjust goal",
  },
  {
    kind: "data" as const,
    title: "2 holdings haven't priced today",
    detail: "ENGRO and LUCK last traded 14 Aug",
    when: "Stale",
    action: "Review",
  },
];
