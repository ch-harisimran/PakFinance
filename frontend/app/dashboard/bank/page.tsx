import { Landmark, Wallet } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { TransactionList } from "@/components/dashboard/TransactionList";
import { AddAccount, LogTransaction } from "@/components/forms/EntryForms";
import { getAccounts, getTransactions, cashFlow } from "@/lib/queries";
import { paisaFull } from "@/lib/money";

/**
 * Bank Accounts.
 *
 * No credential field anywhere on this screen, by design — PakFinance never
 * asks for a bank or brokerage login, so there is nothing here worth stealing.
 */
export default async function BankPage() {
  const [accounts, txns] = await Promise.all([getAccounts(), getTransactions(8)]);
  const flow = cashFlow(txns);
  const total = accounts.reduce((s, a) => s + a.balance_paisa, 0);

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Bank Accounts"
        subtitle="Balances you enter or import — no bank credentials, ever"
        search={accounts.length ? "Search accounts" : undefined}
        actionSlot={<AddAccount />}
      />

      {accounts.length === 0 ? (
        <EmptyState
          Icon={Landmark}
          title="No accounts yet"
          body="Add the accounts you want to track and enter their balances. PakFinance never asks for a bank login — you stay in control of what it knows."
          action={<AddAccount />}
        />
      ) : (
        <>
          <StatRow
            stats={[
              { k: "Total balance", v: paisaFull(total) },
              { k: "Money in · this month", v: paisaFull(flow.incomePaisa), tone: "gain" },
              { k: "Money out · this month", v: paisaFull(flow.expensesPaisa), tone: "muted" },
              {
                k: "Net flow",
                v: paisaFull(flow.netPaisa),
                tone: flow.netPaisa >= 0 ? "gain" : "loss",
              },
            ]}
          />

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            {accounts.map((a) => (
              <section key={a.id} className="card p-5">
                <div className="mb-4 flex items-start justify-between">
                  <span
                    className="grid h-9 w-9 place-items-center rounded-[10px]"
                    style={{ backgroundColor: "var(--surface-2)" }}
                  >
                    {a.kind === "CASH" || a.kind === "WALLET" ? (
                      <Wallet size={16} strokeWidth={1.7} color="var(--brass-text)" />
                    ) : (
                      <Landmark size={16} strokeWidth={1.7} color="var(--brass-text)" />
                    )}
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-[0.12em]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
                  >
                    {a.kind.toLowerCase()}
                    {a.masked_number ? ` · ****${a.masked_number}` : ""}
                  </span>
                </div>
                <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
                  {a.name}
                </div>
                <div className="mt-2 flex items-baseline text-[24px] font-semibold leading-none tracking-[-0.025em]">
                  <span className="currency">PKR</span>
                  <span data-numeric>{paisaFull(a.balance_paisa)}</span>
                </div>
                <div
                  className="mt-4 border-t pt-3.5 text-[11.5px]"
                  style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}
                >
                  You · {new Date(a.as_of).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </section>
            ))}
          </div>

          <Panel
            title="Recent movements"
            subtitle="Across all accounts"
            bodyClassName="p-0"
            action={<LogTransaction accounts={accounts} />}
          >
            {txns.length ? (
              <TransactionList
                items={txns.map((t) => ({
                  label: t.label,
                  meta: `${t.category ?? "Uncategorised"} · ${new Date(t.occurred_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
                  amount: t.amount_paisa / 100,
                }))}
              />
            ) : (
              <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
                No transactions logged yet.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
