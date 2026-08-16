import { redirect } from "next/navigation";
import { LogOut, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { ProfileCard } from "@/components/settings/ProfileCard";
import { SecurityCard } from "@/components/settings/SecurityCard";
import { PreferencesCard } from "@/components/settings/PreferencesCard";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { signOut } from "@/app/(auth)/actions";
import { getProfile } from "@/lib/queries";
import { getSessions } from "@/lib/queries-sessions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

/**
 * Settings.
 *
 * A server component so the signed-in user's real details arrive with the page.
 * Each panel that needs interactivity is its own client component underneath —
 * the whole screen used to be a client component holding invented values.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  const profile = await getProfile();
  // The proxy already guards /dashboard; this is for the type, and for the case
  // where a session expires between the two.
  if (!profile) redirect("/login?next=/dashboard/settings");

  const sessions = await getSessions();
  const confirm = (await searchParams).confirm;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader title="Settings" subtitle="Profile, security, preferences and your data" />

      {/* Where /auth/confirm sends the user back to after an email-change link. */}
      {confirm === "ok" && (
        <p
          className="mb-5 rounded-[12px] border px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)", color: "var(--color-gain)" }}
        >
          Confirmed. Once both addresses have confirmed, sign in with the new one.
        </p>
      )}
      {confirm === "invalid" && (
        <p
          className="mb-5 rounded-[12px] border px-4 py-3 text-[13px]"
          style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--surface-1)", color: "var(--color-loss)" }}
        >
          That confirmation link has expired or was already used. Start the change again below.
        </p>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <ProfileCard profile={profile} />
        <SecurityCard
          lastSignInAt={profile.lastSignInAt}
          sessions={sessions}
          pinSet={profile.pinSet}
        />
        <PreferencesCard profile={profile} />

        <Panel title="Your data">
          <p className="mb-5 text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Everything you enter belongs to you. Export it whenever you like, in a
            format other tools can read.
          </p>

          <div className="flex flex-col gap-3">
            {/* Plain links, not fetch-and-blob: the browser handles the download,
                the Content-Disposition header names the file, and nothing has to
                be held in memory on the way through. */}
            <a
              href="/api/export?format=pdf"
              className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-strong)" }}
            >
              <FileText size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
              <span>
                Portfolio report (PDF)
                <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                  Your whole position, with what stands out — made to read, not to re-import
                </span>
              </span>
            </a>
            <a
              href="/api/export?format=csv"
              className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Download size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
              <span>
                Export as CSV
                <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                  One row per money movement, for a spreadsheet
                </span>
              </span>
            </a>
            <a
              href="/api/export?format=json"
              className="flex items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <Download size={15} strokeWidth={1.7} style={{ color: "var(--brass-text)" }} />
              <span>
                Export as JSON
                <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                  Every record you have entered, kept whole — the complete copy
                </span>
              </span>
            </a>
          </div>
        </Panel>

        {/*
          Its own card. Signing out and deleting the account are things you do
          to the ACCOUNT; exporting is something you do to the DATA. Filing a
          session action under "Your data" makes the reader hunt for it in the
          wrong place.
        */}
        <Panel title="Account">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left text-[13px] transition-colors duration-200 hover:bg-[var(--surface-2)]"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <LogOut size={15} strokeWidth={1.7} style={{ color: "var(--text-muted)" }} />
              Log out of this device
            </button>
          </form>

          <div className="mt-6 border-t pt-5" style={{ borderColor: "var(--border-subtle)" }}>
            <DeleteAccount email={profile.email} />
          </div>
        </Panel>
      </div>
    </div>
  );
}
