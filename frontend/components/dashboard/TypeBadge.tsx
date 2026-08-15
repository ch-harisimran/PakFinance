/**
 * Transaction-type chip. BUY / SELL / DIVIDEND on PSX, BUY / REDEEM on funds.
 *
 * Colour is derived from the direction of the money rather than hardcoded per
 * screen, so a new type only has to be classified once here.
 */
const INFLOW = new Set(["BUY", "DIVIDEND", "BONUS", "RIGHT"]);
const OUTFLOW = new Set(["SELL", "REDEEM"]);

export function TypeBadge({ type }: { type: string }) {
  const color = INFLOW.has(type)
    ? type === "BUY"
      ? "var(--color-gain)"
      : "var(--brass-text)"
    : OUTFLOW.has(type)
      ? "var(--color-loss)"
      : "var(--text-muted)";

  return (
    <span
      className="flex-none rounded-[6px] px-2 py-1 text-[10px] uppercase tracking-[0.1em]"
      style={{ fontFamily: "var(--font-mono)", backgroundColor: "var(--surface-2)", color }}
    >
      {type}
    </span>
  );
}
