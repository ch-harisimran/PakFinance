/**
 * A round axis for a chart: sensible bounds, and values to label them with.
 *
 * The net-worth chart drew gridlines at a fixed 25/50/75% of its height. Those
 * are positions, not values — there is no number to write beside them, because
 * 75% of the way up a padded range is not a quantity anyone recognises. So the
 * line had nothing to be read against.
 *
 * The domain is chosen from the data rather than the data being squeezed into an
 * arbitrary domain: pick a round step, then snap the bounds outward to multiples
 * of it. The first and last ticks then sit exactly on the top and bottom of the
 * plot, which is what makes the gridlines meaningful instead of decorative.
 */

/** Steps a reader can do arithmetic with, per power of ten. */
const STEPS = [1, 2, 2.5, 5, 10];

export interface Scale {
  /** Bottom of the plot — a multiple of `step`, at or below the data minimum. */
  lo: number;
  /** Top of the plot — a multiple of `step`, at or above the data maximum. */
  hi: number;
  step: number;
  /** Ascending, from `lo` to `hi` inclusive. */
  ticks: number[];
}

/**
 * Build a scale covering `[min, max]` with roughly `target` ticks.
 *
 * The step is the candidate whose tick count lands closest to `target`, not
 * simply the next one up — rounding up alone produced a single tick for
 * 1,234–98,765, which is not an axis. Ties prefer the finer step, since more
 * gridlines read better than fewer on a chart this size.
 *
 * Never subdivides below 1: these are integer paisa, and a fractional one is not
 * a thing. That floor is also what stops a near-flat series from generating
 * millions of ticks.
 */
export function niceScale(min: number, max: number, target = 4): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { lo: 0, hi: 1, step: 1, ticks: [0, 1] };
  }

  let low = Math.min(min, max);
  let high = Math.max(min, max);

  // A flat series still needs a plot to sit in the middle of. 5% of the value,
  // or one unit when the value is zero.
  if (high === low) {
    const pad = Math.max(1, Math.abs(low) * 0.05);
    low -= pad;
    high += pad;
  }

  const span = high - low;
  const magnitude = 10 ** Math.floor(Math.log10(span / Math.max(1, target - 1)));

  let best: Scale | null = null;

  for (const multiple of STEPS) {
    const step = Math.max(1, multiple * magnitude);
    const lo = Math.floor(low / step) * step;
    const hi = Math.ceil(high / step) * step;
    const count = Math.round((hi - lo) / step) + 1;

    // Two ticks is the floor for an axis; beyond ~8 the labels start colliding.
    if (count < 2 || count > 9) continue;

    const distance = Math.abs(count - target);
    // `<=` so a later, coarser candidate never displaces an equally good finer
    // one — STEPS is ascending, so the first best wins ties.
    if (!best || distance < Math.abs(best.ticks.length - target)) {
      const ticks: number[] = [];
      for (let i = 0; i < count; i++) ticks.push(lo + i * step);
      best = { lo, hi, step, ticks };
    }
  }

  if (best) return best;

  // Nothing fit — a span so narrow that every candidate collapsed. The bounds
  // themselves are more use than an empty axis.
  return { lo: low, hi: high, step: high - low, ticks: [low, high] };
}
