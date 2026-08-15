import type { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
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
  );
}
