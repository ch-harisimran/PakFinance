/**
 * MUFAP NAV provider.
 *
 * Source is the Performance Summary table, verified against a saved fixture:
 * 548 rows × 18 columns —
 *
 *   Sector · Category · Fund Name · Rating · Benchmark · Validity Date · NAV
 *   YTD · MTD · 1/15/30/90/180/270/365 Days · 2 Years · 3 Years
 *
 * Two things this page gives us that the schema wants:
 *   - Shariah compliance, derivable from the category prefix
 *   - a PER-FUND validity date. NAVs are not all published on the same day, so
 *     a single "as of" stamp for the whole sync would be wrong.
 *
 * What it does NOT give: an AMC column, a stable fund id, or history. Funds are
 * matched by name, and fund charts accumulate forward rather than backfilling.
 */

export interface NavRow {
  name: string;
  /** Cleaned: "Money Market", not "Money Market (Annualized Return )". */
  category: string;
  sector: string;
  isIslamic: boolean;
  rating: string | null;
  nav: number;
  /** YYYY-MM-DD, from the row's own Validity Date. */
  navDate: string;
  ytdPct: number | null;
  return365Pct: number | null;
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** "Aug 17, 2026" → "2026-08-17" */
export function parseNavDate(raw: string): string | null {
  const m = raw.trim().match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!m) return null;
  const mm = MONTHS[m[1].toLowerCase()];
  if (!mm) return null;
  return `${m[3]}-${mm}-${m[2].padStart(2, "0")}`;
}

function num(raw: string): number | null {
  const cleaned = raw.replace(/[,%\s]/g, "");
  if (!cleaned || cleaned === "-" || /^n\/?a$/i.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip the return-basis suffix MUFAP appends to every category.
 * "Shariah Compliant Income (Annualized Return )" → "Shariah Compliant Income"
 */
function cleanCategory(raw: string): string {
  return raw.replace(/\s*\((?:Annualized|Absolute)\s+Return\s*\)\s*$/i, "").trim();
}

/**
 * Best-effort AMC from the fund name — MUFAP's summary has no AMC column.
 *
 * Longest-prefix match against known houses, because a naive first-token split
 * turns "AL Habib Cash Fund" into "AL" and "Al Meezan Mutual Fund" into "Al".
 * Unmatched names fall back to the first two words, which is usually right and
 * is corrected the moment a real AMC field appears.
 */
const AMCS = [
  "Al Meezan", "AL Habib", "Al-Ameen", "ABL", "AKD", "Alfalah GHP", "Alfalah",
  "Askari", "Atlas", "AWT", "Faysal", "First Habib", "HBL", "JS", "Lakson",
  "MCB", "Meezan", "NBP", "NIT", "Pak Oman", "Pakistan", "UBL", "Nafa",
  "Golden Arrow", "HDF", "KASB", "Mahaana", "Samba", "TRUST", "Unity",
].sort((a, b) => b.length - a.length);

export function deriveAmc(fundName: string): string {
  const hit = AMCS.find((a) => fundName.toLowerCase().startsWith(a.toLowerCase()));
  if (hit) return hit;
  return fundName.split(/\s+/).slice(0, 2).join(" ");
}

/**
 * Parse the Performance Summary table.
 *
 * Exported separately from the fetch so it can be tested against a saved
 * fixture with no network access — which is how it was built.
 */
export function parseNavReport(html: string): NavRow[] {
  const out: NavRow[] = [];

  for (const [, inner] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => text(c[1]));
    if (cells.length < 18) continue; // header and layout rows

    const [sector, rawCategory, name, rating, , validity, rawNav, ytd] = cells;
    const nav = num(rawNav);
    const navDate = parseNavDate(validity);

    // A row without a name, a price or a date is not a priced fund.
    if (!name || nav === null || nav <= 0 || !navDate) continue;

    const category = cleanCategory(rawCategory);

    out.push({
      name,
      category,
      sector,
      isIslamic: /^shariah/i.test(category),
      rating: rating && rating !== "N/A" ? rating : null,
      nav,
      navDate,
      ytdPct: num(ytd),
      return365Pct: num(cells[15] ?? ""),
    });
  }

  return out;
}

const UA =
  process.env.PSX_USER_AGENT ??
  "PakFinance/0.1 (personal finance tracker; +https://pakfinance.app)";

/**
 * Fetch today's report.
 *
 * The URL is configuration, not a constant: MUFAP's report path has changed
 * before, and it should be fixable without a deploy.
 */
export async function fetchNavReport(): Promise<NavRow[]> {
  const url = process.env.MUFAP_NAV_URL;
  if (!url) throw new Error("MUFAP_NAV_URL is not set");

  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      // Ordinary content negotiation, not disguise — we still identify as
      // PakFinance. Some origins reject requests that state no preferences.
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en",
    },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });

  if (!res.ok) {
    // A bare status is not enough to act on. 403 from a Cloudflare-fronted
    // origin usually means the edge rejected us on IP reputation or UA, and the
    // ray id is what identifies the block if MUFAP is ever asked about it.
    const ray = res.headers.get("cf-ray");
    const server = res.headers.get("server");
    const body = (await res.text().catch(() => "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(
      `MUFAP → ${res.status}${server ? ` via ${server}` : ""}${ray ? ` (cf-ray ${ray})` : ""}: ${body.slice(0, 160)}`,
    );
  }

  const rows = parseNavReport(await res.text());
  if (!rows.length) throw new Error("MUFAP report parsed to zero rows");
  return rows;
}
