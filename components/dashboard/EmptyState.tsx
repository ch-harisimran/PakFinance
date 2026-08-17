import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * First-run state.
 *
 * The reference dashboard assumed a populated account, so a new user would have
 * met a grid of zeroes. Every screen that lists user data shows this instead
 * until there is something to list — with the primary action right there, so
 * the empty state is the onboarding step rather than a dead end.
 */
export function EmptyState({
  Icon,
  title,
  body,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <span
        className="mb-5 grid h-12 w-12 place-items-center rounded-[14px] border"
        style={{ backgroundColor: "var(--surface-1)", borderColor: "var(--border-subtle)" }}
      >
        <Icon size={20} strokeWidth={1.6} color="var(--brass-text)" />
      </span>
      <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p
        className="mt-2.5 max-w-[46ch] text-[13.5px] leading-relaxed"
        style={{ color: "var(--text-muted)" }}
      >
        {body}
      </p>
      {action && <div className="mt-7">{action}</div>}
    </div>
  );
}
