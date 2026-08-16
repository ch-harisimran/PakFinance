"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { FormShell } from "@/components/forms/FormShell";
import {
  addAsset,
  addBudget,
  addRecurring,
  addCommittee,
  addCommitteePayment,
  type FormState,
} from "@/app/dashboard/actions";

/**
 * Forms for the balance-sheet items that are not shares, funds or bank
 * balances: other assets, budgets, recurring rules and committees.
 *
 * Same shape as EntryForms — fields defined once, rendered by both the add
 * dialog and the row menu's edit dialog, so the two cannot drift apart.
 */

const today = () => new Date().toISOString().slice(0, 10);
const rupees = (paisa: number | null | undefined) =>
  paisa === null || paisa === undefined ? "" : String(paisa / 100);

function Dialog({
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
          className="inline-flex min-h-[24px] items-center text-[12.5px] underline-offset-4 hover:underline"
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

/* ── Assets ───────────────────────────────────────────────────────────────── */

export interface AssetInit {
  kind: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  cost_paisa: number | null;
  value_paisa: number;
  as_of: string;
  zakatable: boolean;
  note: string | null;
}

const ASSET_KINDS: [string, string][] = [
  ["GOLD", "Gold"],
  ["SILVER", "Silver"],
  ["PROPERTY", "Property"],
  ["VEHICLE", "Vehicle"],
  ["CRYPTO", "Crypto"],
  ["FOREIGN_CURRENCY", "Foreign currency"],
  ["OTHER", "Other"],
];

export function AssetFields({ initial }: { initial?: AssetInit }) {
  const [kind, setKind] = useState(initial?.kind ?? "GOLD");
  const [zakatable, setZakatable] = useState(
    initial?.zakatable ?? true, // gold, the default kind, usually is
  );

  const unitHint =
    kind === "GOLD" || kind === "SILVER"
      ? "tola, gram"
      : kind === "PROPERTY"
        ? "sq yd, marla, kanal"
        : kind === "CRYPTO"
          ? "BTC, ETH"
          : "units";

  return (
    <>
      <Field label="What is it?" name="name" placeholder="22k gold bangles" defaultValue={initial?.name} required />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Type"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          options={ASSET_KINDS}
        />
        <Field
          label="Valued on"
          name="as_of"
          type="date"
          defaultValue={initial?.as_of?.slice(0, 10) ?? today()}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="How much"
          name="quantity"
          inputMode="decimal"
          placeholder="11"
          defaultValue={initial?.quantity ?? ""}
        />
        <Field label="Unit" name="unit" placeholder={unitHint} defaultValue={initial?.unit ?? ""} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="What it cost (PKR)"
          name="cost"
          inputMode="decimal"
          placeholder="1800000"
          defaultValue={initial ? rupees(initial.cost_paisa) : ""}
          hint="Optional."
        />
        <Field
          label="What it's worth now"
          name="value"
          inputMode="decimal"
          placeholder="2400000"
          defaultValue={initial ? rupees(initial.value_paisa) : undefined}
          required
        />
      </div>

      {/* There is no gold or property price feed, and inventing one would be
          worse than asking. The date above is what keeps the number honest. */}
      <p className="text-[11.5px]" style={{ color: "var(--text-faint)" }}>
        Values are yours to keep current — PakFinance has no gold or property price
        feed and will not pretend otherwise.
      </p>

      <label
        className="flex cursor-pointer items-start gap-3 rounded-[12px] border p-4"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
      >
        <input
          type="checkbox"
          name="zakatable"
          value="1"
          checked={zakatable}
          onChange={(e) => setZakatable(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none rounded-[5px] accent-[var(--color-brass)]"
        />
        <span>
          <span className="block text-[13px] font-medium">Include in Zakat</span>
          <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
            Gold and silver generally count. A home you live in and the car you drive
            generally do not. Your scholar decides, not this app.
          </span>
        </span>
      </label>
    </>
  );
}

export function AddAsset() {
  return (
    <Dialog
      label="Add asset"
      title="Add an asset"
      action={addAsset}
      description="Gold, property, crypto — anything you own that isn't a share, a fund or a bank balance."
    >
      <AssetFields />
    </Dialog>
  );
}

/* ── Budgets ──────────────────────────────────────────────────────────────── */

export interface BudgetInit {
  category: string;
  limit_paisa: number;
}

export function BudgetFields({ initial }: { initial?: BudgetInit }) {
  return (
    <>
      <Field
        label="Category"
        name="category"
        placeholder="Groceries"
        defaultValue={initial?.category}
        required
        hint="Must match the category you tag transactions with."
      />
      <Field
        label="Monthly limit (PKR)"
        name="limit"
        inputMode="decimal"
        placeholder="60000"
        defaultValue={initial ? rupees(initial.limit_paisa) : undefined}
        required
      />
    </>
  );
}

export function AddBudget() {
  return (
    <Dialog
      label="Set a budget"
      title="Set a monthly budget"
      action={addBudget}
      description="Spending is counted from your own transactions, so the two can never disagree."
    >
      <BudgetFields />
    </Dialog>
  );
}

/* ── Recurring ────────────────────────────────────────────────────────────── */

export interface RecurringInit {
  label: string;
  category: string | null;
  amount_paisa: number;
  cadence: string;
  day_of_period: number;
  start_date: string;
  end_date: string | null;
  account_id: string | null;
}

export function RecurringFields({
  accounts,
  initial,
}: {
  accounts: { id: string; name: string }[];
  initial?: RecurringInit;
}) {
  const [cadence, setCadence] = useState(initial?.cadence ?? "MONTHLY");

  return (
    <>
      <Field label="What is it?" name="label" placeholder="Rent" defaultValue={initial?.label} required />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Direction"
          name="direction"
          defaultValue={initial && initial.amount_paisa > 0 ? "in" : "out"}
          options={[["out", "Money out"], ["in", "Money in"]]}
        />
        <Field
          label="Amount (PKR)"
          name="amount"
          inputMode="decimal"
          placeholder="120000"
          defaultValue={initial ? rupees(Math.abs(initial.amount_paisa)) : undefined}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="How often"
          name="cadence"
          value={cadence}
          onChange={(e) => setCadence(e.target.value)}
          options={[
            ["MONTHLY", "Every month"],
            ["WEEKLY", "Every week"],
            ["QUARTERLY", "Every quarter"],
            ["YEARLY", "Every year"],
          ]}
        />
        {cadence === "WEEKLY" ? (
          <Select
            label="Day"
            name="day_of_period"
            defaultValue={String(initial?.day_of_period ?? 1)}
            options={[
              ["1", "Monday"],
              ["2", "Tuesday"],
              ["3", "Wednesday"],
              ["4", "Thursday"],
              ["5", "Friday"],
              ["6", "Saturday"],
              ["0", "Sunday"],
            ]}
          />
        ) : (
          <Field
            label="Day of month"
            name="day_of_period"
            inputMode="numeric"
            placeholder="1"
            defaultValue={initial?.day_of_period ?? 1}
            hint="The 31st falls back in shorter months."
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Category"
          name="category"
          placeholder="Rent"
          defaultValue={initial?.category ?? ""}
        />
        <Field
          label="Starts"
          name="start_date"
          type="date"
          defaultValue={initial?.start_date?.slice(0, 10) ?? today()}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Ends (optional)"
          name="end_date"
          type="date"
          defaultValue={initial?.end_date?.slice(0, 10) ?? ""}
        />
        {accounts.length > 0 && (
          <Select
            label="Account"
            name="account_id"
            defaultValue={initial?.account_id ?? ""}
            options={[["", "—"], ...accounts.map((a) => [a.id, a.name] as [string, string])]}
          />
        )}
      </div>
    </>
  );
}

export function AddRecurring({ accounts }: { accounts: { id: string; name: string }[] }) {
  return (
    <Dialog
      label="Add repeating entry"
      title="Add a repeating entry"
      action={addRecurring}
      description="Posted automatically when it falls due — never twice for the same period."
    >
      <RecurringFields accounts={accounts} />
    </Dialog>
  );
}

/* ── Committees ───────────────────────────────────────────────────────────── */

export interface CommitteeInit {
  name: string;
  organiser: string | null;
  members: number;
  monthly_paisa: number;
  start_month: string;
  payout_position: number | null;
  payout_received: boolean;
  payout_date: string | null;
}

export function CommitteeFields({ initial }: { initial?: CommitteeInit }) {
  const [received, setReceived] = useState(initial?.payout_received ?? false);

  return (
    <>
      <Field label="Committee name" name="name" placeholder="Office BC" defaultValue={initial?.name} required />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Organiser" name="organiser" placeholder="Ahmed" defaultValue={initial?.organiser ?? ""} />
        <Field
          label="Members"
          name="members"
          inputMode="numeric"
          placeholder="12"
          defaultValue={initial?.members ?? ""}
          required
          hint="Also how many months it runs."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Monthly contribution"
          name="monthly"
          inputMode="decimal"
          placeholder="25000"
          defaultValue={initial ? rupees(initial.monthly_paisa) : undefined}
          required
        />
        <Field
          label="First month"
          name="start_month"
          type="date"
          defaultValue={initial?.start_month?.slice(0, 10) ?? today()}
        />
      </div>

      <Field
        label="Your turn (which round)"
        name="payout_position"
        inputMode="numeric"
        placeholder="6"
        defaultValue={initial?.payout_position ?? ""}
        hint="Leave blank until the draw decides."
      />

      <label
        className="flex cursor-pointer items-start gap-3 rounded-[12px] border p-4"
        style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
      >
        <input
          type="checkbox"
          name="payout_received"
          value="1"
          checked={received}
          onChange={(e) => setReceived(e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none rounded-[5px] accent-[var(--color-brass)]"
        />
        <span>
          <span className="block text-[13px] font-medium">I have taken my pot</span>
          <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
            Before your turn a committee is saving; afterwards the remaining months
            are a debt. This switch decides which side of the balance sheet it sits on.
          </span>
        </span>
      </label>

      {received && (
        <Field
          label="Received on"
          name="payout_date"
          type="date"
          defaultValue={initial?.payout_date?.slice(0, 10) ?? today()}
        />
      )}
    </>
  );
}

export function AddCommittee() {
  return (
    <Dialog
      label="Add committee"
      title="Add a committee"
      action={addCommittee}
      description="A rotating savings pool — everyone pays in monthly, one member takes the pot each round."
    >
      <CommitteeFields />
    </Dialog>
  );
}

export function LogCommitteePayment({ committeeId }: { committeeId: string }) {
  return (
    <Dialog
      label="Log payment"
      title="Log a contribution"
      action={addCommitteePayment}
      variant="link"
    >
      <input type="hidden" name="committee_id" value={committeeId} />
      <Field label="Amount paid (PKR)" name="amount" inputMode="decimal" placeholder="25000" required />
      <Field label="Paid on" name="paid_at" type="date" defaultValue={today()} />
    </Dialog>
  );
}
