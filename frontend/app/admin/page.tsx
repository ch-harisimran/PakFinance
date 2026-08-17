import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE, isAdminEmail, adminState, hasAdminSession } from "@/lib/admin/auth";
import { AdminGate } from "@/components/admin/AdminGate";
import { AdminConsole } from "@/components/admin/AdminConsole";

export const metadata: Metadata = {
  title: "Console",
  robots: { index: false, follow: false, nocache: true },
};

// The console reads live state and sets cookies; nothing here may be cached.
export const dynamic = "force-dynamic";

/**
 * The admin console.
 *
 * Deliberately OUTSIDE /dashboard and deliberately not in the proxy's protected
 * list. A protected route redirects a stranger to /login?next=/admin, which
 * confirms the route exists; this one returns 404 to everyone who is not the
 * configured admin — signed out, signed in as somebody else, or signed in as the
 * admin address before ADMIN_EMAIL is set. There is no link to it anywhere in the
 * app.
 *
 * Who the admin is comes from ADMIN_EMAIL in the environment. There is no role
 * column, no invite and no first-user-wins, so nobody can make themselves an
 * admin from inside the app.
 *
 * Then a second password, because what the console writes — `market.funds` and
 * `market.fund_navs` — is one catalogue shared by every user. A hijacked app
 * session should not be able to rewrite the prices everyone is valued against.
 */
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // One 404 for every failure mode, so the response cannot be used to learn
  // whether the route exists or which address is the admin.
  if (!user || !isAdminEmail(user.email)) notFound();

  const state = await adminState(user.id);
  const jar = await cookies();
  const unlocked = await hasAdminSession(user.id, jar.get(ADMIN_COOKIE)?.value);

  return (
    <main
      className="min-h-screen px-5 py-10 sm:px-8"
      style={{ backgroundColor: "var(--color-ground-ink)", color: "var(--text-primary)" }}
    >
      <div className="mx-auto w-full max-w-[720px]">
        <div
          className="mb-8 text-[10.5px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--brass-text)" }}
        >
          PakFinance · console
        </div>

        {unlocked ? (
          <AdminConsole email={user.email ?? ""} />
        ) : (
          <AdminGate
            email={user.email ?? ""}
            hasPassword={state.hasPassword}
            lockedUntil={state.lockedUntil?.toISOString() ?? null}
          />
        )}
      </div>
    </main>
  );
}
