/**
 * Categorical data palette and the data-freshness type.
 *
 * These were the last two things left in `lib/dashboard-data.ts` after every
 * screen moved onto real queries — neither is fixture data, so they live here
 * and that file is gone.
 *
 * Separated by HUE first, lightness second: the brand is one colour by design,
 * but categories cannot be, and four tints of brass forces the reader to
 * compare shades of yellow. Deliberately avoids the green and red bands so a
 * category can never be mistaken for a gain or a loss. See design/tokens.css.
 */
export const CHART = [
  "#C9A227", // brass       45°
  "#4E92B8", // steel blue 200°
  "#9080C8", // violet     258°
  "#C4A08A", // sand        25°
  "#5FA8A3", // teal       176°
  "#B9B4A8", // warm grey  desaturated
];

/**
 * How old a number is, and where it came from.
 *
 * PSX prices, MUFAP NAVs and hand-entered balances have wildly different ages,
 * so freshness is stamped per card rather than once for the whole page.
 */
export type Freshness = {
  label: string;
  tone: "live" | "daily" | "manual";
};
