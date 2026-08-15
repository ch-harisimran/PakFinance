import { Panel } from "@/components/dashboard/Panel";
import { Meter } from "@/components/ui/Meter";
import { TransactionList, ExpenseBars } from "@/components/dashboard/TransactionList";
import {
  FRESH,
  HOLDINGS,
  PSX_VALUE,
  PSX_GAIN_PCT,
  FUNDS,
  FUNDS_VALUE,
  CASH_FLOW,
  EXPENSE_SPLIT,
  EXPENSES,
  INCOME,
  NET_FLOW,
  TRANSACTIONS,
  GOALS,
} from "@/lib/dashboard-data";
import { axisMax, formatCompact, formatFull, formatPct, formatSigned } from "@/lib/money";

/* ── PSX holdings ─────────────────────────────────────────────────────────── */

export function Holdings() {
  return (
    <Panel
      title="PSX portfolio"
      subtitle={`${HOLDINGS.length} scrips · ${formatFull(PSX_VALUE)} at market`}
      freshness={FRESH.psx}
      bodyClassName="p-0"
      className="xl:col-span-2"
    >
      <div
        className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 text-[9.5px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
      >
        <span>Scrip</span>
        <span className="text-right">Last</span>
        <span className="text-right">Value</span>
        <span className="w-[70px] text-right">Return</span>
      </div>

      {HOLDINGS.map((h) => (
        <div
          key={h.sym}
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-t px-5 py-3 transition-colors duration-200 hover:bg-[var(--surface-1)]"
          style={{ borderColor: "var(--border-subtle)" }}
          data-numeric
        >
          <div className="min-w-0">
            <div className="text-[13px] font-medium" style={{ fontFamily: "var(--font-mono)" }}>
              {h.sym}
            </div>
            <div className="truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
              {formatFull(h.qty)} × avg {formatFull(h.avg, 2)}
            </div>
          </div>
          <span className="text-right text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {formatFull(h.last, 2)}
          </span>
          <span className="text-right text-[13px]">{formatFull(h.value)}</span>
          <span
            className="w-[70px] text-right text-[13px] font-semibold"
            style={{ color: h.pct >= 0 ? "var(--color-gain)" : "var(--color-loss)" }}
          >
            {formatPct(h.pct)}
          </span>
        </div>
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
          style={{ color: "var(--color-gain)" }}
          data-numeric
        >
          {formatPct(PSX_GAIN_PCT)}
        </span>
      </div>
    </Panel>
  );
}

/* ── Mutual funds ─────────────────────────────────────────────────────────── */

export function FundsPanel() {
  return (
    <Panel
      title="Mutual funds"
      subtitle={`${formatFull(FUNDS_VALUE)} across ${FUNDS.length} funds`}
      freshness={FRESH.nav}
    >
      <ul className="flex flex-col gap-4">
        {FUNDS.map((f) => (
          <li key={f.name}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium">{f.name}</span>
              <span className="flex-none text-[13px] font-semibold" data-numeric>
                {formatCompact(f.value)}
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                {f.cat}
              </span>
              <span className="flex-none text-[11.5px]" style={{ color: "var(--text-faint)" }} data-numeric>
                {formatFull(f.units)} units @ {formatFull(f.nav, 2)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ── Cash flow ────────────────────────────────────────────────────────────── */

export function CashFlow() {
  const max = axisMax(CASH_FLOW.flatMap((m) => [m.income, m.expenses]));

  return (
    <Panel
      title="Cash flow"
      subtitle="Income vs expenses, last 6 months"
      freshness={FRESH.manual}
      action={
        <span className="text-[13px] font-semibold" style={{ color: "var(--color-gain)" }} data-numeric>
          {formatSigned(NET_FLOW)}
        </span>
      }
    >
      <div className="flex h-[150px] items-end gap-3">
        {CASH_FLOW.map((m) => (
          <div key={m.m} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <span
                className="w-1/2 rounded-t-[3px]"
                style={{ height: `${(m.income / max) * 100}%`, backgroundColor: "var(--color-brass)" }}
                title={`Income ${formatFull(m.income)}`}
              />
              <span
                className="w-1/2 rounded-t-[3px]"
                style={{
                  height: `${(m.expenses / max) * 100}%`,
                  backgroundColor: "var(--surface-3)",
                }}
                title={`Expenses ${formatFull(m.expenses)}`}
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
          Income {formatCompact(INCOME)}
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: "var(--surface-3)" }} />
          Expenses {formatCompact(EXPENSES)}
        </span>
      </div>
    </Panel>
  );
}

/* ── Expenses ─────────────────────────────────────────────────────────────── */

export function Expenses() {
  return (
    <Panel
      title="Where it went"
      subtitle={`${formatFull(EXPENSES)} in August`}
      freshness={FRESH.manual}
    >
      <ExpenseBars items={EXPENSE_SPLIT} />
    </Panel>
  );
}

/* ── Transactions ─────────────────────────────────────────────────────────── */

export function Transactions() {
  return (
    <Panel title="Recent transactions" subtitle="Money in and out" freshness={FRESH.manual} bodyClassName="p-0">
      <TransactionList items={TRANSACTIONS} />
    </Panel>
  );
}

/* ── Goals ────────────────────────────────────────────────────────────────── */

export function GoalsPanel() {
  return (
    <Panel title="Goals" subtitle={`${GOALS.length} active`} freshness={FRESH.manual}>
      <ul className="flex flex-col gap-5">
        {GOALS.map((g) => (
          <li key={g.name}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium">{g.name}</span>
              <span className="flex-none text-[13px] font-semibold" data-numeric>
                {g.pct.toFixed(0)}%
              </span>
            </div>
            <Meter
              value={g.pct}
              color={g.onTrack ? "var(--color-brass)" : "var(--color-warning)"}
            />
            <div
              className="mt-1.5 flex items-baseline justify-between gap-3 text-[11px]"
              style={{ color: "var(--text-faint)" }}
              data-numeric
            >
              <span>
                {formatCompact(g.have)} of {formatCompact(g.target)}
              </span>
              <span style={{ color: g.onTrack ? "var(--text-faint)" : "var(--color-warning)" }}>
                {g.onTrack ? g.eta : `Behind · ${formatCompact(g.monthly)}/mo`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
