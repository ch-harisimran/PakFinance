import {
  LayoutDashboard,
  LineChart,
  PiggyBank,
  Landmark,
  ArrowLeftRight,
  Receipt,
  Target,
  Settings,
  Users,
  HandCoins,
  Gem,
  type LucideIcon,
} from "lucide-react";

/**
 * The dashboard's navigation, in one place.
 *
 * Grouped by how someone thinks about their money, not by database table.
 *
 * Shared by the desktop sidebar and the mobile drawer. It lived inside
 * `Sidebar.tsx` until the drawer needed it too, and two copies of a route list
 * is how a screen ends up reachable on one breakpoint and invisible on the
 * other — which is exactly the bug the drawer was added to fix.
 */

export interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
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

/** True when `href` is the active route — exact for /dashboard, prefix otherwise. */
export function isActiveRoute(href: string, pathname: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}
