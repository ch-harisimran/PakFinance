"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  HelpCircle,
  CalendarClock,
  TriangleAlert,
  BookOpen,
  ShieldCheck,
  Mail,
  Compass,
} from "lucide-react";
import { UserMenu } from "@/components/dashboard/UserMenu";
import type { Alert } from "@/lib/alerts";
import type { Profile } from "@/lib/profile";

/**
 * The global Add button is gone. "Add" with no context is a guess — it now sits
 * on each screen that owns a record type. This bar keeps the things that really
 * are global: help, notifications, and the account menu.
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

export function Topbar({ profile, alerts }: { profile: Profile | null; alerts: Alert[] }) {
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
        <HelpMenu />
        <NotificationBell alerts={alerts} />
        <UserMenu profile={profile} />
      </div>
    </header>
  );
}

/** Shared open/close behaviour for the two popovers in this bar. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, ref };
}

/**
 * Notifications.
 *
 * The dot appears only when there is genuinely something here. A permanent
 * indicator teaches the user to ignore it, which costs you the one time it
 * matters.
 */
function NotificationBell({ alerts }: { alerts: Alert[] }) {
  const { open, setOpen, ref } = usePopover();
  const count = alerts.length;

  return (
    <div ref={ref} className="relative">
      <IconButton
        label={count ? `Notifications, ${count} unread` : "Notifications"}
        onClick={() => setOpen((v) => !v)}
        expanded={open}
        dot={count > 0}
      >
        <Bell size={16} strokeWidth={1.7} />
      </IconButton>

      {open && (
        <Popover>
          <div
            className="flex items-baseline justify-between border-b px-4 py-3"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <span className="text-[13px] font-semibold">Notifications</span>
            <span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
              {count ? `${count} item${count === 1 ? "" : "s"}` : "All clear"}
            </span>
          </div>

          {count === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px]" style={{ color: "var(--text-faint)" }}>
              No installments due in the next two weeks, and every goal is on pace.
            </p>
          ) : (
            <ul className="max-h-[320px] overflow-auto">
              {alerts.map((a) => {
                const Icon = a.kind === "goal" ? TriangleAlert : CalendarClock;
                const tone =
                  a.kind === "goal" ? "var(--color-warning)" : "var(--color-brass)";
                return (
                  <li key={`${a.kind}-${a.title}`}>
                    <Link
                      href={a.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 border-b px-4 py-3 transition-colors duration-150 last:border-b-0 hover:bg-[var(--surface-2)]"
                      style={{ borderColor: "var(--border-subtle)" }}
                    >
                      <span
                        className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[8px]"
                        style={{ backgroundColor: "var(--surface-3)" }}
                      >
                        <Icon size={14} strokeWidth={1.7} color={tone} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium">{a.title}</span>
                        <span
                          className="mt-0.5 block text-[11.5px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {a.detail}
                        </span>
                        <span
                          className="mt-1 block text-[10px] uppercase tracking-[0.1em]"
                          style={{ fontFamily: "var(--font-mono)", color: tone }}
                        >
                          {a.when}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Popover>
      )}
    </div>
  );
}

/**
 * Help.
 *
 * Points at the explanations that already exist on the marketing site rather
 * than inventing a help centre that would immediately go stale.
 */
function HelpMenu() {
  const { open, setOpen, ref } = usePopover();

  return (
    <div ref={ref} className="relative">
      <IconButton label="Help" onClick={() => setOpen((v) => !v)} expanded={open}>
        <HelpCircle size={16} strokeWidth={1.7} />
      </IconButton>

      {open && (
        <Popover>
          <div className="p-1.5">
            <HelpLink href="/#how-it-works" Icon={Compass} label="How PakFinance works" />
            <HelpLink href="/#faq" Icon={BookOpen} label="Common questions" />
            <HelpLink href="/#security" Icon={ShieldCheck} label="How your data is protected" />
            <HelpLink
              href="mailto:support@pakfinance.app?subject=PakFinance%20support"
              Icon={Mail}
              label="Email support"
            />
          </div>
          <div
            className="border-t px-4 py-2.5 text-[11px]"
            style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}
          >
            PakFinance never asks for your bank login.
          </div>
        </Popover>
      )}
    </div>
  );
}

function HelpLink({ href, Icon, label }: { href: string; Icon: typeof Mail; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[12.5px] transition-colors duration-150 hover:bg-[var(--surface-2)]"
      style={{ color: "var(--text-secondary)" }}
    >
      <Icon size={15} strokeWidth={1.7} style={{ color: "var(--text-faint)" }} />
      {label}
    </Link>
  );
}

function Popover({ children }: { children: ReactNode }) {
  return (
    <div
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-[290px] overflow-hidden rounded-[14px] border"
      style={{
        borderColor: "var(--border-subtle)",
        backgroundColor: "#111318",
        boxShadow: "var(--highlight-top), 0 24px 64px -20px rgba(0,0,0,0.8)",
      }}
    >
      {children}
    </div>
  );
}

function IconButton({
  children,
  label,
  dot,
  onClick,
  expanded,
}: {
  children: ReactNode;
  label: string;
  dot?: boolean;
  onClick?: () => void;
  expanded?: boolean;
}) {
  return (
    <button
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={expanded}
      onClick={onClick}
      className="relative hidden h-9 w-9 place-items-center rounded-[10px] border transition-colors duration-200 hover:bg-[var(--surface-2)] sm:grid"
      style={{
        borderColor: expanded ? "var(--border-strong)" : "var(--border-subtle)",
        backgroundColor: expanded ? "var(--surface-2)" : "transparent",
        color: "var(--text-muted)",
      }}
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
