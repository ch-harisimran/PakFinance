/**
 * Render the PDF report against sample data.
 *
 *   npx tsx scripts/verify-report.ts
 *
 * No database and no session — this exercises the layout, which is the part that
 * fails silently. Writes report-sample.pdf so a page break landing in the wrong
 * place is visible before a user finds it.
 */
import fs from "node:fs";
import { renderReport } from "../lib/report/Report";
import type { ReportData } from "../lib/report/data";

const P = (rupees: number) => Math.round(rupees * 100);

const holding = (
  symbol: string,
  qty: number,
  avg: number,
  last: number,
): ReportData["holdings"][number] => {
  const costPaisa = P(qty * avg);
  const valuePaisa = P(qty * last);
  return {
    symbol,
    qty,
    costPaisa,
    avgCostPaisa: P(avg),
    realisedPaisa: 0,
    dividendPaisa: 0,
    lastPaisa: P(last),
    valuePaisa,
    unrealisedPaisa: valuePaisa - costPaisa,
    returnPct: ((valuePaisa - costPaisa) / costPaisa) * 100,
    dayChangePct: null,
  };
};

const holdings = [
  holding("OGDC", 1500, 198.4, 218.4),
  holding("LUCK", 150, 980.25, 1042.75),
  holding("MEBL", 800, 300.1, 287.1),
  holding("ENGRO", 400, 290.0, 318.65),
];

const psxPaisa = holdings.reduce((s, h) => s + h.valuePaisa, 0);
const psxCostPaisa = holdings.reduce((s, h) => s + h.costPaisa, 0);
const fundsPaisa = P(412_500);
const cashPaisa = P(486_000);
const liabilitiesPaisa = P(1_180_000);
const assetsPaisa = psxPaisa + fundsPaisa + cashPaisa;

// A year of plausible drift, so the trend line has something to draw.
const series = Array.from({ length: 120 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 3, 1) + i * 864e5);
  const wave = Math.sin(i / 11) * 90_000 + i * 2_400;
  return { date: d.toISOString().slice(0, 10), valuePaisa: P(1_900_000 + wave) };
});

const data = {
  profile: null,
  name: "Mohammad Haris Imran",
  generatedAt: new Date(),
  priceAsOf: new Date(),
  breakdown: {
    psxPaisa,
    fundsPaisa,
    cashPaisa,
    liabilitiesPaisa,
    assetsPaisa,
    netPaisa: assetsPaisa - liabilitiesPaisa,
  },
  holdings,
  positions: [
    {
      fundId: "f1",
      units: 4200.5,
      costPaisa: P(300_000),
      avgNavPaisa: P(71.42),
      realisedPaisa: 0,
      lastNavPaisa: P(78.42),
      lastNavDate: "2026-08-14",
      navPaisa: P(78.42),
      navDate: "2026-08-14",
      navSource: "official" as const,
      valuePaisa: P(329_403),
      gainPaisa: P(29_403),
      returnPct: 9.8,
    },
    {
      fundId: "f2",
      units: 900,
      costPaisa: P(90_000),
      avgNavPaisa: P(100),
      realisedPaisa: 0,
      lastNavPaisa: P(92.33),
      lastNavDate: "2026-08-14",
      navPaisa: P(92.33),
      navDate: "2026-08-14",
      navSource: "own" as const,
      valuePaisa: P(83_097),
      gainPaisa: P(-6_903),
      returnPct: -7.67,
    },
  ],
  fundMeta: new Map([
    ["f1", { id: "f1", name: "Meezan Islamic Fund", amc: "Al Meezan", category: "Islamic Equity", isIslamic: true, createdBy: null }],
    ["f2", { id: "f2", name: "NBP Money Market Fund", amc: "NBP Funds", category: "Money Market", isIslamic: false, createdBy: null }],
  ]),
  accounts: [
    { id: "a1", name: "Meezan Bank", kind: "CURRENT", masked_number: "4471", balance_paisa: P(318_000), as_of: "2026-08-15" },
    { id: "a2", name: "Cash in hand", kind: "CASH", masked_number: null, balance_paisa: P(168_000), as_of: "2026-08-12" },
  ],
  loans: [
    {
      id: "l1", name: "Car loan", lender: "Meezan Bank", kind: "CAR", direction: "BORROWED",
      principal_paisa: P(1_250_000), markup_rate: "16.5", installment_paisa: P(42_500),
      tenure_months: 60, start_date: "2025-02-05", due_day: 5, due_date: null,
      reminder_enabled: true, reminder_days_before: 3, is_settled: false, loan_payments: [],
      repaidPaisa: P(70_000), remainingPaisa: P(1_180_000), repaidPct: 5.6,
    },
  ],
  goals: [
    {
      id: "g1", name: "Emergency fund", category: "Emergency", target_paisa: P(500_000),
      target_date: "2027-01-01", status: "ACTIVE", goal_contributions: [],
      savedPaisa: P(180_000), pct: 36, monthlyNeededPaisa: P(64_000), onTrack: false,
    },
  ],
  flow: {
    incomePaisa: P(420_000),
    expensesPaisa: P(287_500),
    netPaisa: P(132_500),
    count: 23,
    categories: [
      { key: "Rent", value: P(120_000), pct: 41.7 },
      { key: "Groceries", value: P(64_000), pct: 22.3 },
      { key: "Utilities", value: P(38_500), pct: 13.4 },
      { key: "Transport", value: P(31_000), pct: 10.8 },
      { key: "Other", value: P(34_000), pct: 11.8 },
    ],
  },
  txns: Array.from({ length: 30 }, (_, i) => ({
    id: `t${i}`,
    label: ["Salary", "Rent", "Groceries", "K-Electric", "Fuel", "Dining"][i % 6],
    category: ["Income", "Rent", "Groceries", "Utilities", "Transport", "Dining"][i % 6],
    amount_paisa: i % 6 === 0 ? P(420_000) : P(-(2_500 + i * 730)),
    occurred_at: new Date(Date.UTC(2026, 7, 15 - (i % 28))).toISOString(),
    account_id: "a1",
  })),
  series,
  bySector: [
    { key: "0813", valuePaisa: Math.round(psxPaisa * 0.46), pct: 46 },
    { key: "0825", valuePaisa: Math.round(psxPaisa * 0.31), pct: 31 },
    { key: "0801", valuePaisa: Math.round(psxPaisa * 0.23), pct: 23 },
  ],
  invested: { psxPaisa: psxCostPaisa, fundsPaisa: P(390_000) },
  isEmpty: false,
  insights: [
    { title: "Your investments are ahead", body: "You have put in PKR 1,033,000 across stocks and funds, worth PKR 1,092,400 today — a gain of PKR 59,400, or 5.7%. This counts brokerage and charges as part of what you paid, so it is the return you actually earned.", tone: "good" as const },
    { title: "OGDC is 21% of everything you own", body: "A single scrip carrying that much of your net worth means one company's bad year is your bad year. Nothing is wrong with conviction — this is just the number worth knowing before the market tells you.", tone: "watch" as const },
    { title: "You owe 62% of what you own", body: "PKR 1,180,000 outstanding against PKR 1,902,000 in assets, leaving a net worth of PKR 722,000. Above half is heavy: repayment competes with everything else you want to do with the money.", tone: "watch" as const },
    { title: "Your cash covers about 1.7 months of spending", body: "PKR 486,000 in accounts against PKR 287,500 spent this month. Three to six months is the usual advice for an emergency buffer — you are below it.", tone: "watch" as const },
    { title: "You kept 32% of what came in this month", body: "PKR 420,000 in, PKR 287,500 out. That is PKR 132,500 added to your position.", tone: "good" as const },
  ],
} as unknown as ReportData;

async function main() {
  const started = Date.now();
  const buffer = await renderReport(data);
  const out = "report-sample.pdf";
  fs.writeFileSync(out, buffer);

  const header = buffer.subarray(0, 5).toString("latin1");
  const text = buffer.toString("latin1");
  const pages = (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const outline = text.includes("/Outlines");

  console.log(`rendered in ${Date.now() - started}ms`);
  console.log(`file:      ${out} (${(buffer.length / 1024).toFixed(1)} KB)`);
  console.log(`header:    ${header} ${header === "%PDF-" ? "OK" : "NOT A PDF"}`);
  console.log(`pages:     ${pages}`);
  console.log(`outline:   ${outline ? "present" : "MISSING"}`);

  if (header !== "%PDF-" || pages < 1) process.exit(1);
}

main().catch((e: unknown) => {
  console.error("render failed:", (e as Error).message);
  process.exit(1);
});
