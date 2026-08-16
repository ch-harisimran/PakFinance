import { redirect } from "next/navigation";
import { LogOut, Download, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { ProfileCard } from "@/components/settings/ProfileCard";
import { SecurityCard } from "@/components/settings/SecurityCard";
import { PreferencesCard } from "@/components/settings/PreferencesCard";
import { signOut } from "@/app/(auth)/actions";
import { getProfile } from "@/lib/queries";

/**
 * Settings.
 *
 * A server component so the signed-in user's real details arrive with the page.
 * Each panel that needs interactivity is its own client component underneath —
 * the whole screen used to be a client component holding invented values.
 */
export default async function SettingsPage() {
  const profile = await getProfile();
  // The proxy already guards /dashboard; this is for the type, and for the case
  // where a session expires between the two.
  if (!profile) redirect("/login?next=/dashboard/settings");

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader title="Settings" subtitle="Profile, security, preferences and your data" />

      <div className="grid gap-5 xl:grid-cols-2">
        <ProfileCard profile={profile} />
        <SecurityCard lastSignInAt={profile.lastSignInAt} />
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
                  Everything, with accounts, loans and goals kept whole
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
            <div className="mb-1 text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Delete account
            </div>
            <p className="mb-4 text-[12px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
              Every table cascades from your auth user, so deleting the account
              removes all of it. Doing that safely needs a service-role key on the
              server, which this build does not have yet — so the button is
              disabled rather than pretending. Export your data first if you are
              leaving; then ask us to remove the account.
            </p>
            <button
              disabled
              title="Not available yet"
              className="flex cursor-not-allowed items-center gap-2.5 rounded-[10px] px-4 py-2.5 text-[12.5px] font-medium opacity-50"
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
