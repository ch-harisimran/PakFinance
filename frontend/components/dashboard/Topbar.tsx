"use client";

import { usePathname } from "next/navigation";
import { Bell, HelpCircle } from "lucide-react";
import { UserMenu } from "@/components/dashboard/UserMenu";

/**
 * The global Add button is gone. "Add" with no context is a guess — it now sits
 * on each screen that owns a record type. This bar keeps the things that really
 * are global: search, help, notifications, and the account menu.
 */

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/psx": "PSX Portfolio",
  "/dashboard/funds": "Mutual Funds",
  "/dashboard/bank": "Bank Accounts",
  "/dashboard/transactions": "Transactions",
  "/dashboard/loans": "Loans",
  "/dashboard/goals": "Goals",
  "/dashboard/settings": "Settings",
};

export function Topbar() {
  const pathname = usePathname();
  const title = TITLES[pathname] ?? "Dashboard";

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 border-b px-5 py-3 backdrop-blur-xl sm:px-6"
      style={{ borderColor: "var(--border-subtle)", backgroundColor: "rgba(10,11,13,0.72)" }}
    >
      <h1 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h1>

      {/* No global search. Searching "everything" returns a mixed bag the user
          then has to sort themselves; each screen owns a search scoped to its
          own records instead — see PageHeader. */}

      <div className="ml-auto flex items-center gap-2">
        <IconButton label="Help">
          <HelpCircle size={16} strokeWidth={1.7} />
        </IconButton>
        <IconButton label="Notifications" dot>
          <Bell size={16} strokeWidth={1.7} />
        </IconButton>
        <UserMenu />
      </div>
    </header>
  );
}

function IconButton({
  children,
  label,
  dot,
}: {
  children: React.ReactNode;
  label: string;
  dot?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className="relative hidden h-9 w-9 place-items-center rounded-[10px] border transition-colors duration-200 hover:bg-[var(--surface-2)] sm:grid"
      style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}
    >
      {children}
      {dot && (
        <span
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--color-brass)" }}
        />
      )}
    </button>
  );
}
