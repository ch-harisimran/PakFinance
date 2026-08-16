import "server-only";

import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { fundNavs, funds, fundAliases } from "@/lib/db/schema/market";
import { createClient } from "@/lib/supabase/server";
import type { FundOrder } from "@/lib/market/fund-holdings";

/**
 * Mutual fund data.
 *
 * Same split as PSX: orders belong to the user and come through Supabase so RLS
 * applies; the fund catalogue and NAVs live in `market` and come through
 * Drizzle. Joined in application code.
 */

export interface FundOrderRow extends FundOrder {
  id: string;
  amountPaisa: number;
}

export interface FundMeta {
  id: string;
  name: string;
  amc: string;
  category: string;
  isIslamic: boolean;
  createdBy: string | null;
}

export async function getFundOrders(): Promise<FundOrderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fund_transactions")
    .select("id,fund_id,type,units,nav_paisa,amount_paisa,traded_at")
    .order("traded_at", { ascending: false });

  return (data ?? []).map((r) => ({
    id: r.id as string,
    fundId: r.fund_id as string,
    type: r.type as FundOrder["type"],
    units: Number(r.units),
    navPaisa: Number(r.nav_paisa),
    amountPaisa: Number(r.amount_paisa),
    tradedAt: String(r.traded_at),
  }));
}

export async function getFundMeta(ids: string[]) {
  const out = new Map<string, FundMeta>();
  if (!ids.length) return out;

  const rows = await db.select().from(funds).where(inArray(funds.id, ids));
  for (const r of rows) {
    out.set(r.id, {
      id: r.id,
      name: r.name,
      amc: r.amc,
      category: r.category,
      isIslamic: r.isIslamic,
      createdBy: r.createdBy,
    });
  }
  return out;
}

/**
 * Latest official NAV per fund. Empty until the MUFAP sync exists — positions
 * fall back to the NAV recorded on the user's own orders.
 */
export async function getOfficialNavs(ids: string[]) {
  const out = new Map<string, { navPaisa: number; date: string }>();
  if (!ids.length) return out;

  const rows = await db
    .selectDistinctOn([fundNavs.fundId], {
      fundId: fundNavs.fundId,
      nav: fundNavs.nav,
      sessionDate: fundNavs.sessionDate,
    })
    .from(fundNavs)
    .where(inArray(fundNavs.fundId, ids))
    .orderBy(fundNavs.fundId, desc(fundNavs.sessionDate));

  for (const r of rows) {
    out.set(r.fundId, {
      navPaisa: Math.round(Number(r.nav) * 100),
      date: String(r.sessionDate),
    });
  }
  return out;
}

/** Catalogue lookup for the order form: seeded funds plus this user's own. */
export async function searchFunds(query: string, userId: string) {
  const q = query.trim();
  const visible = or(isNull(funds.createdBy), eq(funds.createdBy, userId));

  return db
    .select({
      id: funds.id,
      name: funds.name,
      amc: funds.amc,
      category: funds.category,
      isIslamic: funds.isIslamic,
    })
    .from(funds)
    .where(
      q
        ? and(eq(funds.isActive, true), visible, or(ilike(funds.name, `%${q}%`), ilike(funds.amc, `%${q}%`)))
        : and(eq(funds.isActive, true), visible),
    )
    .orderBy(funds.name)
    .limit(10);
}

/** Adds a fund the catalogue doesn't have. Marked with the creator. */
export async function createFund(input: {
  name: string;
  amc: string;
  category: string;
  isIslamic: boolean;
  userId: string;
}) {
  const [row] = await db
    .insert(funds)
    .values({
      name: input.name,
      amc: input.amc,
      category: input.category,
      isIslamic: input.isIslamic,
      createdBy: input.userId,
    })
    .returning({ id: funds.id });
  return row.id;
}

/**
 * Resolve a fund name to an id, aliases included.
 *
 * MUFAP publishes no stable fund code, so identity is the name. When an AMC
 * renames a fund the new name would otherwise create a second row, leaving the
 * user's units on the old one while fresh NAVs land on the new one — a position
 * that quietly stops repricing. `market.fund_aliases` maps a previous name onto
 * the fund it really is; `npm run merge:funds` records one.
 */
export async function findFundByName(name: string) {
  const [row] = await db
    .select({ id: funds.id })
    .from(funds)
    .where(sql`lower(${funds.name}) = lower(${name})`)
    .limit(1);
  if (row) return row.id;

  const [alias] = await db
    .select({ id: fundAliases.fundId })
    .from(fundAliases)
    .where(sql`lower(${fundAliases.alias}) = lower(${name})`)
    .limit(1);

  return alias?.id ?? null;
}
