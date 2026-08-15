import { Landmark, Wallet } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { TransactionList } from "@/components/dashboard/TransactionList";
import {
  FRESH,
  ACCOUNTS,
  BANK_VALUE,
  INCOME,
  EXPENSES,
  NET_FLOW,
  TRANSACTIONS,
} from "@/lib/dashboard-data";
import { formatFull, formatSigned } from "@/lib/money";

/**
 * Bank Accounts.
 *
 * No credential field anywhere on this screen, by design — PakFinance never
 * asks for a bank or brokerage login, so there is nothing here worth stealing.
 * Balances are entered or imported by the user, and dated accordingly.
 */
export default function BankPage() {
  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Bank Accounts"
        subtitle="Balances you enter or import — no bank credentials, ever"
        freshness={FRESH.manual}
        search="Search accounts"
        action="Add account"
      />

      <StatRow
        stats={[
          { k: "Total balance", v: formatFull(BANK_VALUE) },
          { k: "Income · August", v: formatFull(INCOME), tone: "gain" },
          { k: "Expenses · August", v: formatFull(EXPENSES), tone: "muted" },
          { k: "Net flow", v: formatSigned(NET_FLOW), tone: "gain" },
        ]}
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        {ACCOUNTS.map((a) => (
          <section key={a.name} className="card p-5">
            <div className="mb-4 flex items-start justify-between">
              <span
                className="grid h-9 w-9 place-items-center rounded-[10px]"
                style={{ backgroundColor: "var(--surface-2)" }}
              >
                {a.kind === "Manual" ? (
                  <Wallet size={16} strokeWidth={1.7} color="var(--brass-text)" />
                ) : (
                  <Landmark size={16} strokeWidth={1.7} color="var(--brass-text)" />
                )}
              </span>
              <span
                className="text-[10px] uppercase tracking-[0.12em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
              >
                {a.kind}
              </span>
            </div>
            <div className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {a.name}
            </div>
            <div className="mt-2 flex items-baseline text-[24px] font-semibold leading-none tracking-[-0.025em]">
              <span className="currency">PKR</span>
              <span data-numeric>{formatFull(a.balance)}</span>
            </div>
            <div
              className="mt-4 flex gap-4 border-t pt-3.5 text-[12px]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <button className="underline-offset-4 hover:underline" style={{ color: "var(--brass-text)" }}>
                Log transaction
              </button>
              <button className="underline-offset-4 hover:underline" style={{ color: "var(--text-faint)" }}>
                Update balance
              </button>
            </div>
          </section>
        ))}
      </div>

      <Panel
        title="Recent movements"
        subtitle="Across all accounts"
        freshness={FRESH.manual}
        bodyClassName="p-0"
      >
        <TransactionList items={TRANSACTIONS} />
      </Panel>
    </div>
  );
}
