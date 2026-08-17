import { notFound } from "next/navigation";
import { Landmark, Target } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TransactionList, ExpenseBars } from "@/components/dashboard/TransactionList";
import { Breakdown } from "@/components/dashboard/Breakdown";
import { BalanceSheet } from "@/components/dashboard/BalanceSheet";
import { NetWorthHero } from "@/components/dashboard/NetWorthHero";
import { Attention } from "@/components/dashboard/Attention";
import { Meter } from "@/components/ui/Meter";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { CHART } from "@/lib/chart";

/**
 * Accessibility harness — DEVELOPMENT ONLY.
 *
 * The dashboard sits behind authentication, which makes its contrast and
 * tap-target compliance impossible to measure without a session. Those two
 * properties depend on CSS and markup, not on data, so rendering the same
 * components against fixture props measures exactly the same thing.
 *
 * `notFound()` in production: this route bypasses the proxy's auth guard by
 * living outside /dashboard, so it must never exist in a deployed build. It
 * shows no real data — every value below is invented — but a page under /dev
 * that renders app chrome has no business being reachable by anyone.
 */
export default function AuditHarness() {
  if (process.env.NODE_ENV === "production") notFound();

  const P = (rupees: number) => Math.round(rupees * 100);

  const breakdown = {
    psxPaisa: P(1_092_400),
    fundsPaisa: P(412_500),
    cashPaisa: P(486_000),
    otherPaisa: P(2_400_000),
    committeesPaisa: P(75_000),
    liabilitiesPaisa: P(1_180_000),
    assetsPaisa: P(4_465_900),
    netPaisa: P(3_285_900),
  };

  /**
   * A month of daily snapshots. Enough points that the chart exercises its axis
   * properly — a two-point series would not show whether dates collide or the
   * value labels line up with their gridlines.
   */
  const series = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.UTC(2026, 6, 19) + i * 864e5);
    return {
      date: day.toISOString().slice(0, 10),
      valuePaisa: P(2_600_000 + i * 23_000 + Math.round(Math.sin(i / 3) * 110_000)),
    };
  });

  const loans = [
    {
      id: "l1",
      name: "Car loan",
      lender: "Meezan Bank",
      installment_paisa: P(42_500),
      due_day: 5,
      due_date: null,
      remainingPaisa: P(1_180_000),
      repaidPct: 5.6,
    },
  ];

  const goals = [
    {
      id: "g1",
      name: "Emergency fund",
      onTrack: false,
      monthlyNeededPaisa: P(64_000),
      target_date: "2027-01-01",
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
    >
      <div className="flex-1 px-5 py-6 sm:px-6">
        <PageHeader
          title="Audit harness"
          subtitle="Dashboard components against fixture data — no real figures here"
          freshness={{ label: "As of 16 Aug, 15:30 PKT", tone: "live" }}
          search="Search something"
        />

        <StatRow
          stats={[
            { k: "Market value", v: "1,092,400" },
            { k: "Invested", v: "1,033,000", tone: "muted" },
            { k: "Unrealised", v: "59,400", tone: "gain" },
            { k: "Return", v: "-4.50%", tone: "loss" },
          ]}
        />

        <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
          <Panel title="Panel with a subtitle" subtitle="Secondary line at 13px">
            <p className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
              Body copy in text-secondary, the step used for most prose.
            </p>
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              Muted, used for supporting detail.
            </p>
            <p className="mt-2 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              Faint at 11.5px — the smallest and quietest combination in the app,
              and the one that previously failed AA.
            </p>
            <Meter value={62} className="mt-4" />
          </Panel>

          <NetWorthHero
            notation="international"
            netPaisa={breakdown.netPaisa}
            series={series}
          />

          {/* Two points is the minimum the chart will draw, and the state a real
              account is in on its second day — worth rendering because the axis
              has to stay legible with only a pair of dates. */}
          <NetWorthHero
            notation="international"
            netPaisa={0}
            series={[
              { date: "2026-08-16", valuePaisa: P(318_480) },
              { date: "2026-08-17", valuePaisa: 0 },
            ]}
          />

          <BalanceSheet notation="international" breakdown={breakdown} loans={loans} />
        </div>

        <div className="mb-5">
          <Attention
            loans={loans}
            goals={goals}
            counts={{ accounts: 0, trades: 0, funds: 0, goals: 0 }}
          />
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-3">
          <Panel title="Transactions" bodyClassName="p-0">
            <TransactionList
              withIcon
              items={[
                { id: "1", label: "Salary", meta: "Income · 1 Aug", amount: 420000 },
                { id: "2", label: "Rent", meta: "Rent · 3 Aug", amount: -120000 },
                { id: "3", label: "K-Electric", meta: "Utilities · 9 Aug", amount: -18500 },
              ]}
            />
          </Panel>

          <Panel title="Where it went">
            <ExpenseBars
              items={[
                { key: "Rent", value: 120000, pct: 41.7 },
                { key: "Groceries", value: 64000, pct: 22.3 },
                { key: "Utilities", value: 38500, pct: 13.4 },
              ]}
            />
          </Panel>

          <Panel title="By sector">
            <Breakdown
              notation="international"
              items={[
                { key: "Commercial Banks", value: 502000, pct: 46, color: CHART[0] },
                { key: "Cement", value: 338000, pct: 31, color: CHART[1] },
                { key: "Oil & Gas", value: 251000, pct: 23, color: CHART[2] },
              ]}
            />
          </Panel>
        </div>

        <div className="mb-5 grid gap-5 xl:grid-cols-2">
          <Panel title="Form controls">
            <div className="flex flex-col gap-4">
              <Field label="Account name" placeholder="Meezan Bank" defaultValue="" />
              <Field label="With a hint" placeholder="4471" hint="Optional. Never store the full number." />
              <Field label="With an error" defaultValue="oops" error="That email and password don't match." />
              <Select
                label="Type"
                name="kind"
                options={[["CURRENT", "Current"], ["SAVINGS", "Savings"]]}
              />
            </div>
          </Panel>

          <Panel title="Empty state" bodyClassName="p-0">
            <EmptyState
              Icon={Landmark}
              title="No accounts yet"
              body="Add the accounts you want to track and enter their balances. PakFinance never asks for a bank login."
              action={
                <button
                  className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-[550]"
                  style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
                >
                  Add account
                </button>
              }
            />
          </Panel>
        </div>

        <Panel title="Goal card" bodyClassName="p-5">
          <div className="flex items-center gap-4">
            <Target size={18} strokeWidth={1.7} color="var(--brass-text)" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold">Emergency fund</div>
              <div className="mt-1 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                180,000 of 500,000
              </div>
              <Meter value={36} color="var(--color-warning)" className="mt-3" />
              <div className="mt-2 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                Behind schedule at the current rate
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
