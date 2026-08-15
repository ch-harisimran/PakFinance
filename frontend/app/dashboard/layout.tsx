import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { AppLock } from "@/components/auth/AppLock";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    // AppLock wraps the whole app surface, not individual pages — a lock that
    // only covered some routes would be trivially sidestepped by navigating.
    <AppLock>
      <div
        className="flex min-h-screen"
        style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
      >
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          {children}
        </div>
      </div>
    </AppLock>
  );
}
