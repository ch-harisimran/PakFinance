import { Users } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Meter } from "@/components/ui/Meter";
import { RowActions } from "@/components/dashboard/RowActions";
import { NoMatches } from "@/components/dashboard/SearchBox";
import {
  AddCommittee,
  CommitteeFields,
  LogCommitteePayment,
} from "@/components/forms/WealthForms";
import { updateCommittee } from "@/app/dashboard/actions";
import { getCommittees, committeesWithPosition } from "@/lib/queries-wealth";
import { karachiNow } from "@/lib/market/sessions";
import { filterBy, readQuery } from "@/lib/search";
import { paisaFull } from "@/lib/money";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Committees" };

/**
 * Committees (BC).
 *
 * A rotating savings pool is two things in sequence, and the screen says which
 * one you are in: before your turn the money you have paid is an asset coming
 * back to you; after it, the months still to pay are a real debt. Filing them
 * all under "savings" would be wrong for half of every committee.
 */
export default async function CommitteesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const raw = await getCommittees();
  const today = karachiNow().date;
  const { rows, assetPaisa, liabilityPaisa } = committeesWithPosition(raw, today);

  const q = readQuery((await searchParams).q);
  const shown = filterBy(rows, q, (c) => [c.name, c.organiser]);

  const arrears = rows.reduce((s, c) => s + c.arrearsPaisa, 0);
  const monthly = rows
    .filter((c) => !c.complete)
    .reduce((s, c) => s + c.monthly_paisa, 0);

  if (!raw.length) {
    return (
      <div className="flex-1 px-5 py-6 sm:px-6">
        <PageHeader
          title="Committees"
          subtitle="Rotating savings — everyone pays in monthly, one member takes the pot"
          actionSlot={<AddCommittee />}
        />
        <EmptyState
          Icon={Users}
          title="No committees yet"
          body="A BC is saving before your turn and a debt after it. Record one and PakFinance keeps track of what you have paid in, what you are owed, and when your pot is due."
          action={<AddCommittee />}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Committees"
        subtitle="Rotating savings — everyone pays in monthly, one member takes the pot"
        search="Search committees"
        actionSlot={<AddCommittee />}
      />

      <StatRow
        stats={[
          { k: "Paid in, not yet taken", v: paisaFull(assetPaisa), tone: "gain" },
          { k: "Owed after your pot", v: paisaFull(liabilityPaisa), tone: liabilityPaisa > 0 ? "loss" : "muted" },
          { k: "Monthly commitment", v: paisaFull(monthly), tone: "muted" },
          { k: "Behind by", v: paisaFull(arrears), tone: arrears > 0 ? "loss" : "muted" },
        ]}
      />

      {q && shown.length === 0 && <NoMatches query={q} noun="committees" />}

      <div className="grid gap-5 lg:grid-cols-2">
        {shown.map((c) => {
          const progress = c.members > 0 ? (c.roundsElapsed / c.members) * 100 : 0;
          const phase = c.complete
            ? "Finished"
            : c.payout_received
              ? "Repaying"
              : "Saving";

          return (
            <section key={c.id} className="card p-5">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em]">{c.name}</h3>
                  <p className="mt-1 text-[11.5px]" style={{ color: "var(--text-faint)" }}>
                    {c.organiser ? `${c.organiser} · ` : ""}
                    {c.members} members · {paisaFull(c.monthly_paisa)}/month
                  </p>
                </div>

                <div className="flex flex-none items-center gap-1.5">
                  <span
                    className="whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]"
                    style={{
                      fontFamily: "var(--font-mono)",
                      backgroundColor: c.payout_received
                        ? "rgba(226,87,76,0.12)"
                        : "rgba(201,162,39,0.12)",
                      color: c.payout_received ? "var(--color-loss)" : "var(--brass-text)",
                    }}
                  >
                    {phase}
                  </span>
                  <RowActions
                    table="committees"
                    id={c.id}
                    name={c.name}
                    consequence={
                      c.committee_payments.length
                        ? `Its ${c.committee_payments.length} logged contribution${c.committee_payments.length === 1 ? "" : "s"} will be deleted too.`
                        : undefined
                    }
                    editTitle="Edit committee"
                    action={updateCommittee}
                  >
                    <CommitteeFields initial={c} />
                  </RowActions>
                </div>
              </div>

              <div className="flex items-baseline text-[26px] font-semibold leading-none tracking-[-0.025em]">
                <span className="currency">PKR</span>
                <span data-numeric>{paisaFull(Math.abs(c.netPaisa))}</span>
              </div>
              <div className="mt-2 text-[12.5px]" style={{ color: "var(--text-muted)" }}>
                {c.netPaisa >= 0 ? "paid in and not yet taken" : "owed back to the committee"}
              </div>

              <Meter value={progress} className="mt-5" />
              <div className="mt-2 text-[11.5px]" style={{ color: "var(--text-faint)" }} data-numeric>
                Round {c.roundsElapsed} of {c.members}
                {c.payoutMonth ? ` · your turn ${c.payoutMonth}` : " · turn not drawn yet"}
              </div>

              {c.arrearsPaisa > 0 && (
                <p className="mt-3 text-[12px]" style={{ color: "var(--color-warning)" }}>
                  Behind by {paisaFull(c.arrearsPaisa)} against the schedule.
                </p>
              )}

              <div
                className="mt-5 flex items-center justify-between gap-4 border-t pt-4"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <LogCommitteePayment committeeId={c.id} />
                <span className="text-[11.5px]" style={{ color: "var(--text-faint)" }} data-numeric>
                  {paisaFull(c.paidPaisa)} of {paisaFull(c.potPaisa)} paid
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
