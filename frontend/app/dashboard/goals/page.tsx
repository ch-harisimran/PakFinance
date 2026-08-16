import { Target } from "lucide-react";
import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { RowActions } from "@/components/dashboard/RowActions";
import {
  AddGoal,
  AddContribution,
  GoalFields,
  ContributionFields,
} from "@/components/forms/EntryForms";
import { updateGoal, updateContribution } from "@/app/dashboard/actions";
import { getGoals, goalProgress } from "@/lib/queries";
import { paisaCompact, paisaFull } from "@/lib/money";

/**
 * Goals.
 *
 * The number that matters is not the target — it is the monthly contribution
 * required to still hit the date. `goalProgress` derives it, and a goal drifts
 * to warning colour when the pace so far falls short, even if progress looks
 * healthy.
 */
const R = 52;
const C = 2 * Math.PI * R;

export default async function GoalsPage() {
  const goals = await getGoals();
  const rows = goals.map((g) => ({ ...g, ...goalProgress(g) }));

  const saved = rows.reduce((s, g) => s + g.savedPaisa, 0);
  const target = rows.reduce((s, g) => s + g.target_paisa, 0);
  const monthly = rows.reduce((s, g) => s + g.monthlyNeededPaisa, 0);
  const onTrack = rows.filter((g) => g.onTrack).length;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Goals"
        subtitle="What you're saving toward, and what it takes each month"
        search={rows.length ? "Search goals" : undefined}
        actionSlot={<AddGoal />}
      />

      {rows.length === 0 ? (
        <EmptyState
          Icon={Target}
          title="No goals yet"
          body="A goal is a target and a date. PakFinance works out what you need to put aside each month to get there — and tells you when you drift."
          action={<AddGoal />}
        />
      ) : (
        <>
          <StatRow
            stats={[
              { k: "Total saved", v: paisaFull(saved) },
              { k: "Total target", v: paisaFull(target), tone: "muted" },
              { k: "Monthly needed", v: paisaFull(monthly), tone: "muted" },
              {
                k: "On track",
                v: `${onTrack} of ${rows.length}`,
                tone: onTrack === rows.length ? "gain" : "loss",
              },
            ]}
          />

          <div className="mb-5 grid gap-5 lg:grid-cols-3">
            {rows.map((g) => {
              const tone = g.onTrack ? "var(--color-brass)" : "var(--color-warning)";
              return (
                <section key={g.id} className="card relative flex flex-col items-center p-6 text-center">
                  {/* The card is centre-aligned with no header bar, so the menu
                      is pinned to the corner rather than sharing a row. */}
                  <div className="absolute right-3 top-3">
                    <RowActions
                      table="goals"
                      id={g.id}
                      name={g.name}
                      consequence={
                        g.goal_contributions.length
                          ? `Its ${g.goal_contributions.length} contribution${g.goal_contributions.length === 1 ? "" : "s"} will be deleted too.`
                          : undefined
                      }
                      editTitle="Edit goal"
                      editDescription="Progress is the sum of your contributions, so it re-derives itself."
                      action={updateGoal}
                    >
                      <GoalFields initial={g} />
                    </RowActions>
                  </div>

                  <div className="relative">
                    <svg viewBox="0 0 120 120" className="h-[132px] w-[132px] -rotate-90">
                      <circle cx="60" cy="60" r={R} fill="none" strokeWidth="8" stroke="var(--surface-3)" />
                      <circle
                        cx="60"
                        cy="60"
                        r={R}
                        fill="none"
                        strokeWidth="8"
                        strokeLinecap="round"
                        stroke={tone}
                        strokeDasharray={C}
                        strokeDashoffset={C * (1 - g.pct / 100)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-[24px] font-semibold leading-none tracking-[-0.02em]" data-numeric>
                        {g.pct.toFixed(0)}%
                      </span>
                      <span className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                        funded
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-5 text-[15px] font-semibold tracking-[-0.01em]">{g.name}</h3>
                  <p className="mt-1.5 text-[12.5px]" style={{ color: "var(--text-muted)" }} data-numeric>
                    {paisaCompact(g.savedPaisa)} of {paisaCompact(g.target_paisa)}
                  </p>

                  <div className="mt-5 w-full border-t pt-4" style={{ borderColor: "var(--border-subtle)" }}>
                    <div className="flex items-baseline justify-between text-[12px]">
                      <span style={{ color: "var(--text-faint)" }}>Monthly needed</span>
                      <span className="font-semibold" style={{ color: tone }} data-numeric>
                        {g.target_date ? paisaFull(g.monthlyNeededPaisa) : "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between text-[12px]">
                      <span style={{ color: "var(--text-faint)" }}>Target date</span>
                      <span data-numeric>{g.target_date ?? "Not set"}</span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <AddContribution goalId={g.id} />
                  </div>

                  {!g.onTrack && (
                    <p className="mt-3 text-[11.5px]" style={{ color: "var(--color-warning)" }}>
                      Behind schedule at the current rate
                    </p>
                  )}
                </section>
              );
            })}
          </div>

          <Panel title="Contributions" subtitle="Recent transfers into your goals" bodyClassName="p-0">
            {rows.flatMap((g) => g.goal_contributions.map((c) => ({ ...c, goal: g.name })))
              .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
              .slice(0, 12)
              .map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{c.goal}</div>
                    <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                      {c.occurred_at}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1.5">
                    <span
                      className="text-[13.5px] font-semibold"
                      style={{ color: "var(--color-gain)" }}
                      data-numeric
                    >
                      +{paisaFull(c.amount_paisa)}
                    </span>
                    <RowActions
                      table="goal_contributions"
                      id={c.id}
                      name={`${paisaFull(c.amount_paisa)} added on ${c.occurred_at}`}
                      consequence="The goal's progress will drop by that amount."
                      editTitle="Edit contribution"
                      action={updateContribution}
                    >
                      <ContributionFields initial={c} />
                    </RowActions>
                  </div>
                </div>
              ))}
            {rows.every((g) => g.goal_contributions.length === 0) && (
              <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--text-faint)" }}>
                No contributions logged yet.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
