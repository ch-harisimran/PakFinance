import { Receipt, BellRing } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Meter } from "@/components/ui/Meter";
import { RowActions } from "@/components/dashboard/RowActions";
import { NoMatches } from "@/components/dashboard/SearchBox";
import { filterBy, readQuery } from "@/lib/search";
import { AddLoan, LogPayment, LoanFields, PaymentFields } from "@/components/forms/EntryForms";
import { updateLoan, updateLoanPayment } from "@/app/dashboard/actions";
import { getLoans, loanOutstanding } from "@/lib/queries";
import { paisaFull } from "@/lib/money";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Loans" };

/**
 * Loans.
 *
 * The outstanding balance is derived from the payment ledger, never stored — a
 * stored balance and a payment log drift apart the first time either is edited.
 */
export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const loans = await getLoans();
  const rows = loans.map((l) => ({ ...l, ...loanOutstanding(l) }));

  const q = readQuery((await searchParams).q);
  const shown = filterBy(rows, q, (l) => [l.name, l.lender, l.kind]);

  const outstanding = rows.reduce((s, l) => s + l.remainingPaisa, 0);
  const monthly = rows.reduce((s, l) => s + (l.installment_paisa ?? 0), 0);
  const markupPaid = loans
    .flatMap((l) => l.loan_payments)
    .reduce((s) => s, 0);

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Loans"
        subtitle="Outstanding balances derived from your payment ledger"
        search={rows.length ? "Search loans" : undefined}
        actionSlot={<AddLoan />}
      />

      {rows.length === 0 ? (
        <EmptyState
          Icon={Receipt}
          title="No loans tracked"
          body="Add a loan once — principal, markup rate and tenure — then log each payment. PakFinance keeps the outstanding balance and tells you the date you're free."
          action={<AddLoan />}
        />
      ) : (
        <>
          <StatRow
            stats={[
              { k: "Total outstanding", v: paisaFull(outstanding) },
              { k: "Monthly obligation", v: paisaFull(monthly), tone: "muted" },
              { k: "Repaid so far", v: paisaFull(rows.reduce((s, l) => s + l.repaidPaisa, 0)), tone: "gain" },
              { k: "Active loans", v: String(rows.filter((l) => !l.is_settled).length) },
            ]}
          />

          {q && shown.length === 0 && <NoMatches query={q} noun="loans" />}

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            {shown.map((l) => (
              <section key={l.id} className="card p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{l.name}</h3>
                    <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                      {l.lender ?? "—"} · original {paisaFull(l.principal_paisa)}
                      {l.markup_rate ? ` · ${l.markup_rate}%` : ""}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    {l.reminder_enabled && (
                      <span
                        title={
                          l.reminder_days_before === 0
                            ? "Emailed on the due date"
                            : `Emailed ${l.reminder_days_before} day${l.reminder_days_before === 1 ? "" : "s"} before`
                        }
                        className="grid h-6 w-6 place-items-center rounded-full border"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        <BellRing size={11} strokeWidth={1.9} color="var(--brass-text)" />
                        <span className="sr-only">Reminder set</span>
                      </span>
                    )}
                    {(l.due_day || l.due_date) && (
                      <span
                        className="whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
                        style={{
                          fontFamily: "var(--font-mono)",
                          borderColor: "var(--border-subtle)",
                          color: "var(--text-faint)",
                        }}
                      >
                        {l.due_date
                          ? `Due ${l.due_date}`
                          : `Due ${l.due_day}${l.due_day === 1 ? "st" : l.due_day === 2 ? "nd" : l.due_day === 3 ? "rd" : "th"}`}
                      </span>
                    )}
                    <RowActions
                      table="loans"
                      id={l.id}
                      name={l.name}
                      consequence={
                        l.loan_payments.length
                          ? `Its ${l.loan_payments.length} logged payment${l.loan_payments.length === 1 ? "" : "s"} will be deleted too.`
                          : undefined
                      }
                      editTitle="Edit loan"
                      editDescription="The outstanding balance is derived from your payments, so it updates itself."
                      action={updateLoan}
                    >
                      <LoanFields initial={l} />
                    </RowActions>
                  </div>
                </div>

                <div className="flex items-baseline text-[26px] font-semibold leading-none tracking-[-0.025em]">
                  <span className="currency">PKR</span>
                  <span data-numeric>{paisaFull(l.remainingPaisa)}</span>
                </div>
                <div className="mt-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                  remaining
                  {l.installment_paisa ? ` · ${paisaFull(l.installment_paisa)}/month` : ""}
                </div>

                <Meter value={l.repaidPct} className="mt-5" />
                <div className="mt-2 text-[11.5px]" style={{ color: "var(--text-faint)" }} data-numeric>
                  {l.repaidPct.toFixed(0)}% repaid · {l.loan_payments.length} payment
                  {l.loan_payments.length === 1 ? "" : "s"}
                </div>

                <div
                  className="mt-5 flex gap-4 border-t pt-4"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <LogPayment loanId={l.id} />
                </div>
              </section>
            ))}
          </div>

          <Panel title="Payment history" subtitle="Across all loans" bodyClassName="p-0">
            {rows
              .flatMap((l) => l.loan_payments.map((p) => ({ ...p, loan: l.name })))
              .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
              .slice(0, 15)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{p.loan}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {p.paid_at}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <span className="text-[13.5px] font-semibold" data-numeric>
                      {paisaFull(p.amount_paisa)}
                    </span>
                    <RowActions
                      table="loan_payments"
                      id={p.id}
                      name={`${paisaFull(p.amount_paisa)} paid on ${p.paid_at}`}
                      consequence="The loan's outstanding balance will go back up by that amount."
                      editTitle="Edit payment"
                      action={updateLoanPayment}
                    >
                      <PaymentFields initial={p} />
                    </RowActions>
                  </div>
                </div>
              ))}
            {markupPaid === 0 && rows.every((l) => l.loan_payments.length === 0) && (
              <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
                No payments logged yet.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
