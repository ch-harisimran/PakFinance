/**
 * One money formatter, used everywhere.
 *
 * The reference dashboard showed the same figure three different ways and an
 * axis off by 1000×. That happens when formatting is done ad hoc at each call
 * site. Everything numeric on the dashboard goes through this file.
 *
 * Values are plain rupees here because the dashboard is display-only. When the
 * data layer lands these become integer paisa (see PLAN.md §4) and only
 * `toRupees` changes.
 */

export type Notation = "international" | "subcontinental";

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max });

/** 2,450,059 → "2,450,059" */
export function formatFull(rupees: number, decimals = 0): string {
  return nf(decimals, decimals).format(rupees);
}

/**
 * Compact form for tiles and axes.
 *   international : 2,450,059 → "2.45M"   ·  850,000 → "850K"
 *   subcontinental: 2,450,059 → "24.5L"   ·  850,000 → "8.5L"
 *
 * Pakistani users read lakh/crore faster than millions; this is a settings
 * toggle, not a hardcoded choice.
 */
export function formatCompact(rupees: number, notation: Notation = "international"): string {
  const n = Math.abs(rupees);
  const sign = rupees < 0 ? "−" : "";

  if (notation === "subcontinental") {
    if (n >= 10_000_000) return `${sign}${nf(0, 2).format(n / 10_000_000)}Cr`;
    if (n >= 100_000) return `${sign}${nf(0, 1).format(n / 100_000)}L`;
    if (n >= 1_000) return `${sign}${nf(0, 1).format(n / 1_000)}K`;
    return `${sign}${nf(0, 0).format(n)}`;
  }

  if (n >= 1_000_000) return `${sign}${nf(0, 2).format(n / 1_000_000)}M`;
  if (n >= 1_000) return `${sign}${nf(0, 1).format(n / 1_000)}K`;
  return `${sign}${nf(0, 0).format(n)}`;
}

/** Always signed, always 2dp. Deltas must never be ambiguous. */
export function formatPct(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${nf(2, 2).format(Math.abs(pct))}%`;
}

/** U+2212 minus, not a hyphen — it aligns with digits in tabular figures. */
export function formatSigned(rupees: number): string {
  const sign = rupees > 0 ? "+" : rupees < 0 ? "−" : "";
  return `${sign}${formatFull(Math.abs(rupees))}`;
}

/**
 * Nice axis ceiling for a series — the reference's cash-flow axis topped out at
 * "1000M" against a 225,000 series because nothing rounded the domain.
 */
export function axisMax(values: number[]): number {
  const peak = Math.max(...values, 0);
  if (peak === 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(peak));
  return Math.ceil(peak / (mag / 2)) * (mag / 2);
}
