import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { TransactionList, ExpenseBars } from "@/components/dashboard/TransactionList";
import { FRESH, TRANSACTIONS, EXPENSE_SPLIT, INCOME, EXPENSES, NET_FLOW } from "@/lib/dashboard-data";
import { formatFull, formatSigned } from "@/lib/money";

/**
 * Transactions — money in and out.
 *
 * Trades live in PSX Portfolio and fund orders in Mutual Funds. Keeping them
 * out of here preserves the distinction the sidebar makes between Money and
 * Investments; the reference collapsed the two by showing stock columns under
 * "Recent Transactions".
 */

const FILTERS = ["All", "Money in", "Money out"];

export default function TransactionsPage() {
  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Transactions"
        subtitle="Cash movements across your accounts — August 2026"
        freshness={FRESH.manual}
        search="Search transactions"
        action="Log transaction"
      >
        <div
          className="flex gap-0.5 rounded-[10px] border p-1"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          {FILTERS.map((f, i) => (
            <button
              key={f}
              className="rounded-[7px] px-3 py-1.5 text-[12px] transition-colors duration-200"
              style={{
                backgroundColor: i === 0 ? "var(--surface-3)" : "transparent",
                color: i === 0 ? "var(--text-primary)" : "var(--text-muted)",
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </PageHeader>

      <StatRow
        stats={[
          { k: "Money in", v: formatFull(INCOME), tone: "gain" },
          { k: "Money out", v: formatFull(EXPENSES), tone: "muted" },
          { k: "Net", v: formatSigned(NET_FLOW), tone: "gain" },
          { k: "Transactions", v: String(TRANSACTIONS.length) },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="August 2026" bodyClassName="p-0">
          <TransactionList items={TRANSACTIONS} withIcon />
        </Panel>

        <Panel title="Where it went" subtitle={`${formatFull(EXPENSES)} out this month`}>
          <ExpenseBars items={EXPENSE_SPLIT} />
        </Panel>
      </div>
    </div>
  );
}
