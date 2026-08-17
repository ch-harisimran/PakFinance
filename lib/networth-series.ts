/**
 * Joining the settled net-worth history to the value right now.
 *
 * The daily snapshot job records one point per day, and that is the only way
 * history can exist: bank balances and fund NAVs are not recoverable after the
 * fact, so yesterday's number is knowable only because something wrote it down
 * at the time.
 *
 * Today is different. Today is recomputed from the ledgers on every page load,
 * which means the chart can show it live — moving the moment a holding is added,
 * a balance is corrected, or the PSX sync brings in new closing prices. Without
 * this, the chart's most recent point was whatever the 13:30 job happened to see,
 * and a user who entered a large asset in the evening watched the headline
 * figure jump while the line under it stayed flat until tomorrow.
 *
 * Pure, and separate from `lib/queries-networth.ts`, which is `server-only` and
 * therefore cannot be exercised under the test runner.
 */

export interface SeriesPoint {
  /** YYYY-MM-DD, in Asia/Karachi — the same basis the snapshot job keys on. */
  date: string;
  valuePaisa: number;
}

/**
 * Return the series with `today` set to the live figure.
 *
 * Replaces a snapshot already written for today rather than adding a second
 * point for the same date: the live value is derived from the same ledgers the
 * job reads, only later, so it is strictly the better of the two. The stored row
 * stays as it is — tonight's run will overwrite it anyway, and this function
 * deliberately does not write anything.
 *
 * The input is assumed ascending by date, which is what `getNetWorthSeries`
 * returns. The output is too.
 */
export function withLiveToday(
  series: SeriesPoint[],
  today: string,
  netPaisa: number,
): SeriesPoint[] {
  // `< today` drops both today's stored snapshot (superseded by the live value)
  // and anything dated ahead of it. A future-dated point should not exist — the
  // job stamps Karachi dates and so does the caller — but clock skew on a runner
  // is not worth a chart that draws backwards.
  const settled = series.filter((p) => p.date < today);

  return [...settled, { date: today, valuePaisa: netPaisa }];
}
