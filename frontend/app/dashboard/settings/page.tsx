"use client";

import { useState } from "react";
import { Monitor, Moon, Sun, LogOut, Download, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { Field } from "@/components/ui/Field";
import { SwitchRow } from "@/components/ui/Switch";
import { formatCompact } from "@/lib/money";

/**
 * Settings.
 *
 * The number-notation toggle is here because `lib/money.ts` already implements
 * lakh/crore — a Pakistani user reads "24.5L" faster than "2,450,000", and the
 * formatter should follow the reader rather than the developer.
 */

const SAMPLE = 2450058;

export default function SettingsPage() {
  const router = useRouter();
  const [notation, setNotation] = useState<"international" | "subcontinental">("international");
  const [theme, setTheme] = useState("dark");

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader title="Settings" subtitle="Profile, security, preferences and your data" />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Profile">
          <div className="mb-5 flex items-center gap-4">
            <span
              className="grid h-14 w-14 place-items-center rounded-full text-[17px] font-semibold"
              style={{ backgroundColor: "var(--surface-3)" }}
            >
              HK
            </span>
            <button
              className="rounded-[10px] border px-3.5 py-2 text-[12.5px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
            >
              Change photo
            </button>
          </div>
          <div className="flex flex-col gap-4">
            <Field label="Full name" defaultValue="Haris Khan" />
            <Field label="Email" type="email" defaultValue="haris@example.com" />
            <Field label="Phone" defaultValue="+92 300 1234567" hint="Used for future SMS alerts only." />
          </div>
        </Panel>

        <Panel title="Security">
          <div className="flex flex-col gap-4">
            <Field label="Current password" type="password" placeholder="••••••••" />
            <Field label="New password" type="password" placeholder="At least 8 characters" />
            <Field label="Confirm new password" type="password" placeholder="Repeat it" />
          </div>

          <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
            <SwitchRow
              label="Two-factor authentication"
              hint="Require a one-time code at every login."
              defaultOn
            />
            <div className="mt-5">
              <div className="mb-2 text-[13px] font-medium">Active sessions</div>
              <div
                className="flex items-center justify-between rounded-[10px] border px-3.5 py-3"
                style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)" }}
              >
                <div>
                  <div className="text-[12.5px]">Windows · Chrome</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                    Karachi · current session
                  </div>
                </div>
                <span className="text-[11.5px]" style={{ color: "var(--color-gain)" }}>
                  Active
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Preferences">
          <div className="mb-6">
            <div className="mb-1 text-[13px] font-medium">Number format</div>
            <p className="mb-3 text-[12px]" style={{ color: "var(--text-faint)" }}>
              How large figures are abbreviated across the app.
            </p>
            <div
              className="flex gap-0.5 rounded-[10px] border p-1"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {(
                [
                  ["international", "International"],
                  ["subcontinental", "Lakh / Crore"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setNotation(key)}
                  className="flex-1 rounded-[7px] px-3 py-2 text-[12.5px] transition-colors duration-200"
                  style={{
                    backgroundColor: notation === key ? "var(--surface-3)" : "transparent",
                    color: notation === key ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[12px]" style={{ color: "var(--text-muted)" }}>
              Your net worth reads{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }} data-numeric>
                PKR {formatCompact(SAMPLE, notation)}
              </span>
            </p>
          </div>

          <div className="mb-6">
            <div className="mb-3 text-[13px] font-medium">Theme</div>
            <div
              className="flex gap-0.5 rounded-[10px] border p-1"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              {[
                { key: "light", label: "Light", Icon: Sun },
                { key: "dark", label: "Dark", Icon: Moon },
                { key: "system", label: "System", Icon: Monitor },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTheme(t.key)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[7px] px-3 py-2 text-[12.5px] transition-colors duration-200"
                  style={{
                    backgroundColor: theme === t.key ? "var(--surface-3)" : "transparent",
                    color: theme === t.key ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  <t.Icon size={14} strokeWidth={1.7} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
            <SwitchRow label="Installment reminders" hint="Email me before a payment is due." defaultOn />
            <SwitchRow label="Price alerts" hint="When a holding moves more than 5% in a day." />
            <SwitchRow label="Monthly summary" hint="A recap of net worth and cash flow." defaultOn />
          </div>
        </Panel>

        <Panel title="Your data">
          <p className="mb-5 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Everything you enter belongs to you. Export it whenever you like, in a
            format other tools can read.
          </p>

          <div className="flex flex-col gap-3">
            <button
              className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Download size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
              Export everything as CSV
            </button>
            <button
              className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Download size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
              Export everything as JSON
            </button>
          </div>

        </Panel>

        {/*
          Its own card. Signing out and deleting the account are things you do
          to the ACCOUNT; exporting is something you do to the DATA. Filing a
          session action under "Your data" makes the reader hunt for it in the
          wrong place.
        */}
        <Panel title="Account">
          <button
            onClick={() => router.push("/login")}
            className="flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <LogOut size={15} strokeWidth={1.7} style={{ color: "var(--text-muted)" }} />
            Log out of this device
          </button>

          <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="mb-1 text-[13px] font-medium" style={{ color: "var(--color-loss)" }}>
              Delete account
            </div>
            <p className="mb-4 text-[12px]" style={{ color: "var(--text-faint)" }}>
              Permanently removes your account and every record in it. This cannot
              be undone, and will ask you to type your email to confirm.
            </p>
            <button
              className="flex items-center gap-2.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-medium transition-colors duration-200"
              style={{ backgroundColor: "rgba(226,87,76,0.12)", color: "var(--color-loss)" }}
            >
              <Trash2 size={14} strokeWidth={1.8} />
              Delete my account
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
