/**
 * The dashboard's time-of-day greeting.
 *
 * Four bands, one of which WRAPS MIDNIGHT:
 *
 *   03:00 – 11:59  Good morning
 *   12:00 – 16:59  Good afternoon
 *   17:00 – 19:59  Good evening
 *   20:00 – 02:59  Good night
 *
 * The wrap is the whole reason this is a function with tests rather than a
 * ternary in the page. "20:00 to 02:59" is not a single `hour >= a && hour < b`
 * comparison, and the obvious spelling of it — `hour >= 20 && hour < 3` — is
 * never true. Written as an ascending ladder instead, so the late-night hours
 * fall out of the first branch and the rest read in clock order.
 *
 * Hours are Asia/Karachi, matching the rest of the app: market sessions,
 * snapshot dates and Zakat all key off Karachi time, and a greeting that
 * disagreed with the market status beside it would look broken.
 */
export type Greeting = "Good morning" | "Good afternoon" | "Good evening" | "Good night";

/** `hour` is 0–23 in Asia/Karachi. Anything outside that returns the night. */
export function greetingFor(hour: number): Greeting {
  if (!Number.isFinite(hour)) return "Good night";

  if (hour < 3) return "Good night"; // 00:00–02:59, the tail of the night band
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 20) return "Good evening";
  return "Good night"; // 20:00–23:59, the head of it
}

/**
 * The current hour in Karachi.
 *
 * Through `Intl` rather than an offset: Pakistan is UTC+5 with no DST today,
 * but a hardcoded `+5` is the kind of thing that rots silently if that ever
 * changes.
 */
export function karachiHour(at: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      hour: "2-digit",
      hour12: false,
    }).format(at),
  );
}
