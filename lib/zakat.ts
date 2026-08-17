/**
 * Zakat.
 *
 * READ THIS BEFORE CHANGING ANY NUMBER HERE.
 *
 * Zakat is an act of worship, not an accounting convention, and scholars differ
 * on several of the inputs below. This module therefore does exactly two things:
 * it adds up what the user has told it, and it shows its working. It does not
 * decide anything contested on the user's behalf.
 *
 * What is settled and is hardcoded:
 *   - The rate is 1/40, or 2.5%, on wealth held for a lunar year (hawl).
 *   - Nisab is the value of 87.48g of gold or 612.36g of silver. Which of the
 *     two to use is a choice with real consequences — silver is far cheaper, so
 *     it catches more people — and it is the user's to make.
 *
 * What is contested and is therefore a per-item switch, never an assumption:
 *   - Whether shares held long-term are zakatable at market value or only on
 *     the underlying zakatable assets of the company.
 *   - Whether a house you live in, or a car you drive, counts. (Generally not.)
 *   - Which debts may be deducted.
 *
 * The UI states that this is a calculator, not a fatwa, and points the user at
 * their own scholar. Do not let this file drift into implying otherwise.
 */

/** Grams of gold at which nisab is reached. */
export const NISAB_GOLD_GRAMS = 87.48;
/** Grams of silver at which nisab is reached. */
export const NISAB_SILVER_GRAMS = 612.36;
/** 2.5%, i.e. one fortieth. */
export const ZAKAT_RATE = 0.025;

export type NisabBasis = "gold" | "silver";

export interface ZakatInput {
  /** Bank balances and cash in hand. Zakatable in full. */
  cashPaisa: number;
  /** Market value of shares the user holds. */
  stocksPaisa: number;
  /** Market value of mutual fund units. */
  fundsPaisa: number;
  /** Assets the user has marked zakatable — gold, silver, trade goods. */
  otherAssetsPaisa: number;
  /** Money lent out and expected back. */
  receivablesPaisa: number;
  /** Committee contributions paid in but not yet received back. */
  committeesPaisa: number;
  /** Debts the user intends to deduct. */
  deductionsPaisa: number;
  /** Price per gram, in paisa, of whichever metal sets the nisab. */
  metalPricePerGramPaisa: number;
  basis: NisabBasis;
}

export interface ZakatLine {
  key: string;
  label: string;
  amountPaisa: number;
  /** Positive adds to the pool, negative takes away. */
  direction: "add" | "deduct";
  note?: string;
}

export interface ZakatResult {
  lines: ZakatLine[];
  assetsPaisa: number;
  deductionsPaisa: number;
  zakatablePaisa: number;
  nisabPaisa: number;
  /** False when the net total is under nisab: nothing is owed. */
  meetsNisab: boolean;
  duePaisa: number;
}

/** Nisab in paisa, from a price per gram of the chosen metal. */
export function nisabFrom(basis: NisabBasis, pricePerGramPaisa: number): number {
  const grams = basis === "gold" ? NISAB_GOLD_GRAMS : NISAB_SILVER_GRAMS;
  return Math.round(grams * pricePerGramPaisa);
}

export function calculateZakat(input: ZakatInput): ZakatResult {
  const lines: ZakatLine[] = [
    {
      key: "cash",
      label: "Cash and bank balances",
      amountPaisa: input.cashPaisa,
      direction: "add",
    },
    {
      key: "stocks",
      label: "Shares at market value",
      amountPaisa: input.stocksPaisa,
      direction: "add",
      note: "Some scholars assess only the zakatable assets underlying a long-held share.",
    },
    {
      key: "funds",
      label: "Mutual fund units",
      amountPaisa: input.fundsPaisa,
      direction: "add",
    },
    {
      key: "assets",
      label: "Gold, silver and other assets you marked zakatable",
      amountPaisa: input.otherAssetsPaisa,
      direction: "add",
    },
    {
      key: "receivables",
      label: "Money lent out and expected back",
      amountPaisa: input.receivablesPaisa,
      direction: "add",
      note: "Debts you doubt you will recover are usually excluded until received.",
    },
    {
      key: "committees",
      label: "Committee contributions not yet received",
      amountPaisa: input.committeesPaisa,
      direction: "add",
    },
    {
      key: "deductions",
      label: "Debts you are deducting",
      amountPaisa: input.deductionsPaisa,
      direction: "deduct",
    },
  ].filter((l) => l.amountPaisa !== 0) as ZakatLine[];

  const assetsPaisa =
    input.cashPaisa +
    input.stocksPaisa +
    input.fundsPaisa +
    input.otherAssetsPaisa +
    input.receivablesPaisa +
    input.committeesPaisa;

  const deductionsPaisa = Math.max(0, input.deductionsPaisa);

  // Never negative: owing more than you hold means nothing is due, not a
  // refund.
  const zakatablePaisa = Math.max(0, assetsPaisa - deductionsPaisa);
  const nisabPaisa = nisabFrom(input.basis, input.metalPricePerGramPaisa);

  // Nisab is a threshold, not an allowance: at or above it, the whole amount is
  // assessed, not merely the excess.
  const meetsNisab = nisabPaisa > 0 && zakatablePaisa >= nisabPaisa;

  return {
    lines,
    assetsPaisa,
    deductionsPaisa,
    zakatablePaisa,
    nisabPaisa,
    meetsNisab,
    duePaisa: meetsNisab ? Math.round(zakatablePaisa * ZAKAT_RATE) : 0,
  };
}

/**
 * Roughly when the next hawl completes.
 *
 * A lunar year is about 354.37 days. This is an estimate for a reminder, not a
 * date to worship by — the user's own lunar calendar is the authority, and the
 * UI says so.
 */
export function nextHawl(lastAssessed: string): string {
  const from = new Date(`${lastAssessed}T00:00:00Z`);
  return new Date(from.getTime() + Math.round(354.37 * 864e5)).toISOString().slice(0, 10);
}
