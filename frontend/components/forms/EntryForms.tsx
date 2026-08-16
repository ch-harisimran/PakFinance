"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { FormShell } from "@/components/forms/FormShell";
import {
  addAccount,
  addTransaction,
  addLoan,
  addLoanPayment,
  addGoal,
  addContribution,
  type FormState,
} from "@/app/dashboard/actions";

/**
 * Entry forms.
 *
 * Amounts are entered in RUPEES; the server actions convert to integer paisa.
 * Asking a user to type paisa would be absurd, and doing the conversion in one
 * place keeps float error out of the database.
 *
 * Each record type defines its fields ONCE, as a `*Fields` component, which both
 * the Add dialog here and the Edit dialog in a row menu render. When a column is
 * added, there is one place to add it — and no way for the edit form to quietly
 * drop a field the add form collects, which is how records end up half-editable.
 */

const today = () => new Date().toISOString().slice(0, 10);

/** Integer paisa → the plain rupee string a number input wants back. */
const rupees = (paisa: number | null | undefined) =>
  paisa === null || paisa === undefined ? "" : String(paisa / 100);

/** A trigger button plus the shared dialog. */
function FormDialog({
  label,
  title,
  description,
  action,
  children,
  variant = "primary",
}: {
  label: string;
  title: string;
  description?: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  variant?: "primary" | "link";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "primary" ? (
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[13px] font-[550] transition-colors duration-200 hover:bg-[var(--color-brass-lit)]"
          style={{ backgroundColor: "var(--color-brass)", color: "#0A0B0D" }}
        >
          <Plus size={15} strokeWidth={2.2} />
          {label}
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="text-[12.5px] underline-offset-4 hover:underline"
          style={{ color: "var(--brass-text)" }}
        >
          {label}
        </button>
      )}

      <FormShell
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        action={action}
      >
        {children}
      </FormShell>
    </>
  );
}

/* ── Field groups, shared by add and edit ─────────────────────────────────── */

export interface AccountInit {
  name: string;
  kind: string;
  masked_number: string | null;
  balance_paisa: number;
}

export function AccountFields({ initial }: { initial?: AccountInit }) {
  return (
    <>
      {/* The server compares against this to decide whether "last confirmed"
          should move; renaming an account must not refresh a stale balance. */}
      {initial && (
        <input type="hidden" name="original_balance_paisa" value={initial.balance_paisa} />
      )}
      <Field label="Account name" name="name" placeholder="Meezan Bank" defaultValue={initial?.name} required />
      <Select
        label="Type"
        name="kind"
        defaultValue={initial?.kind ?? "CURRENT"}
        options={[["CURRENT", "Current"], ["SAVINGS", "Savings"], ["CASH", "Cash in hand"], ["WALLET", "Wallet"]]}
      />
      <Field
        label="Last 4 digits"
        name="masked"
        placeholder="4471"
        maxLength={4}
        defaultValue={initial?.masked_number ?? ""}
        hint="Optional. Never store the full number."
      />
      <Field
        label="Current balance (PKR)"
        name="balance"
        inputMode="decimal"
        placeholder="350000"
        defaultValue={initial ? rupees(initial.balance_paisa) : undefined}
        required
      />
    </>
  );
}

export interface TransactionInit {
  label: string;
  category: string | null;
  amount_paisa: number;
  occurred_at: string;
  account_id: string | null;
}

export function TransactionFields({
  accounts,
  initial,
}: {
  accounts: { id: string; name: string }[];
  initial?: TransactionInit;
}) {
  return (
    <>
      <Field label="What was it?" name="label" placeholder="Salary, Rent, Groceries" defaultValue={initial?.label} required />
      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Direction"
          name="direction"
          // Sign lives in the stored amount; the form splits it back into a
          // direction and a positive number so nobody types a minus sign.
          defaultValue={initial && initial.amount_paisa > 0 ? "in" : "out"}
          options={[["out", "Money out"], ["in", "Money in"]]}
        />
        <Field
          label="Amount (PKR)"
          name="amount"
          inputMode="decimal"
          placeholder="25000"
          defaultValue={initial ? rupees(Math.abs(initial.amount_paisa)) : undefined}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" name="category" placeholder="Rent" defaultValue={initial?.category ?? ""} />
        <Field
          label="Date"
          name="occurred_at"
          type="date"
          defaultValue={initial ? initial.occurred_at.slice(0, 10) : today()}
        />
      </div>
      {accounts.length > 0 && (
        <Select
          label="Account"
          name="account_id"
          defaultValue={initial?.account_id ?? ""}
          options={[["", "—"], ...accounts.map((a) => [a.id, a.name] as [string, string])]}
        />
      )}
    </>
  );
}

export interface LoanInit {
  name: string;
  lender: string | null;
  kind: string;
  principal_paisa: number;
  markup_rate: string | null;
  installment_paisa: number | null;
  tenure_months: number | null;
  start_date: string;
  due_day: number | null;
  due_date: string | null;
  reminder_enabled: boolean;
  reminder_days_before: number;
}

export function LoanFields({ initial }: { initial?: LoanInit }) {
  // Monthly installments and a single lump sum are different loans in practice —
  // a bank facility versus money from a relative — and asking which one up front
  // keeps the user from filling in two mutually exclusive date fields.
  const [repayment, setRepayment] = useState<"monthly" | "once">(
    initial?.due_date ? "once" : "monthly",
  );
  const [remind, setRemind] = useState(initial?.reminder_enabled ?? false);

  return (
    <>
      <Field label="Loan name" name="name" placeholder="Car loan" defaultValue={initial?.name} required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lender" name="lender" placeholder="Meezan Bank" defaultValue={initial?.lender ?? ""} />
        <Select
          label="Type"
          name="kind"
          defaultValue={initial?.kind ?? "PERSONAL"}
          options={[["CAR", "Car"], ["HOME", "Home"], ["PERSONAL", "Personal"], ["CREDIT_CARD", "Credit card"], ["OTHER", "Other"]]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Principal (PKR)"
          name="principal"
          inputMode="decimal"
          placeholder="1250000"
          defaultValue={initial ? rupees(initial.principal_paisa) : undefined}
          required
        />
        <Field
          label="Markup rate %"
          name="markup"
          inputMode="decimal"
          placeholder="16.5"
          defaultValue={initial?.markup_rate ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Monthly installment"
          name="installment"
          inputMode="decimal"
          placeholder="42500"
          defaultValue={initial ? rupees(initial.installment_paisa) : undefined}
        />
        <Field
          label="Tenure (months)"
          name="tenure"
          inputMode="numeric"
          placeholder="60"
          defaultValue={initial?.tenure_months ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Start date"
          name="start_date"
          type="date"
          defaultValue={initial ? initial.start_date.slice(0, 10) : today()}
        />
        <Select
          label="Repayment"
          name="repayment"
          value={repayment}
          onChange={(e) => setRepayment(e.target.value as "monthly" | "once")}
          options={[["monthly", "Monthly installments"], ["once", "One payment"]]}
        />
      </div>

      {repayment === "monthly" ? (
        <Field
          label="Due day of month"
          name="due_day"
          inputMode="numeric"
          placeholder="5"
          defaultValue={initial?.due_day ?? ""}
          hint="The 31st falls back to the last day in shorter months."
        />
      ) : (
        <Field
          label="Repayment date"
          name="due_date"
          type="date"
          defaultValue={initial?.due_date?.slice(0, 10) ?? ""}
        />
      )}

      <div
        className="rounded-[12px] border p-4"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="reminder_enabled"
            value="1"
            checked={remind}
            onChange={(e) => setRemind(e.target.checked)}
            className="mt-0.5 h-4 w-4 flex-none rounded-[5px] accent-[var(--color-brass)]"
          />
          <span>
            <span className="block text-[13px] font-medium">Email me before this is due</span>
            <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
              {repayment === "monthly"
                ? "Every month, before the installment falls due."
                : "Once, before the repayment date."}
            </span>
          </span>
        </label>

        {remind && (
          <div className="mt-4">
            <Select
              label="How much notice"
              name="reminder_days_before"
              defaultValue={String(initial?.reminder_days_before ?? 3)}
              options={[
                ["0", "On the day"],
                ["1", "1 day before"],
                ["3", "3 days before"],
                ["7", "A week before"],
              ]}
            />
          </div>
        )}
      </div>
    </>
  );
}

export interface PaymentInit {
  amount_paisa: number;
  principal_paisa: number | null;
  markup_paisa: number | null;
  paid_at: string;
}

export function PaymentFields({ initial }: { initial?: PaymentInit }) {
  return (
    <>
      <Field
        label="Amount paid (PKR)"
        name="amount"
        inputMode="decimal"
        placeholder="42500"
        defaultValue={initial ? rupees(initial.amount_paisa) : undefined}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Principal part"
          name="principal"
          inputMode="decimal"
          placeholder="35950"
          defaultValue={initial ? rupees(initial.principal_paisa) : undefined}
        />
        <Field
          label="Markup part"
          name="markup"
          inputMode="decimal"
          placeholder="6350"
          defaultValue={initial ? rupees(initial.markup_paisa) : undefined}
        />
      </div>
      <Field
        label="Paid on"
        name="paid_at"
        type="date"
        defaultValue={initial ? initial.paid_at.slice(0, 10) : today()}
      />
    </>
  );
}

export interface GoalInit {
  name: string;
  category: string | null;
  target_paisa: number;
  target_date: string | null;
}

export function GoalFields({ initial }: { initial?: GoalInit }) {
  return (
    <>
      <Field label="Goal name" name="name" placeholder="Emergency fund" defaultValue={initial?.name} required />
      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Target (PKR)"
          name="target"
          inputMode="decimal"
          placeholder="500000"
          defaultValue={initial ? rupees(initial.target_paisa) : undefined}
          required
        />
        <Field
          label="Target date"
          name="target_date"
          type="date"
          defaultValue={initial?.target_date?.slice(0, 10) ?? ""}
        />
      </div>
      <Select
        label="Category"
        name="category"
        defaultValue={initial?.category ?? "Emergency"}
        options={[["Emergency", "Emergency"], ["Vehicle", "Vehicle"], ["Home", "Home"], ["Hajj", "Hajj"], ["Education", "Education"], ["Wedding", "Wedding"], ["Other", "Other"]]}
      />
    </>
  );
}

export interface ContributionInit {
  amount_paisa: number;
  occurred_at: string;
}

export function ContributionFields({ initial }: { initial?: ContributionInit }) {
  return (
    <>
      <Field
        label="Amount (PKR)"
        name="amount"
        inputMode="decimal"
        placeholder="12500"
        defaultValue={initial ? rupees(initial.amount_paisa) : undefined}
        required
      />
      <Field
        label="Date"
        name="occurred_at"
        type="date"
        defaultValue={initial ? initial.occurred_at.slice(0, 10) : today()}
      />
    </>
  );
}

/* ── Add dialogs ──────────────────────────────────────────────────────────── */

export function AddAccount() {
  return (
    <FormDialog label="Add account" title="Add an account" action={addAccount}
      description="Balances you enter yourself — PakFinance never asks for bank credentials.">
      <AccountFields />
    </FormDialog>
  );
}

export function LogTransaction({ accounts }: { accounts: { id: string; name: string }[] }) {
  return (
    <FormDialog label="Log transaction" title="Log a transaction" action={addTransaction}
      description="Money in or out. Trades belong in PSX Portfolio.">
      <TransactionFields accounts={accounts} />
    </FormDialog>
  );
}

export function AddLoan() {
  return (
    <FormDialog label="Add loan" title="Add a loan" action={addLoan}
      description="Enter it once; the outstanding balance is derived from your payments.">
      <LoanFields />
    </FormDialog>
  );
}

export function LogPayment({ loanId }: { loanId: string }) {
  return (
    <FormDialog label="Log payment" title="Log a payment" action={addLoanPayment} variant="link"
      description="The outstanding balance updates from this ledger.">
      <input type="hidden" name="loan_id" value={loanId} />
      <PaymentFields />
    </FormDialog>
  );
}

export function AddGoal() {
  return (
    <FormDialog label="Add goal" title="Add a goal" action={addGoal}
      description="A target and a date. We work out what it takes each month.">
      <GoalFields />
    </FormDialog>
  );
}

export function AddContribution({ goalId }: { goalId: string }) {
  return (
    <FormDialog label="Add money" title="Add to this goal" action={addContribution} variant="link">
      <input type="hidden" name="goal_id" value={goalId} />
      <ContributionFields />
    </FormDialog>
  );
}
