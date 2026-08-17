/**
 * Committee (BC) position.
 *
 * A committee is a rotating savings pool: N members each pay the same amount
 * every month for N months, and each month one member takes the whole pot. It
 * is ordinary in Pakistan and fits nothing else in this schema, because it is
 * two different things in sequence:
 *
 *   before your turn   you are saving — money paid in, nothing back yet
 *   after your turn    you are repaying — you hold the pot and still owe the
 *                      remaining months
 *
 * That is why `netPaisa` can be either sign, and why the balance sheet has to
 * ask which side of the payout you are on rather than filing committees under
 * "savings" and being wrong for half of every one.
 *
 * Pure arithmetic. No database, no clock of its own.
 */

export interface Committee {
  members: number;
  monthlyPaisa: number;
  startMonth: string; // YYYY-MM-DD
  payoutPosition: number | null;
  payoutReceived: boolean;
  isSettled: boolean;
}

export interface CommitteePosition {
  /** Total pot, i.e. what you receive on your turn. */
  potPaisa: number;
  /** Rounds elapsed, capped at the committee's length. */
  roundsElapsed: number;
  roundsRemaining: number;
  /** What the schedule says you should have paid by now. */
  dueToDatePaisa: number;
  /** What you have actually paid, from the ledger. */
  paidPaisa: number;
  /** Behind on contributions by this much. */
  arrearsPaisa: number;
  /** The pot, if you have taken it. */
  receivedPaisa: number;
  /** Still to pay across the remaining rounds. */
  remainingPaisa: number;
  /**
   * Your position. Positive means the committee owes you (you have paid in more
   * than you have taken out); negative means you owe it.
   */
  netPaisa: number;
  /** Estimated month of your payout, when the position is known. */
  payoutMonth: string | null;
  complete: boolean;
}

/** Whole months from one YYYY-MM-DD to another, by calendar month. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

/** Add whole months to a YYYY-MM-DD, clamped to the month's length. */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const daysInMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d, daysInMonth));
  return target.toISOString().slice(0, 10);
}

export function committeePosition(
  c: Committee,
  paidPaisa: number,
  today: string,
): CommitteePosition {
  const potPaisa = c.monthlyPaisa * c.members;

  // Round 1 is the start month itself, so a committee beginning this month has
  // one contribution due, not zero.
  const elapsedRaw = monthsBetween(c.startMonth, today) + 1;
  const roundsElapsed = Math.max(0, Math.min(c.members, elapsedRaw));
  const roundsRemaining = Math.max(0, c.members - roundsElapsed);

  const dueToDatePaisa = roundsElapsed * c.monthlyPaisa;
  const arrearsPaisa = Math.max(0, dueToDatePaisa - paidPaisa);
  const receivedPaisa = c.payoutReceived ? potPaisa : 0;
  const remainingPaisa = roundsRemaining * c.monthlyPaisa;

  return {
    potPaisa,
    roundsElapsed,
    roundsRemaining,
    dueToDatePaisa,
    paidPaisa,
    arrearsPaisa,
    receivedPaisa,
    remainingPaisa,
    // Paid in, minus taken out. Before your turn this is an asset; after it,
    // a liability until the remaining months are paid.
    netPaisa: paidPaisa - receivedPaisa,
    payoutMonth:
      c.payoutPosition && c.payoutPosition > 0
        ? addMonths(c.startMonth, c.payoutPosition - 1)
        : null,
    complete: c.isSettled || (roundsRemaining === 0 && paidPaisa >= potPaisa - c.monthlyPaisa),
  };
}

/**
 * Split across the balance sheet.
 *
 * Money paid into a committee you have not yet collected is an asset — it is
 * coming back. Once you have taken the pot, the contributions still owed are a
 * liability, because you have had the money and must now finish paying for it.
 */
export function committeeBalanceSheet(positions: CommitteePosition[], received: boolean[]) {
  let assetPaisa = 0;
  let liabilityPaisa = 0;

  positions.forEach((p, i) => {
    if (received[i]) liabilityPaisa += p.remainingPaisa;
    else assetPaisa += p.paidPaisa;
  });

  return { assetPaisa, liabilityPaisa };
}
