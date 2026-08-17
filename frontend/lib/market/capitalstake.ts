/**
 * Daily NAVs from the Capital Stake API.
 *
 * MUFAP publishes the report we seed the fund catalogue from, but its whole
 * domain sits behind a Cloudflare challenge that a plain fetch cannot pass — so
 * the report has to be saved by hand and imported with `--file`. This API serves
 * the same NAVs over HTTP with a bearer token and no challenge, which is what
 * makes a daily job possible at all.
 *
 * Deliberately NAV-ONLY. The API returns `{id, name, symbol, amc_id}` per fund
 * and `{date, fund_id, nav}` per quote — it carries no category, sector, Islamic
 * flag or rating, all of which `market.funds` requires. So MUFAP still
 * establishes WHICH funds exist; this only keeps their NAVs current. A sync that
 * invented funds from this feed would have to guess those columns.
 *
 * Endpoints (verified live: the host answers, and every path returns
 * `401/403 unauthorized_request` without a token rather than 404):
 *   GET https://csapis.com/3.0/funds       → the catalogue
 *   GET https://csapis.com/3.0/funds/nav   → unadjusted NAVs
 *
 * Unadjusted, not adjusted: we value units a user holds, and that is what their
 * statement says. The dividend-adjusted series is for comparing performance and
 * would overstate a holding that has already paid out.
 */

const BASE = "https://csapis.com/3.0";

export interface CsFund {
  id: string;
  name: string;
  symbol: string;
  amc_id: string;
}

export interface CsNav {
  date: string;
  fund_id: string;
  nav: number;
}

interface Envelope<T> {
  status: string;
  message: string;
  data: T;
}

export class CapitalStakeNotConfigured extends Error {
  constructor() {
    super("CAPITALSTAKE_TOKEN is not set — the NAV API needs a bearer token.");
    this.name = "CapitalStakeNotConfigured";
  }
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = process.env.CAPITALSTAKE_TOKEN;
  if (!token) throw new CapitalStakeNotConfigured();

  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });

  const body = await res.text();

  if (!res.ok) {
    // The token is a secret and the URL carries no user data, so the path and
    // status are safe to report; the body is the provider's own error text.
    throw new Error(`Capital Stake ${path} → ${res.status}: ${body.slice(0, 200)}`);
  }

  let parsed: Envelope<T>;
  try {
    parsed = JSON.parse(body) as Envelope<T>;
  } catch {
    throw new Error(`Capital Stake ${path} returned non-JSON: ${body.slice(0, 200)}`);
  }

  if (parsed.status !== "ok") {
    throw new Error(`Capital Stake ${path} → ${parsed.status}: ${parsed.message || "(no message)"}`);
  }
  if (!Array.isArray(parsed.data)) {
    throw new Error(`Capital Stake ${path} returned no data array`);
  }
  return parsed.data;
}

export const fetchCsFunds = () => get<CsFund[]>("/funds");

/**
 * NAVs for a date range.
 *
 * The published docs mark `fund_id` as required in the parameter table but then
 * say "at least one parameter must be provided (`fund_id` or both `date_from`
 * and `date_to`)". Those cannot both be true, and which one holds decides
 * whether a daily sync costs one request or five hundred. So this asks for the
 * whole market first and the caller falls back to per-fund requests if the API
 * rejects it — settling the contradiction against the live service rather than
 * guessing from the documentation.
 */
export const fetchCsNavs = (dateFrom: string, dateTo: string, fundId?: string) =>
  get<CsNav[]>("/funds/nav", {
    date_from: dateFrom,
    date_to: dateTo,
    ...(fundId ? { fund_id: fundId } : {}),
  });

/* ── Matching, kept pure so it can be tested without a token ─────────────── */

/** The subset of a `market.funds` row that matching needs. */
export interface LocalFund {
  id: string;
  name: string;
}

export interface NavWrite {
  fundId: string;
  nav: number;
  sessionDate: string;
}

export interface MatchReport {
  writes: NavWrite[];
  /** Provider names matching more than one local fund — never written. */
  ambiguous: string[];
  /** Provider names we hold no fund for. Expected: they list more than we seed. */
  unmatchedProvider: number;
  /** Local funds the provider never mentioned, so they get no automatic NAV. */
  unmatchedLocal: string[];
}

const key = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Decide which NAVs may safely be written.
 *
 * Matching is by name, because `market.funds` stores no provider id. Eight names
 * in the catalogue are shared by several rows — pension funds with equity, debt
 * and money-market sub-plans under one name, which is exactly why `upsertNavs`
 * keys on `name|category` rather than name alone. For those, this writes
 * NOTHING and reports them: putting an equity sub-plan's NAV on the
 * money-market one would silently misvalue somebody's holding, and a missing
 * NAV is a visibly stale number where a wrong one is invisible.
 *
 * Storing the provider's `symbol` against each fund would remove the ambiguity
 * permanently. That needs a migration and real responses to verify against, so
 * it waits until the token exists.
 */
export function planNavWrites(
  providerFunds: CsFund[],
  navs: CsNav[],
  localFunds: LocalFund[],
): MatchReport {
  const localByName = new Map<string, LocalFund[]>();
  for (const f of localFunds) {
    const k = key(f.name);
    const list = localByName.get(k);
    if (list) list.push(f);
    else localByName.set(k, [f]);
  }

  const providerById = new Map(providerFunds.map((f) => [f.id, f]));

  const writes: NavWrite[] = [];
  const ambiguous = new Set<string>();
  const matchedLocal = new Set<string>();
  const seenProviderIds = new Set<string>();
  let unmatchedProvider = 0;

  for (const quote of navs) {
    const provider = providerById.get(quote.fund_id);
    if (!provider) continue; // a NAV for a fund absent from the catalogue

    const candidates = localByName.get(key(provider.name));
    if (!candidates) {
      if (!seenProviderIds.has(quote.fund_id)) {
        seenProviderIds.add(quote.fund_id);
        unmatchedProvider++;
      }
      continue;
    }
    if (candidates.length > 1) {
      ambiguous.add(provider.name);
      continue;
    }
    if (!Number.isFinite(quote.nav) || quote.nav <= 0) continue;

    writes.push({ fundId: candidates[0].id, nav: quote.nav, sessionDate: quote.date });
    matchedLocal.add(candidates[0].id);
  }

  return {
    writes,
    ambiguous: [...ambiguous].sort(),
    unmatchedProvider,
    unmatchedLocal: localFunds
      .filter((f) => !matchedLocal.has(f.id))
      .map((f) => f.name)
      .sort(),
  };
}
