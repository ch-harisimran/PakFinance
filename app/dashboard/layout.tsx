import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { AppLock } from "@/components/auth/AppLock";
import { PinPrompt } from "@/components/auth/PinPrompt";
import { getProfile, getLoans, getGoals, loanOutstanding, goalProgress } from "@/lib/queries";
import { buildAlerts } from "@/lib/alerts";

/**
 * Every dashboard screen names itself in the tab, the history entry and the
 * screen reader's page announcement (WCAG 2.4.2). The template lives here so
 * each page only states its own name, and `robots` is set once for the whole
 * segment — none of this is public, and a signed-in screen must never be
 * indexable even if a URL escapes into the wild.
 */
export const metadata: Metadata = {
  title: { template: "%s · PakFinance", default: "Dashboard · PakFinance" },
  robots: { index: false, follow: false, nocache: true },
};

/**
 * The chrome around every dashboard screen.
 *
 * It fetches the signed-in user and their outstanding alerts here rather than in
 * each page, because the top bar is part of the layout and needs both on every
 * route. The reads are wrapped in React's `cache()`, so a page that also needs
 * loans or goals — /dashboard, /dashboard/loans — shares this fetch instead of
 * repeating it.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [profile, loans, goals] = await Promise.all([getProfile(), getLoans(), getGoals()]);

  // Setup prompts are deliberately excluded here: "add a bank account" belongs
  // on the dashboard as an onboarding step, not in the bell as something new.
  const alerts = buildAlerts({
    loans: loans.map((l) => ({ ...l, ...loanOutstanding(l) })),
    goals: goals.map((g) => ({ ...g, ...goalProgress(g) })),
  });

  return (
    // AppLock wraps the whole app surface, not individual pages — a lock that
    // only covered some routes would be trivially sidestepped by navigating.
    <AppLock pinSet={profile?.pinSet ?? false}>
      <div
        className="flex min-h-screen"
        style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
      >
        {/* Offered once, on any dashboard screen, and only while the account
            has no PIN. Inside AppLock so it can never appear over the lock. */}
        <PinPrompt pinSet={profile?.pinSet ?? false} />

        <Sidebar profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar profile={profile} alerts={alerts} />
          {children}
        </div>
      </div>
    </AppLock>
  );
}
