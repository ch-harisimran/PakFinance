/**
 * Dashboard skeleton.
 *
 * Shapes that match what is coming — a wide hero, a balance strip, then panels —
 * rather than a spinner. A spinner says "wait"; a skeleton says "here is the
 * page, the numbers are on their way", and the layout does not jump when they
 * land.
 *
 * The pulse is CSS only. Loading UI that ships JavaScript to animate itself is
 * competing for the main thread with the very work it is waiting on.
 */
function Block({ h, className = "" }: { h: number; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-[12px] ${className}`}
      style={{ height: h, backgroundColor: "var(--surface-2)" }}
    />
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex-1 px-5 py-6 sm:px-6" aria-busy="true" aria-label="Loading your figures">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Block h={230} />
        <Block h={230} />
      </div>

      <div className="mt-5">
        <Block h={96} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Block key={i} h={210} />
        ))}
      </div>
    </div>
  );
}
