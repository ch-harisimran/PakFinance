import { ArrowLeftRight } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TransactionList, ExpenseBars } from "@/components/dashboard/TransactionList";
import { RowActions } from "@/components/dashboard/RowActions";
import { LogTransaction, TransactionFields } from "@/components/forms/EntryForms";
import { updateTransaction } from "@/app/dashboard/actions";
import { getAccounts, getTransactions, cashFlow } from "@/lib/queries";
import { paisaFull } from "@/lib/money";

/**
 * Transactions — money in and out.
 *
 * Trades live in PSX Portfolio and fund orders in Mutual Funds. Keeping them
 * out of here preserves the distinction the sidebar makes between Money and
 * Investments.
 */
export default async function TransactionsPage() {
  const [txns, accounts] = await Promise.all([getTransactions(60), getAccounts()]);
  const flow = cashFlow(txns);

  const month = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Transactions"
        subtitle={`Cash movements across your accounts — ${month}`}
        search={txns.length ? "Search transactions" : undefined}
        actionSlot={<LogTransaction accounts={accounts} />}
      />

      {txns.length === 0 ? (
        <EmptyState
          Icon={ArrowLeftRight}
          title="Nothing logged yet"
          body="Record what comes in and what goes out. Once there's a month of history, PakFinance shows where your money actually goes."
          action={<LogTransaction accounts={accounts} />}
        />
      ) : (
        <>
          <StatRow
            stats={[
              { k: "Money in", v: paisaFull(flow.incomePaisa), tone: "gain" },
              { k: "Money out", v: paisaFull(flow.expensesPaisa), tone: "muted" },
              {
                k: "Net",
                v: paisaFull(flow.netPaisa),
                tone: flow.netPaisa >= 0 ? "gain" : "loss",
              },
              { k: "This month", v: String(flow.count) },
            ]}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Panel title={month} bodyClassName="p-0">
              <TransactionList
                withIcon
                items={txns.map((t) => ({
                  id: t.id,
                  label: t.label,
                  meta: `${t.category ?? "Uncategorised"} · ${new Date(t.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
                  amount: t.amount_paisa / 100,
                  actions: (
                    <RowActions
                      table="transactions"
                      id={t.id}
                      name={t.label}
                      editTitle="Edit transaction"
                      action={updateTransaction}
                    >
                      <TransactionFields accounts={accounts} initial={t} />
                    </RowActions>
                  ),
                }))}
              />
            </Panel>

            <Panel title="Where it went" subtitle={`${paisaFull(flow.expensesPaisa)} out this month`}>
              {flow.categories.length ? (
                <ExpenseBars
                  items={flow.categories.map((c) => ({
                    key: c.key,
                    value: c.value / 100,
                    pct: c.pct,
                  }))}
                />
              ) : (
                <p className="py-6 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
                  No spending recorded this month.
                </p>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
