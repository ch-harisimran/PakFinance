import type { DailyBar, MarketDataProvider, Quote, SecurityKind } from "@/lib/market/types";

/**
 * PSX Data Portal provider (dps.psx.com.pk).
 *
 * Verified by spike, 2026-08-15:
 *   /market-watch            server-rendered HTML, 495 rows × 11 columns, ~475KB
 *   /timeseries/eod/{SYM}    JSON, ~1,239 daily bars (≈5 years), appears
 *                            corporate-action adjusted
 *
 * We identify honestly rather than spoofing a browser. Neither robots.txt
 * disallows these paths (www allows all but /cgi-bin/; dps has none).
 */

const BASE = "https://dps.psx.com.pk";

const UA =
  process.env.PSX_USER_AGENT ??
  "PakFinance/0.1 (personal finance tracker; +https://pakfinance.app)";

/** "1,042.75" → 1042.75 · "-" / "" → null */
function num(raw: string): number | null {
  const cleaned = raw.replace(/[,%\s]/g, "");
  if (!cleaned || cleaned === "-") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Classify by symbol shape, since the feed carries no instrument-type column.
 *
 * PSX names ETFs with an ETF suffix (MZNPETF, NBPGETFXD) and REITs are a short
 * known set. Anything else is treated as an equity — the conservative default,
 * because mislabelling an equity as an ETF would distort the allocation
 * breakdown, whereas the reverse is merely imprecise.
 */
const REITS = new Set(["DCR", "GRR", "IREIT", "TPLRF1"]);

export function classify(symbol: string): SecurityKind {
  if (/ETF(XD)?$/i.test(symbol)) return "ETF";
  if (REITS.has(symbol.toUpperCase())) return "REIT";
  if (/PREF$/i.test(symbol)) return "PREF";
  return "EQUITY";
}

/** Strip tags and decode the few entities PSX actually emits. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parse the market watch table.
 *
 * Columns, in order:
 *   SYMBOL SECTOR "LISTED IN" LDCP OPEN HIGH LOW CURRENT CHANGE CHANGE(%) VOLUME
 *
 * Exported separately from the fetch so it can be unit-tested against a saved
 * fixture without touching the network.
 */
export function parseMarketWatch(html: string): Quote[] {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const out: Quote[] = [];

  for (const [, inner] of rows) {
    const cells = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => text(c[1]));
    if (cells.length !== 11) continue; // header and layout rows

    const symbol = cells[0].toUpperCase();
    const current = num(cells[7]);
    if (!symbol || current === null) continue;

    out.push({
      symbol,
      sectorCode: cells[1] || null,
      indices: cells[2] ? cells[2].split(",").map((s) => s.trim()).filter(Boolean) : [],
      kind: classify(symbol),
      ldcp: num(cells[3]),
      open: num(cells[4]),
      high: num(cells[5]),
      low: num(cells[6]),
      current,
      change: num(cells[8]),
      changePct: num(cells[9]),
      volume: num(cells[10]),
    });
  }

  return out;
}

/** PSX timestamps are epoch seconds; trading dates are Asia/Karachi (UTC+5). */
function karachiDate(epochSeconds: number): string {
  return new Date((epochSeconds + 5 * 3600) * 1000).toISOString().slice(0, 10);
}

export function parseEod(json: unknown): DailyBar[] {
  const rows = (json as { data?: [number, number, number, number][] })?.data ?? [];
  return rows
    .map(([ts, close, volume, prevClose]) => ({
      date: karachiDate(ts),
      close,
      volume: volume ?? null,
      prevClose: prevClose ?? null,
    }))
    .filter((b) => Number.isFinite(b.close))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function get(path: string, accept: string): Promise<Response> {
  const res = await fetch(BASE + path, {
    headers: { "User-Agent": UA, Accept: accept },
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PSX ${path} → ${res.status}`);
  return res;
}

export const psxProvider: MarketDataProvider = {
  async getMarketWatch() {
    const res = await get("/market-watch", "text/html");
    return parseMarketWatch(await res.text());
  },

  async getDailyHistory(symbol: string) {
    const res = await get(`/timeseries/eod/${encodeURIComponent(symbol)}`, "application/json");
    return parseEod(await res.json());
  },
};
