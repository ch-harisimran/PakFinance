import type { ReactNode } from "react";
import Link from "next/link";
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
  items: {
    id: string;
    label: string;
    meta: string;
    amount: number;
    /** Row menu, where the screen owns the record. Omitted on the dashboard,
     *  which is a read surface. */
    actions?: ReactNode;
    /** Drill-through target. Only the label block becomes a link — a row menu
     *  contains buttons, and a button inside an anchor is invalid markup. */
    href?: string;
  }[];
  /** Detailed variant used on the Transactions screen. */
  withIcon?: boolean;
}) {
  return (
    <>
      {items.map((t) => (
        <div
          // Keyed by id, not label: "Groceries" twice in a month is normal, and
          // a duplicate key would make React reuse the wrong row's state.
          key={t.id}
          className={`flex items-center justify-between gap-4 border-b transition-colors duration-200 last:border-b-0 hover:bg-[var(--surface-1)] ${
            withIcon ? "px-5 py-4" : "px-5 py-3.5"
          }`}
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <Row href={t.href}>
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
          </Row>
          <div className="flex flex-none items-center gap-1.5">
            <span
              className={`font-semibold ${withIcon ? "text-[14px]" : "text-[13.5px]"}`}
              style={{ color: t.amount > 0 ? "var(--color-gain)" : "var(--text-primary)" }}
              data-numeric
            >
              {formatSigned(t.amount)}
            </span>
            {t.actions}
          </div>
        </div>
      ))}
    </>
  );
}

/** The label block: a link where the row drills through, a plain box otherwise. */
function Row({ href, children }: { href?: string; children: ReactNode }) {
  const className = "flex min-w-0 items-center gap-3.5";
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

/**
 * Ranked spend bars. A list answers "what is biggest" directly; a ring makes
 * you decode a legend first.
 */
export function ExpenseBars({
  items,
}: {
  items: { key: string; value: number; pct: number; href?: string }[];
}) {
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((e) => {
        const body = (
          <>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px]">{e.key}</span>
              <span className="flex-none text-[12.5px] font-semibold" data-numeric>
                {formatFull(e.value)}
              </span>
            </div>
            <Meter value={e.pct} height={6} track="var(--surface-2)" />
          </>
        );

        return (
          <li key={e.key}>
            {e.href ? (
              <Link
                href={e.href}
                className="block rounded-[8px] transition-colors duration-200 hover:bg-[var(--surface-1)]"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
