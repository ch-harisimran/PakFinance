/**
 * Progress track. Appeared inline in six places — goals, liabilities, loan
 * repayment, expense split, allocation rows and the hero loan card — each with
 * its own hand-written track/fill pair and slightly different height.
 */
export function Meter({
  value,
  color = "var(--color-brass)",
  track = "var(--surface-3)",
  height = 6,
  className = "",
}: {
  /** 0–100. Clamped, so bad data can never paint outside the track. */
  value: number;
  color?: string;
  track?: string;
  height?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={`overflow-hidden rounded-full ${className}`}
      style={{ height, backgroundColor: track }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
