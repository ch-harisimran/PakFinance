"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
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
 */

const today = () => new Date().toISOString().slice(0, 10);

/** Shared wrapper: a trigger button, a modal, and a pending-aware submit. */
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
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  /**
   * Submitting through a transition rather than useActionState: the dialog
   * should close only on success, and driving that from an effect on the action
   * state causes a cascading render. Here the decision happens where the result
   * arrives.
   */
  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result?.ok) {
        setError(undefined);
        setOpen(false);
      } else {
        // Keep the dialog open so the typed values survive a validation error.
        setError(result?.error ?? "Something went wrong.");
      }
    });
  }

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

      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <form action={submit} className="flex flex-col gap-4">
          {children}
          {error && (
            <p className="text-[12.5px]" style={{ color: "var(--color-loss)" }}>
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: [string, string][];
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-11 w-full rounded-[12px] border px-3 text-[14.5px] outline-none focus:border-[var(--color-brass)]"
        style={{
          backgroundColor: "var(--surface-2)",
          borderColor: "var(--border-subtle)",
          color: "var(--text-primary)",
        }}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v} style={{ backgroundColor: "#111318" }}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ── Public form components ───────────────────────────────────────────────── */

export function AddAccount() {
  return (
    <FormDialog label="Add account" title="Add an account" action={addAccount}
      description="Balances you enter yourself — PakFinance never asks for bank credentials.">
      <Field label="Account name" name="name" placeholder="Meezan Bank" required />
      <Select
        label="Type"
        name="kind"
        options={[["CURRENT", "Current"], ["SAVINGS", "Savings"], ["CASH", "Cash in hand"], ["WALLET", "Wallet"]]}
      />
      <Field label="Last 4 digits" name="masked" placeholder="4471" maxLength={4} hint="Optional. Never store the full number." />
      <Field label="Current balance (PKR)" name="balance" type="text" inputMode="decimal" placeholder="350000" required />
    </FormDialog>
  );
}

export function LogTransaction({ accounts }: { accounts: { id: string; name: string }[] }) {
  return (
    <FormDialog label="Log transaction" title="Log a transaction" action={addTransaction}
      description="Money in or out. Trades belong in PSX Portfolio.">
      <Field label="What was it?" name="label" placeholder="Salary, Rent, Groceries" required />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Direction" name="direction" options={[["out", "Money out"], ["in", "Money in"]]} />
        <Field label="Amount (PKR)" name="amount" inputMode="decimal" placeholder="25000" required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Category" name="category" placeholder="Rent" />
        <Field label="Date" name="occurred_at" type="date" defaultValue={today()} />
      </div>
      {accounts.length > 0 && (
        <Select label="Account" name="account_id" options={[["", "—"], ...accounts.map((a) => [a.id, a.name] as [string, string])]} />
      )}
    </FormDialog>
  );
}

export function AddLoan() {
  return (
    <FormDialog label="Add loan" title="Add a loan" action={addLoan}
      description="Enter it once; the outstanding balance is derived from your payments.">
      <Field label="Loan name" name="name" placeholder="Car loan" required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Lender" name="lender" placeholder="Meezan Bank" />
        <Select
          label="Type"
          name="kind"
          options={[["CAR", "Car"], ["HOME", "Home"], ["PERSONAL", "Personal"], ["CREDIT_CARD", "Credit card"], ["OTHER", "Other"]]}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Principal (PKR)" name="principal" inputMode="decimal" placeholder="1250000" required />
        <Field label="Markup rate %" name="markup" inputMode="decimal" placeholder="16.5" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Monthly installment" name="installment" inputMode="decimal" placeholder="42500" />
        <Field label="Tenure (months)" name="tenure" inputMode="numeric" placeholder="60" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Start date" name="start_date" type="date" defaultValue={today()} />
        <Field label="Due day of month" name="due_day" inputMode="numeric" placeholder="5" />
      </div>
    </FormDialog>
  );
}

export function LogPayment({ loanId }: { loanId: string }) {
  return (
    <FormDialog label="Log payment" title="Log a payment" action={addLoanPayment} variant="link"
      description="The outstanding balance updates from this ledger.">
      <input type="hidden" name="loan_id" value={loanId} />
      <Field label="Amount paid (PKR)" name="amount" inputMode="decimal" placeholder="42500" required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Principal part" name="principal" inputMode="decimal" placeholder="35950" />
        <Field label="Markup part" name="markup" inputMode="decimal" placeholder="6350" />
      </div>
      <Field label="Paid on" name="paid_at" type="date" defaultValue={today()} />
    </FormDialog>
  );
}

export function AddGoal() {
  return (
    <FormDialog label="Add goal" title="Add a goal" action={addGoal}
      description="A target and a date. We work out what it takes each month.">
      <Field label="Goal name" name="name" placeholder="Emergency fund" required />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Target (PKR)" name="target" inputMode="decimal" placeholder="500000" required />
        <Field label="Target date" name="target_date" type="date" />
      </div>
      <Select
        label="Category"
        name="category"
        options={[["Emergency", "Emergency"], ["Vehicle", "Vehicle"], ["Home", "Home"], ["Hajj", "Hajj"], ["Education", "Education"], ["Wedding", "Wedding"], ["Other", "Other"]]}
      />
    </FormDialog>
  );
}

export function AddContribution({ goalId }: { goalId: string }) {
  return (
    <FormDialog label="Add money" title="Add to this goal" action={addContribution} variant="link">
      <input type="hidden" name="goal_id" value={goalId} />
      <Field label="Amount (PKR)" name="amount" inputMode="decimal" placeholder="12500" required />
      <Field label="Date" name="occurred_at" type="date" defaultValue={today()} />
    </FormDialog>
  );
}
