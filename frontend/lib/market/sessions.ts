import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { marketHolidays, sessions } from "@/lib/db/schema/market";

/**
 * Is PSX open right now, and are we at a session close?
 *
 * Read from `market.sessions` and `market.market_holidays` rather than
 * hardcoded — PSX shortens hours through Ramadan every year and closes for Eid,
 * Ashura and Independence Day. Hardcoded hours are wrong for about a month a
 * year and silently wrong on every holiday.
 */

/**
 * How long after the final bell the closing snapshot may still be taken.
 *
 * Market watch keeps showing the settled closing prices after the session ends,
 * so a snapshot taken later is *better* than one taken at 15:29 — it cannot
 * catch a mid-session price by mistake. A generous window also absorbs
 * scheduler drift; GitHub Actions cron is regularly minutes late.
 */
export const POST_CLOSE_WINDOW_MINUTES = 180;

export interface KarachiNow {
  /** YYYY-MM-DD in Asia/Karachi. */
  date: string;
  /** 1 = Monday … 7 = Sunday. */
  weekday: number;
  /** Minutes since midnight. */
  minutes: number;
  hhmm: string;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Asia/Karachi is UTC+5 with no DST, but we resolve it through Intl anyway —
 * a hardcoded offset is the kind of thing that silently rots.
 */
export function karachiNow(at: Date = new Date()): KarachiNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Karachi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const hour = Number(parts.hour) % 24;
  const minute = Number(parts.minute);

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS.indexOf(parts.weekday) + 1,
    minutes: hour * 60 + minute,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export interface MarketState {
  now: KarachiNow;
  /** A session is running right now. */
  open: boolean;
  /** Today is a weekday and not a holiday — i.e. a trading day. */
  tradingDay: boolean;
  /**
   * The final session of the day has ended and we are still inside the
   * post-close window — the right moment to write the permanent daily bar.
   */
  inPostClose: boolean;
  reason: "open" | "holiday" | "weekend" | "pre-open" | "between-sessions" | "after-close";
  detail?: string;
}

export async function getMarketState(at: Date = new Date()): Promise<MarketState> {
  const now = karachiNow(at);

  const holiday = await db
    .select({ reason: marketHolidays.reason })
    .from(marketHolidays)
    .where(eq(marketHolidays.holidayDate, now.date))
    .limit(1);

  if (holiday.length) {
    return {
      now,
      open: false,
      tradingDay: false,
      inPostClose: false,
      reason: "holiday",
      detail: holiday[0].reason,
    };
  }

  if (now.weekday > 5) {
    return { now, open: false, tradingDay: false, inPostClose: false, reason: "weekend" };
  }

  const todays = await db.select().from(sessions).where(eq(sessions.weekday, now.weekday));
  if (!todays.length) {
    return { now, open: false, tradingDay: false, inPostClose: false, reason: "weekend" };
  }

  const open = todays.some(
    (s) => now.minutes >= toMinutes(s.opensAt) && now.minutes <= toMinutes(s.closesAt),
  );

  const firstOpen = Math.min(...todays.map((s) => toMinutes(s.opensAt)));
  const lastClose = Math.max(...todays.map((s) => toMinutes(s.closesAt)));
  const sinceClose = now.minutes - lastClose;

  return {
    now,
    open,
    tradingDay: true,
    inPostClose: sinceClose > 0 && sinceClose <= POST_CLOSE_WINDOW_MINUTES,
    reason: open
      ? "open"
      : now.minutes < firstOpen
        ? "pre-open"
        : sinceClose > 0
          ? "after-close"
          : "between-sessions",
  };
}
