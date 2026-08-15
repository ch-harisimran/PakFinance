"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard,
  LineChart,
  PiggyBank,
  Landmark,
  ArrowLeftRight,
  Receipt,
  Target,
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

/**
 * Grouped by how someone thinks about their money, not by table. This grouping
 * came straight from the reference and is the part it got most right.
 */
const GROUPS = [
  { label: "Overview", items: [{ label: "Dashboard", href: "/dashboard", Icon: LayoutDashboard }] },
  {
    label: "Investments",
    items: [
      { label: "PSX Portfolio", href: "/dashboard/psx", Icon: LineChart },
      { label: "Mutual Funds", href: "/dashboard/funds", Icon: PiggyBank },
    ],
  },
  {
    label: "Money",
    items: [
      { label: "Bank Accounts", href: "/dashboard/bank", Icon: Landmark },
      { label: "Transactions", href: "/dashboard/transactions", Icon: ArrowLeftRight },
    ],
  },
  {
    label: "Planning",
    items: [
      { label: "Loans", href: "/dashboard/loans", Icon: Receipt },
      { label: "Goals", href: "/dashboard/goals", Icon: Target },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/dashboard/settings", Icon: Settings }],
  },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 hidden h-screen flex-none flex-col border-r transition-[width] duration-300 [transition-timing-function:var(--ease-out)] lg:flex"
      style={{ borderColor: "var(--border-subtle)", width: collapsed ? 76 : 244 }}
    >
      {/* The collapse toggle always renders. Previously it only existed in the
          expanded state, which left no way back once collapsed. */}
      <div
        className={`flex py-5 ${collapsed ? "flex-col items-center gap-3 px-2" : "items-center justify-between px-4"}`}
      >
        <Logo href="/" showText={!collapsed} text={19} />

        <button
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="grid h-7 w-7 flex-none place-items-center rounded-[8px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
          style={{ color: "var(--text-faint)" }}
        >
          {collapsed ? (
            <ChevronsRight size={15} strokeWidth={1.8} />
          ) : (
            <ChevronsLeft size={15} strokeWidth={1.8} />
          )}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {GROUPS.map((g) => (
          <div key={g.label} className="mb-5">
            {!collapsed && (
              <div
                className="mb-2 px-3 text-[9.5px] uppercase tracking-[0.16em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--text-faint)" }}
              >
                {g.label}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {g.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-3 rounded-[10px] py-2.5 text-[13.5px] transition-colors duration-200 hover:bg-[var(--surface-2)] ${
                      collapsed ? "justify-center px-0" : "px-3"
                    }`}
                    style={{
                      backgroundColor: active ? "var(--surface-2)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-muted)",
                    }}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full"
                        style={{ backgroundColor: "var(--color-brass)" }}
                      />
                    )}
                    <item.Icon size={16} strokeWidth={1.7} className="flex-none" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3" style={{ borderColor: "var(--border-subtle)" }}>
        <button
          onClick={() => collapsed && setCollapsed(false)}
          className={`flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition-colors duration-200 hover:bg-[var(--surface-2)] ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span
            className="grid h-8 w-8 flex-none place-items-center rounded-full text-[12px] font-semibold"
            style={{ backgroundColor: "var(--surface-3)" }}
          >
            HK
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">Haris Khan</span>
              <span className="block truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                haris@example.com
              </span>
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}
