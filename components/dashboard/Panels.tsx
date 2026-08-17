import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { Meter } from "@/components/ui/Meter";
import { TransactionList, ExpenseBars } from "@/components/dashboard/TransactionList";
import { axisMax, paisaCompact, paisaFull, formatPct, type Notation } from "@/lib/money";
import type { Valued } from "@/lib/market/holdings";
import type { ValuedFund } from "@/lib/market/fund-holdings";
import type { FundMeta } from "@/lib/queries-funds";
import type { TransactionRow } from "@/lib/queries";

/**
 * Zone 3 — the detail. Every panel is presentational; the dashboard page does
 * one round of fetching and passes values down, rather than each card issuing
 * its own queries.
 */

function Empty({ children, href, cta }: { children: string; href: string; cta: string }) {
  return (
    <div className="px-5 py-8 text-center">
      <p className="text-[13px]" style={{ color: "var(--text-faint)" }}>
        {children}
      </p>
      <Link
        href={href}
        // min-h for the 24px WCAG 2.5.8 target; bare inline text rendered at
        // 20px, and on an empty dashboard these links are the only way forward.
        className="mt-3 inline-flex min-h-[24px] items-center text-[12.5px] underline-offset-4 hover:underline"
        style={{ color: "var(--brass-text)" }}
      >
        {cta}
      </Link>
    </div>
  );
}

export function HoldingsPanel({
  holdings,
  valuePaisa,
  costPaisa,
}: {
  holdings: Valued[];
  valuePaisa: number;
  costPaisa: number;
}) {
  const pct = costPaisa > 0 ? ((valuePaisa - costPaisa) / costPaisa) * 100 : 0;

  return (
    <Panel
      title="PSX portfolio"
      subtitle={holdings.length ? `${holdings.length} scrips · ${paisaFull(valuePaisa)}` : undefined}
      bodyClassName="p-0"
      className="xl:col-span-2"
    >
      {holdings.length ? (
        <>
          {holdings.slice(0, 6).map((h) => (
            // The dashboard is a read surface, but every row should still be a
            // way in. `?q=` lands on the owning screen already filtered to the
            // thing you clicked, which is why search had to be real first.
            <Link
              key={h.symbol}
              href={`/dashboard/psx?q=${encodeURIComponent(h.symbol)}`}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-t px-5 py-3 first:border-t-0 transition-colors duration-200 hover:bg-[var(--surface-1)]"
              style={{ borderColor: "var(--border-subtle)" }}
              data-numeric
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
                  {h.symbol}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {h.qty.toLocaleString("en-US")} shares
                </div>
              </div>
              <span className="text-right text-[13px]">{paisaFull(h.valuePaisa)}</span>
              <span
                className="w-[70px] text-right text-[13px] font-semibold"
                style={{ color: h.unrealisedPaisa >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
              >
                {formatPct(h.returnPct)}
              </span>
            </Link>
          ))}
          <div
            className="flex items-baseline justify-between border-t px-5 py-3.5"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span className="text-[12.5px]" style={{ color: "var(--text-muted)" }}>
              Unrealised
            </span>
            <span
              className="text-[13.5px] font-semibold"
              style={{ color: pct >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
              data-numeric
            >
              {formatPct(pct)}
            </span>
          </div>
        </>
      ) : (
        <Empty href="/dashboard/psx" cta="Add a transaction">
          No PSX holdings yet.
        </Empty>
      )}
    </Panel>
  );
}

export function FundsPanel({
  positions,
  meta,
  valuePaisa,
  notation,
}: {
  positions: ValuedFund[];
  meta: Map<string, FundMeta>;
  valuePaisa: number;
  notation: Notation;
}) {
  return (
    <Panel
      title="Mutual funds"
      subtitle={positions.length ? `${paisaFull(valuePaisa)} across ${positions.length}` : undefined}
      bodyClassName={positions.length ? "p-5" : "p-0"}
    >
      {positions.length ? (
        <ul className="flex flex-col gap-4">
          {positions.slice(0, 5).map((p) => (
            <li key={p.fundId}>
              <Link
                href={`/dashboard/funds?q=${encodeURIComponent(meta.get(p.fundId)?.name ?? "")}`}
                className="block rounded-[8px] transition-colors duration-200 hover:bg-[var(--surface-1)]"
              >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13px] font-medium">
                  {meta.get(p.fundId)?.name ?? "Fund"}
                </span>
                <span className="flex-none text-[13px] font-semibold" data-numeric>
                  {paisaCompact(p.valuePaisa, notation)}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-[11.5px]">
                <span className="truncate" style={{ color: "var(--text-faint)" }}>
                  {meta.get(p.fundId)?.category}
                </span>
                <span
                  style={{ color: p.gainPaisa >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
                  data-numeric
                >
                  {formatPct(p.returnPct)}
                </span>
              </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty href="/dashboard/funds" cta="Add an investment">
          No fund holdings yet.
        </Empty>
      )}
    </Panel>
  );
}

export function CashFlowPanel({
  months,
  incomePaisa,
  expensesPaisa,
  netPaisa,
  notation,
}: {
  months: { m: string; income: number; expenses: number }[];
  incomePaisa: number;
  expensesPaisa: number;
  netPaisa: number;
  notation: Notation;
}) {
  const max = axisMax(months.flatMap((m) => [m.income, m.expenses]));

  return (
    <Panel
      title="Cash flow"
      subtitle="Income vs expenses"
      action={
        <span
          className="text-[13px] font-semibold"
          style={{ color: netPaisa >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
          data-numeric
        >
          {paisaFull(netPaisa)}
        </span>
      }
    >
      {months.length ? (
        <>
          <div className="flex h-[150px] items-end gap-3">
            {months.map((m) => (
              <div key={m.m} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-full w-full items-end justify-center gap-1">
                  <span
                    className="w-1/2 rounded-t-[3px]"
                    style={{ height: `${max ? (m.income / max) * 100 : 0}%`, backgroundColor: "var(--color-brass)" }}
                  />
                  <span
                    className="w-1/2 rounded-t-[3px]"
                    style={{ height: `${max ? (m.expenses / max) * 100 : 0}%`, backgroundColor: "var(--surface-3)" }}
                  />
                </div>
                <span
                  className="text-[10px] uppercase tracking-[0.1em]"
                  style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                >
                  {m.m}
                </span>
              </div>
            ))}
          </div>
          <div
            className="mt-4 flex items-center gap-5 border-t pt-3.5 text-[11.5px]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
          >
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "var(--color-brass)" }} />
              In {paisaCompact(incomePaisa, notation)}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "var(--surface-3)" }} />
              Out {paisaCompact(expensesPaisa, notation)}
            </span>
          </div>
        </>
      ) : (
        <p className="py-8 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
          Log a transaction to see cash flow.
        </p>
      )}
    </Panel>
  );
}

export function ExpensesPanel({
  categories,
  expensesPaisa,
}: {
  categories: { key: string; value: number; pct: number }[];
  expensesPaisa: number;
}) {
  return (
    <Panel title="Where it went" subtitle={`${paisaFull(expensesPaisa)} this month`}>
      {categories.length ? (
        <ExpenseBars
          items={categories.map((c) => ({
            key: c.key,
            value: c.value / 100,
            pct: c.pct,
            href: `/dashboard/transactions?q=${encodeURIComponent(c.key)}`,
          }))}
        />
      ) : (
        <p className="py-8 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
          No spending recorded this month.
        </p>
      )}
    </Panel>
  );
}

export function TransactionsPanel({ txns }: { txns: TransactionRow[] }) {
  return (
    <Panel title="Recent transactions" subtitle="Money in and out" bodyClassName="p-0">
      {txns.length ? (
        <TransactionList
          items={txns.slice(0, 5).map((t) => ({
            id: t.id,
            label: t.label,
            meta: `${t.category ?? "Uncategorised"} · ${new Date(t.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
            amount: t.amount_paisa / 100,
            href: `/dashboard/transactions?q=${encodeURIComponent(t.label)}`,
          }))}
        />
      ) : (
        <Empty href="/dashboard/transactions" cta="Log a transaction">
          Nothing logged yet.
        </Empty>
      )}
    </Panel>
  );
}

export function GoalsPanel({
  goals,
  notation,
}: {
  goals: { id: string; name: string; pct: number; onTrack: boolean; savedPaisa: number; target_paisa: number }[];
  notation: Notation;
}) {
  return (
    <Panel title="Goals" subtitle={goals.length ? `${goals.length} active` : undefined} bodyClassName={goals.length ? "p-5" : "p-0"}>
      {goals.length ? (
        <ul className="flex flex-col gap-5">
          {goals.slice(0, 4).map((g) => (
            <li key={g.id}>
              <Link
                href={`/dashboard/goals?q=${encodeURIComponent(g.name)}`}
                className="block rounded-[8px] transition-colors duration-200 hover:bg-[var(--surface-1)]"
              >
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13px] font-medium">{g.name}</span>
                  <span className="flex-none text-[13px] font-semibold" data-numeric>
                    {g.pct.toFixed(0)}%
                  </span>
                </div>
                <Meter value={g.pct} color={g.onTrack ? "var(--color-brass)" : "var(--color-warning)"} />
                <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }} data-numeric>
                  {paisaCompact(g.savedPaisa, notation)} of {paisaCompact(g.target_paisa, notation)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty href="/dashboard/goals" cta="Add a goal">
          No goals set.
        </Empty>
      )}
    </Panel>
  );
}
