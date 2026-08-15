import { Meter } from "@/components/ui/Meter";
import { formatFull, formatSigned } from "@/lib/money";

/**
 * Money-movement rows. Was written out three times — dashboard, Bank Accounts
 * and Transactions — each drifting slightly in padding and type size.
 *
 * The one rule worth keeping central: credits are `gain`, debits are plain
 * primary text. Paying rent is not a loss, and spending the red here would
 * drain it of meaning everywhere else.
 */
export function TransactionList({
  items,
  withIcon = false,
}: {
  items: { label: string; meta: string; amount: number }[];
  /** Detailed variant used on the Transactions screen. */
  withIcon?: boolean;
}) {
  return (
    <>
      {items.map((t) => (
        <div
          key={t.label}
          className={`flex items-center justify-between gap-4 border-b transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-1)] ${
            withIcon ? "px-5 py-4" : "px-5 py-3.5"
          }`}
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex min-w-0 items-center gap-3.5">
            {withIcon && (
              <span
                className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-[13px] font-semibold"
                style={{
                  backgroundColor: "var(--surface-2)",
                  color: t.amount > 0 ? "var(--color-gain)" : "var(--text-muted)",
                }}
                aria-hidden="true"
              >
                {t.amount > 0 ? "↓" : "↑"}
              </span>
            )}
            <div className="min-w-0">
              <div className={`truncate font-medium ${withIcon ? "text-[13.5px]" : "text-[13px]"}`}>
                {t.label}
              </div>
              <div
                className="mt-0.5 truncate text-[11.5px]"
                style={{ color: "var(--text-faint)" }}
              >
                {t.meta}
              </div>
            </div>
          </div>
          <span
            className={`flex-none font-semibold ${withIcon ? "text-[14px]" : "text-[13.5px]"}`}
            style={{ color: t.amount > 0 ? "var(--color-gain)" : "var(--text-primary)" }}
            data-numeric
          >
            {formatSigned(t.amount)}
          </span>
        </div>
      ))}
    </>
  );
}

/**
 * Ranked spend bars. A list answers "what is biggest" directly; a ring makes
 * you decode a legend first.
 */
export function ExpenseBars({
  items,
}: {
  items: { key: string; value: number; pct: number }[];
}) {
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((e) => (
        <li key={e.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12.5px]">{e.key}</span>
            <span className="flex-none text-[12.5px] font-semibold" data-numeric>
              {formatFull(e.value)}
            </span>
          </div>
          <Meter value={e.pct} height={6} track="var(--surface-2)" />
        </li>
      ))}
    </ul>
  );
}
