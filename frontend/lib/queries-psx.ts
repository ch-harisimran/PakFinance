import "server-only";

import { inArray, gte, and, ilike, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { priceLatest, pricesDaily, securities } from "@/lib/db/schema/market";
import { createClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/market/holdings";

/**
 * PSX portfolio data.
 *
 * This is the one place the two halves of the database meet. User trades live
 * in `public` and are read through Supabase so RLS applies; prices live in
 * `market`, which is not exposed to PostgREST at all, so they are read with
 * Drizzle. The join happens here, in application code — deliberately, because
 * a SQL join across the two would require exposing `market` to the API.
 */

export interface TradeRow extends Trade {
  id: string;
  name: string | null;
}

export async function getTrades(): Promise<TradeRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stock_transactions")
    .select("id,symbol,type,quantity,price_paisa,commission_paisa,other_charges_paisa,traded_at")
    .order("traded_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    symbol: r.symbol as string,
    name: null,
    type: r.type as Trade["type"],
    quantity: Number(r.quantity),
    pricePaisa: Number(r.price_paisa),
    chargesPaisa: Number(r.commission_paisa ?? 0) + Number(r.other_charges_paisa ?? 0),
    tradedAt: String(r.traded_at),
  }));
}

/** Current quotes for the given symbols, in paisa. */
export async function getQuotes(symbols: string[]) {
  const out = new Map<string, { pricePaisa: number; changePct: number | null; asOf: Date }>();
  if (!symbols.length) return out;

  const rows = await db
    .select({
      symbol: priceLatest.symbol,
      price: priceLatest.price,
      changePct: priceLatest.changePct,
      asOf: priceLatest.asOf,
    })
    .from(priceLatest)
    .where(inArray(priceLatest.symbol, symbols));

  for (const r of rows) {
    out.set(r.symbol, {
      // Prices are stored in rupees; user money is stored in paisa.
      pricePaisa: Math.round(Number(r.price) * 100),
      changePct: r.changePct === null ? null : Number(r.changePct),
      asOf: r.asOf,
    });
  }
  return out;
}

/** Daily closes from `from` onward — the backfilled five years. */
export async function getDailyBars(symbols: string[], from: string) {
  const bars = new Map<string, Map<string, number>>();
  if (!symbols.length) return bars;

  const rows = await db
    .select({
      symbol: pricesDaily.symbol,
      sessionDate: pricesDaily.sessionDate,
      close: pricesDaily.close,
    })
    .from(pricesDaily)
    .where(and(inArray(pricesDaily.symbol, symbols), gte(pricesDaily.sessionDate, from)))
    .orderBy(pricesDaily.sessionDate);

  for (const r of rows) {
    let perDate = bars.get(r.symbol);
    if (!perDate) {
      perDate = new Map();
      bars.set(r.symbol, perDate);
    }
    perDate.set(String(r.sessionDate), Math.round(Number(r.close) * 100));
  }
  return bars;
}

/** Company names and sectors for the symbols a user holds. */
export async function getSecurityMeta(symbols: string[]) {
  const out = new Map<string, { name: string; sector: string | null; kind: string }>();
  if (!symbols.length) return out;

  const rows = await db
    .select({
      symbol: securities.symbol,
      name: securities.name,
      sector: securities.sector,
      kind: securities.kind,
    })
    .from(securities)
    .where(inArray(securities.symbol, symbols));

  for (const r of rows) out.set(r.symbol, { name: r.name, sector: r.sector, kind: r.kind });
  return out;
}

/** Symbol lookup for the trade form. Prefix matches first — people type tickers. */
export async function searchSecurities(query: string) {
  const q = query.trim().toUpperCase();
  if (!q) {
    return db
      .select({ symbol: securities.symbol, kind: securities.kind })
      .from(securities)
      .where(eq(securities.isActive, true))
      .orderBy(desc(securities.symbol))
      .limit(8);
  }

  return db
    .select({ symbol: securities.symbol, kind: securities.kind })
    .from(securities)
    .where(and(eq(securities.isActive, true), ilike(securities.symbol, `${q}%`)))
    .orderBy(securities.symbol)
    .limit(8);
}

/** Newest price timestamp across the portfolio, for the freshness chip. */
export async function getPriceAsOf(): Promise<Date | null> {
  const [row] = await db
    .select({ asOf: priceLatest.asOf })
    .from(priceLatest)
    .orderBy(desc(priceLatest.asOf))
    .limit(1);
  return row?.asOf ?? null;
}
