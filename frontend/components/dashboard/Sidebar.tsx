"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { displayName, initialsOf, type Profile } from "@/lib/profile";
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
  Users,
  HandCoins,
  Gem,
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
      { label: "Other Assets", href: "/dashboard/assets", Icon: Gem },
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
      { label: "Committees", href: "/dashboard/committees", Icon: Users },
      { label: "Goals", href: "/dashboard/goals", Icon: Target },
      { label: "Zakat", href: "/dashboard/zakat", Icon: HandCoins },
    ],
  },
  {
    label: "System",
    items: [{ label: "Settings", href: "/dashboard/settings", Icon: Settings }],
  },
];

export function Sidebar({ profile }: { profile: Profile | null }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const name = profile ? displayName(profile) : "Your account";
  const initials = profile ? initialsOf(profile) : "?";

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
        {/* Collapsed, this expands the rail; expanded, it goes to Settings.
            Previously it was a button that did nothing at all once open. */}
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            title={name}
            aria-label={`${name} — expand sidebar`}
            className="flex w-full items-center justify-center rounded-[10px] p-2 transition-colors duration-200 hover:bg-[var(--surface-2)]"
          >
            <Avatar profile={profile} initials={initials} />
          </button>
        ) : (
          <Link
            href="/dashboard/settings"
            className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left transition-colors duration-200 hover:bg-[var(--surface-2)]"
          >
            <Avatar profile={profile} initials={initials} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium">{name}</span>
              <span className="block truncate text-[11px]" style={{ color: "var(--text-faint)" }}>
                {profile?.email ?? "Not signed in"}
              </span>
            </span>
          </Link>
        )}
      </div>
    </aside>
  );
}

function Avatar({ profile, initials }: { profile: Profile | null; initials: string }) {
  if (profile?.avatarUrl) {
    return (
      <Image
        src={profile.avatarUrl}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 flex-none rounded-full object-cover"
        unoptimized
      />
    );
  }
  return (
    <span
      className="grid h-8 w-8 flex-none place-items-center rounded-full text-[12px] font-semibold"
      style={{ backgroundColor: "var(--surface-3)" }}
    >
      {initials}
    </span>
  );
}
