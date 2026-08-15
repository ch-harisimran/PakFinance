import { PageHeader, StatRow } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/Panel";
import { FRESH, GOALS, GOAL_CONTRIBUTIONS } from "@/lib/dashboard-data";
import { formatCompact, formatFull } from "@/lib/money";

/**
 * Goals.
 *
 * The number that matters is not the target — it's the monthly contribution
 * required to still hit the date. That figure is what turns a wish into a plan,
 * so it sits on every card, and drifts to warning colour when it stops being
 * achievable at the current rate.
 */
const R = 52;
const C = 2 * Math.PI * R;

export default function GoalsPage() {
  const saved = GOALS.reduce((s, g) => s + g.have, 0);
  const target = GOALS.reduce((s, g) => s + g.target, 0);
  const monthly = GOALS.reduce((s, g) => s + g.monthly, 0);
  const onTrack = GOALS.filter((g) => g.onTrack).length;

  return (
    <div className="flex-1 px-5 py-6 sm:px-6">
      <PageHeader
        title="Goals"
        subtitle="What you're saving toward, and what it takes each month"
        freshness={FRESH.manual}
        search="Search goals"
        action="Add goal"
      />

      <StatRow
        stats={[
          { k: "Total saved", v: formatFull(saved) },
          { k: "Total target", v: formatFull(target), tone: "muted" },
          { k: "Monthly needed", v: formatFull(monthly), tone: "muted" },
          {
            k: "On track",
            v: `${onTrack} of ${GOALS.length}`,
            tone: onTrack === GOALS.length ? "gain" : "loss",
          },
        ]}
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        {GOALS.map((g) => {
          const tone = g.onTrack ? "var(--color-brass)" : "var(--color-warning)";
          return (
            <section key={g.name} className="card flex flex-col items-center p-6 text-center">
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
                {formatCompact(g.have)} of {formatCompact(g.target)}
              </p>

              <div
                className="mt-5 w-full border-t pt-4"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-baseline justify-between text-[12px]">
                  <span style={{ color: "var(--text-faint)" }}>Monthly needed</span>
                  <span className="font-semibold" style={{ color: tone }} data-numeric>
                    {formatFull(g.monthly)}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between text-[12px]">
                  <span style={{ color: "var(--text-faint)" }}>Target date</span>
                  <span data-numeric>{g.eta}</span>
                </div>
              </div>

              {!g.onTrack && (
                <p className="mt-4 text-[11.5px]" style={{ color: "var(--color-warning)" }}>
                  Behind schedule at the current rate
                </p>
              )}
            </section>
          );
        })}
      </div>

      <Panel title="Contributions" subtitle="Recent transfers into your goals" bodyClassName="p-0">
        {GOAL_CONTRIBUTIONS.map((c, i) => (
          <div
            key={`${c.goal}-${i}`}
            className="flex items-center justify-between gap-4 border-b px-5 py-3.5 last:border-b-0"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium">{c.goal}</div>
              <div className="mt-0.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
                {c.date}
              </div>
            </div>
            <span
              className="flex-none text-[13.5px] font-semibold"
              style={{ color: "var(--color-gain)" }}
              data-numeric
            >
              +{formatFull(c.amount)}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
