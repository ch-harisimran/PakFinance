import { createClient } from "@/lib/supabase/server";
import {
  getAccounts,
  getTransactions,
  getLoans,
  getGoals,
  getProfile,
} from "@/lib/queries";
import { getTrades } from "@/lib/queries-psx";
import { getFundOrders } from "@/lib/queries-funds";
import {
  getAssets,
  getBudgets,
  getCommittees,
  getRecurring,
  getZakatHistory,
} from "@/lib/queries-wealth";

/**
 * Export everything this user has entered.
 *
 * Read through the same RLS-bound helpers the screens use, so an export can only
 * ever contain the caller's own rows — there is no admin path here to get wrong.
 *
 * Amounts are written in RUPEES, not paisa. The database stores integer paisa to
 * avoid float error, but a spreadsheet opened by a human should say 42,500 where
 * the app says PKR 42,500.
 */

export const dynamic = "force-dynamic";
// PDF rendering is heavier than serialising rows, and A4 pages of tables take a
// moment on a cold function.
export const maxDuration = 60;

const rupees = (paisa: number | null | undefined) =>
  paisa === null || paisa === undefined ? "" : (paisa / 100).toFixed(2);

/** RFC 4180: quote everything, double any embedded quote. */
function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells
    .map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`)
    .join(",");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });

  const requested = new URL(request.url).searchParams.get("format");
  const format = requested === "csv" ? "csv" : requested === "pdf" ? "pdf" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  /**
   * The PDF is a different kind of artefact from the other two: CSV and JSON are
   * your records handed back verbatim, while this is a report *about* them, with
   * derived figures and observations. It therefore has its own assembly path
   * rather than being squeezed through the row dumps below.
   */
  if (format === "pdf") {
    const { buildReportData } = await import("@/lib/report/data");
    const { renderReport } = await import("@/lib/report/Report");

    const data = await buildReportData();
    const pdf = await renderReport(data);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="pakfinance-report-${stamp}.pdf"`,
      },
    });
  }

  /**
   * Every table the user can put a row in. When a new record type is added to
   * the app it has to be added here too — the delete-account dialog tells people
   * to export first, so anything missing from this list is data they were
   * promised they could keep.
   *
   * All of these read over Supabase's HTTP API, not Drizzle, so the width of
   * this fan-out is not subject to the pool ceiling in lib/db/client.ts.
   */
  const [
    profile,
    accounts,
    transactions,
    loans,
    goals,
    trades,
    fundOrders,
    assets,
    budgets,
    recurring,
    committees,
    zakat,
  ] = await Promise.all([
    getProfile(),
    getAccounts(),
    getTransactions(10_000),
    getLoans(),
    getGoals(),
    getTrades(),
    getFundOrders(),
    getAssets(),
    getBudgets(false),
    getRecurring(),
    getCommittees(),
    getZakatHistory(0),
  ]);

  if (format === "json") {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: profile && {
        name: profile.fullName,
        email: profile.email,
        phone: profile.phone,
      },
      accounts: accounts.map((a) => ({
        name: a.name,
        kind: a.kind,
        lastFour: a.masked_number,
        balance: Number(rupees(a.balance_paisa)),
        asOf: a.as_of,
      })),
      transactions: transactions.map((t) => ({
        date: t.occurred_at,
        label: t.label,
        category: t.category,
        amount: Number(rupees(t.amount_paisa)),
      })),
      loans: loans.map((l) => ({
        name: l.name,
        lender: l.lender,
        kind: l.kind,
        principal: Number(rupees(l.principal_paisa)),
        markupRate: l.markup_rate,
        installment: Number(rupees(l.installment_paisa)),
        startDate: l.start_date,
        payments: l.loan_payments.map((p) => ({
          date: p.paid_at,
          amount: Number(rupees(p.amount_paisa)),
        })),
      })),
      goals: goals.map((g) => ({
        name: g.name,
        category: g.category,
        target: Number(rupees(g.target_paisa)),
        targetDate: g.target_date,
        contributions: g.goal_contributions.map((c) => ({
          date: c.occurred_at,
          amount: Number(rupees(c.amount_paisa)),
        })),
      })),
      psxTrades: trades.map((t) => ({
        date: t.tradedAt,
        symbol: t.symbol,
        type: t.type,
        quantity: t.quantity,
        price: Number(rupees(t.pricePaisa)),
        brokerage: Number(rupees(t.commissionPaisa)),
        otherCharges: Number(rupees(t.otherChargesPaisa)),
      })),
      fundOrders: fundOrders.map((o) => ({
        date: o.tradedAt,
        fundId: o.fundId,
        type: o.type,
        units: o.units,
        nav: Number(rupees(o.navPaisa)),
        amount: Number(rupees(o.amountPaisa)),
      })),
      assets: assets.map((a) => ({
        name: a.name,
        kind: a.kind,
        quantity: a.quantity,
        unit: a.unit,
        cost: a.cost_paisa === null ? null : Number(rupees(a.cost_paisa)),
        value: Number(rupees(a.value_paisa)),
        valuedOn: a.as_of,
        zakatable: a.zakatable,
        note: a.note,
      })),
      budgets: budgets.map((b) => ({
        category: b.category,
        monthlyLimit: Number(rupees(b.limit_paisa)),
        active: b.is_active,
      })),
      recurring: recurring.map((r) => ({
        label: r.label,
        category: r.category,
        amount: Number(rupees(r.amount_paisa)),
        cadence: r.cadence,
        dayOfPeriod: r.day_of_period,
        startDate: r.start_date,
        endDate: r.end_date,
        lastPostedOn: r.last_posted_on,
        active: r.is_active,
      })),
      committees: committees.map((c) => ({
        name: c.name,
        organiser: c.organiser,
        members: c.members,
        monthly: Number(rupees(c.monthly_paisa)),
        startMonth: c.start_month,
        payoutPosition: c.payout_position,
        payoutReceived: c.payout_received,
        payoutDate: c.payout_date,
        settled: c.is_settled,
        payments: c.committee_payments.map((p) => ({
          date: p.paid_at,
          amount: Number(rupees(p.amount_paisa)),
        })),
      })),
      zakatAssessments: zakat.map((z) => ({
        assessedOn: z.assessed_on,
        nisab: Number(rupees(z.nisab_paisa)),
        assets: Number(rupees(z.assets_paisa)),
        deductions: Number(rupees(z.deductions_paisa)),
        zakatable: Number(rupees(z.zakatable_paisa)),
        due: Number(rupees(z.due_paisa)),
        paid: Number(rupees(z.paid_paisa)),
      })),
    };

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="pakfinance-${stamp}.json"`,
      },
    });
  }

  /**
   * One flat ledger rather than a zip of per-table files: every row is a money
   * event with a date, a source and an amount, which is the shape a spreadsheet
   * can actually sort and pivot.
   *
   * Only flows belong here. Assets, budgets, recurring rules and Zakat
   * assessments are positions, plans and obligations — dropping them into a
   * column of transactions would make any total of it wrong. They are in the
   * JSON export, which is the complete one; the settings card says so.
   */
  const rows: string[] = [
    csvRow(["date", "source", "description", "category", "quantity", "unit_price", "amount_pkr"]),
  ];

  for (const t of transactions) {
    rows.push(
      csvRow([
        String(t.occurred_at).slice(0, 10),
        "transaction",
        t.label,
        t.category,
        "",
        "",
        rupees(t.amount_paisa),
      ]),
    );
  }
  for (const l of loans) {
    for (const p of l.loan_payments) {
      // Negative: a repayment is money leaving, same as a debit above.
      rows.push(
        csvRow([p.paid_at, "loan payment", l.name, l.lender, "", "", `-${rupees(p.amount_paisa)}`]),
      );
    }
  }
  for (const g of goals) {
    for (const c of g.goal_contributions) {
      rows.push(
        csvRow([c.occurred_at, "goal contribution", g.name, g.category, "", "", `-${rupees(c.amount_paisa)}`]),
      );
    }
  }
  for (const t of trades) {
    rows.push(
      csvRow([
        t.tradedAt,
        "psx trade",
        `${t.type} ${t.symbol}`,
        "",
        t.quantity,
        rupees(t.pricePaisa),
        rupees(Math.round(t.quantity * t.pricePaisa) + t.commissionPaisa + t.otherChargesPaisa),
      ]),
    );
  }
  for (const o of fundOrders) {
    rows.push(
      csvRow([o.tradedAt, "fund order", o.type, "", o.units, rupees(o.navPaisa), rupees(o.amountPaisa)]),
    );
  }
  for (const c of committees) {
    for (const p of c.committee_payments) {
      // Negative for the same reason as a loan payment: the money has left.
      rows.push(
        csvRow([p.paid_at, "committee payment", c.name, c.organiser, "", "", `-${rupees(p.amount_paisa)}`]),
      );
    }
  }

  // BOM so Excel opens UTF-8 correctly — without it, a name with an accent or a
  // rupee sign arrives as mojibake.
  return new Response("﻿" + rows.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pakfinance-${stamp}.csv"`,
    },
  });
}
