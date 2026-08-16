import "server-only";

import { getDashboard, getNetWorthSeries } from "@/lib/queries-networth";
import { getSecurityMeta, getPriceAsOf } from "@/lib/queries-psx";
import { getProfile, displayNameOf } from "@/lib/report/util";

/**
 * Everything the PDF report needs, assembled once.
 *
 * Built on `getDashboard()` so the report and the dashboard can never disagree —
 * a report that quotes a different net worth than the screen it came from is
 * worse than no report.
 *
 * The insight list is the point of the document. A dump of tables tells a user
 * what they already typed in; the observations below tell them something they
 * would otherwise have to work out themselves, and each one is derived, never
 * canned — if the data does not support a claim, the claim is not made.
 */

export type InsightTone = "good" | "watch" | "neutral";

export interface Insight {
  title: string;
  body: string;
  tone: InsightTone;
}

export async function buildReportData() {
  const profile = await getProfile();
  const data = await getDashboard();

  // Sequential: these are Drizzle reads, and the client's pool is the limit —
  // see the warning in lib/db/client.ts.
  const symbols = [...new Set(data.holdings.map((h) => h.symbol))];
  const sectorMeta = await getSecurityMeta(symbols);
  const priceAsOf = await getPriceAsOf();
  const series = await getNetWorthSeries(365);

  const { breakdown, holdings, positions, accounts, loans, goals, flow, txns, invested } = data;

  // Sector concentration, biggest first.
  const bySector = [...holdings.reduce((m, h) => {
    const key = sectorMeta.get(h.symbol)?.sectorName ?? "Unclassified";
    m.set(key, (m.get(key) ?? 0) + h.valuePaisa);
    return m;
  }, new Map<string, number>())]
    .map(([key, value]) => ({
      key,
      valuePaisa: value,
      pct: breakdown.psxPaisa ? (value / breakdown.psxPaisa) * 100 : 0,
    }))
    .sort((a, b) => b.valuePaisa - a.valuePaisa);

  return {
    profile,
    name: displayNameOf(profile),
    generatedAt: new Date(),
    priceAsOf,
    breakdown,
    holdings,
    positions,
    fundMeta: data.fundMeta,
    accounts,
    loans,
    goals,
    flow,
    txns,
    series,
    bySector,
    invested,
    isEmpty: data.isEmpty,
    insights: deriveInsights({ breakdown, holdings, positions, accounts, loans, goals, flow, invested, bySector }),
  };
}

export type ReportData = Awaited<ReturnType<typeof buildReportData>>;

/**
 * Derived from `getDashboard`, NOT from `ReportData`.
 *
 * `ReportData` is inferred from `buildReportData`, which calls `deriveInsights` —
 * so typing this from `ReportData` makes the inference chase its own tail and
 * TypeScript gives up with "circularly references itself".
 */
type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

export interface Sector {
  key: string;
  valuePaisa: number;
  pct: number;
}

type InsightInput = Pick<
  Dashboard,
  "breakdown" | "holdings" | "positions" | "accounts" | "loans" | "goals" | "flow" | "invested"
> & { bySector: Sector[] };

const pct = (n: number) => `${n.toFixed(n < 10 ? 1 : 0)}%`;
const rupees = (paisa: number) =>
  `PKR ${Math.round(paisa / 100).toLocaleString("en-US")}`;

function deriveInsights(d: InsightInput): Insight[] {
  const out: Insight[] = [];
  const invested = d.invested.psxPaisa + d.invested.fundsPaisa;
  const marketValue = d.breakdown.psxPaisa + d.breakdown.fundsPaisa;

  // 1. Overall investment return.
  if (invested > 0) {
    const gain = marketValue - invested;
    const r = (gain / invested) * 100;
    out.push({
      title: gain >= 0 ? "Your investments are ahead" : "Your investments are behind",
      body:
        `You have put in ${rupees(invested)} across stocks and funds, worth ` +
        `${rupees(marketValue)} today — ${gain >= 0 ? "a gain" : "a loss"} of ` +
        `${rupees(Math.abs(gain))}, or ${pct(Math.abs(r))}. This counts brokerage and ` +
        `charges as part of what you paid, so it is the return you actually earned.`,
      tone: gain >= 0 ? "good" : "watch",
    });
  }

  // 2. Single-holding concentration. The classic quiet risk.
  const top = d.holdings[0];
  if (top && d.breakdown.assetsPaisa > 0) {
    const share = (top.valuePaisa / d.breakdown.assetsPaisa) * 100;
    if (share >= 20) {
      out.push({
        title: `${top.symbol} is ${pct(share)} of everything you own`,
        body:
          `A single scrip carrying that much of your net worth means one company's ` +
          `bad year is your bad year. Nothing is wrong with conviction — this is ` +
          `just the number worth knowing before the market tells you.`,
        tone: "watch",
      });
    }
  }

  // 3. Sector concentration.
  const topSector = d.bySector[0];
  if (topSector && topSector.pct >= 40 && d.holdings.length > 1) {
    out.push({
      title: `${pct(topSector.pct)} of your equity sits in one sector`,
      body:
        `Holding several scrips is not the same as being diversified if they rise ` +
        `and fall together. Sector ${topSector.key} accounts for ${rupees(topSector.valuePaisa)} ` +
        `of your ${rupees(d.breakdown.psxPaisa)} in stocks.`,
      tone: "watch",
    });
  }

  // 4. Debt against assets.
  if (d.breakdown.liabilitiesPaisa > 0 && d.breakdown.assetsPaisa > 0) {
    const ratio = (d.breakdown.liabilitiesPaisa / d.breakdown.assetsPaisa) * 100;
    out.push({
      title: `You owe ${pct(ratio)} of what you own`,
      body:
        `${rupees(d.breakdown.liabilitiesPaisa)} outstanding against ` +
        `${rupees(d.breakdown.assetsPaisa)} in assets, leaving a net worth of ` +
        `${rupees(d.breakdown.netPaisa)}.` +
        (ratio > 50
          ? " Above half is heavy: repayment competes with everything else you want to do with the money."
          : " That is a manageable ratio."),
      tone: ratio > 50 ? "watch" : "good",
    });
  }

  // 5. Cash runway — the number that decides whether a bad month is survivable.
  if (d.flow.expensesPaisa > 0 && d.breakdown.cashPaisa > 0) {
    const months = d.breakdown.cashPaisa / d.flow.expensesPaisa;
    out.push({
      title: `Your cash covers about ${months.toFixed(1)} months of spending`,
      body:
        `${rupees(d.breakdown.cashPaisa)} in accounts against ${rupees(d.flow.expensesPaisa)} ` +
        `spent this month. Three to six months is the usual advice for an emergency ` +
        `buffer${months < 3 ? " — you are below it." : "."}`,
      tone: months < 3 ? "watch" : "good",
    });
  }

  // 6. Savings rate this month.
  if (d.flow.incomePaisa > 0) {
    const rate = (d.flow.netPaisa / d.flow.incomePaisa) * 100;
    out.push({
      title:
        rate >= 0
          ? `You kept ${pct(rate)} of what came in this month`
          : "You spent more than you earned this month",
      body:
        `${rupees(d.flow.incomePaisa)} in, ${rupees(d.flow.expensesPaisa)} out. ` +
        (rate >= 0
          ? `That is ${rupees(d.flow.netPaisa)} added to your position.`
          : `The shortfall of ${rupees(Math.abs(d.flow.netPaisa))} came out of savings.`),
      tone: rate >= 0 ? "good" : "watch",
    });
  }

  // 7. Where the money actually goes.
  const topCategory = d.flow.categories[0];
  if (topCategory && d.flow.expensesPaisa > 0) {
    out.push({
      title: `${topCategory.key} took ${pct(topCategory.pct)} of your spending`,
      body:
        `${rupees(topCategory.value)} this month, the largest single category. ` +
        `Spending is easier to change than income, and the biggest line is where ` +
        `the change is worth the effort.`,
      tone: "neutral",
    });
  }

  // 8. Goals off pace.
  const behind = d.goals.filter((g) => !g.onTrack && g.target_date);
  if (behind.length) {
    const needed = behind.reduce((s, g) => s + g.monthlyNeededPaisa, 0);
    out.push({
      title: `${behind.length} goal${behind.length === 1 ? " is" : "s are"} behind schedule`,
      body:
        `${behind.map((g) => g.name).join(", ")}. Keeping the target dates would take ` +
        `${rupees(needed)} a month between them. Moving a date is a legitimate answer ` +
        `too — a plan you cannot fund is not a plan.`,
      tone: "watch",
    });
  }

  // 9. Monthly debt obligation against income.
  const monthly = d.loans.reduce((s, l) => s + (l.installment_paisa ?? 0), 0);
  if (monthly > 0 && d.flow.incomePaisa > 0) {
    const share = (monthly / d.flow.incomePaisa) * 100;
    out.push({
      title: `Installments take ${pct(share)} of your monthly income`,
      body:
        `${rupees(monthly)} committed every month before anything else is decided.` +
        (share > 40 ? " Lenders generally consider above 40% stretched." : ""),
      tone: share > 40 ? "watch" : "neutral",
    });
  }

  // 10. Nothing to say is itself worth saying honestly.
  if (!out.length) {
    out.push({
      title: "Not enough history yet",
      body:
        "Once you have logged a month of income and spending, and entered your " +
        "holdings, this section fills with observations drawn from your own numbers " +
        "rather than general advice.",
      tone: "neutral",
    });
  }

  return out;
}
