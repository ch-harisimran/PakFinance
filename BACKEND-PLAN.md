# PakFinance — Backend Plan

Decided architecture, schema, and job design. Companion to `PLAN.md` (product) and
`frontend/design/DESIGN-SYSTEM.md` (visual).

---

## 1. Architecture

**Next.js route handlers + Postgres on Supabase + an external cron trigger.**

```
                    ┌─────────────── WRITE PATH (background) ───────────────┐
  external cron ──► /api/cron/sync-psx ──► PSX data portal ──► market.prices
  (every 30 min)    /api/cron/sync-nav ──► MUFAP           ──► market.fund_navs
                    /api/cron/snapshot  ──────────────────────► app.net_worth_daily

                    ┌─────────────── READ PATH (user-facing) ──────────────┐
  browser ──► Next server component ──► Postgres ──► HTML
```

The browser never contacts PSX or MUFAP. It reads rows our jobs already wrote.
Nothing in the request path is slower because a sync is running — Postgres MVCC
means readers are never blocked by writers.

**Why not a separate service:** one deployment, one language, types shared with
the UI, no service-to-service auth to build. The `MarketDataProvider` interface
keeps this reversible — if the sync outgrows a route handler's execution limit,
that one module lifts into a worker and nothing else changes.

**Scheduling.** Vercel Hobby cron fires only once per day, which cannot express
this schedule. Use one of:

- **Supabase `pg_cron`** — scheduler lives beside the data, no extra service
- **GitHub Actions** — a workflow that `curl`s the endpoint
- **Cloudflare Workers cron triggers** — free tier, 3 triggers

All call the route with `Authorization: Bearer $CRON_SECRET`. The route rejects
anything else, so the endpoint is not publicly triggerable.

---

## 2. Schema layout

Two schemas, and the split is load-bearing.

| Schema | Contents | Exposed via PostgREST |
|---|---|---|
| `public` | user-owned rows | **yes**, protected by RLS |
| `market` | securities, prices, NAVs, sessions | **no** |

Market data stays out of `public` for two reasons. The `anon` key ships to every
browser, so a `public` table without RLS is readable by the internet — and our
price history is exactly the thing we must not redistribute while unlicensed.
Server-side reads only. It is also faster: no PostgREST hop.

### 2.1 `market` — reference and price data

```sql
market.securities
  symbol            text primary key        -- OGDC, MEBL, NIT-PGETF
  name              text not null
  kind              security_kind not null  -- EQUITY|ETF|REIT|PREF|DEBT
  sector            text
  board             text                    -- Main, GEM, Debt
  is_active         boolean not null default true
  first_seen_at     timestamptz not null
  last_seen_at      timestamptz not null

market.price_latest                          -- one row per symbol, overwritten
  symbol            text primary key references market.securities
  price             numeric(14,4) not null
  ldcp              numeric(14,4)            -- last day close
  day_high          numeric(14,4)
  day_low           numeric(14,4)
  volume            bigint
  change_pct        numeric(8,4)
  as_of             timestamptz not null

market.prices                                -- intraday snapshots, pruned
  symbol            text not null
  price             numeric(14,4) not null
  volume            bigint
  as_of             timestamptz not null
  primary key (symbol, as_of)

market.prices_daily                          -- one row per trading day, FOREVER
  symbol            text not null
  session_date      date not null
  open, high, low, close  numeric(14,4)
  volume            bigint
  primary key (symbol, session_date)

market.funds
  id                uuid primary key
  name, amc, category  text
  is_islamic        boolean not null default false
  mufap_code        text unique

market.fund_navs
  fund_id           uuid references market.funds
  nav               numeric(14,4) not null
  session_date      date not null
  primary key (fund_id, session_date)

market.corporate_actions
  id                uuid primary key
  symbol            text references market.securities
  kind              action_kind not null     -- BONUS|SPLIT|RIGHT|DIVIDEND
  ex_date           date not null
  ratio_from        numeric(10,4)
  ratio_to          numeric(10,4)
  amount            numeric(14,4)
```

**Why `price_latest` is separate from `prices`.** The dashboard reads ~600 rows
by primary key. Without this table every page load would scan a history table
that grows forever. This one decision is the difference between a 2ms and a
200ms dashboard.

**Why `prices_daily` exists.** `prices` is pruned after 90 days; `prices_daily`
is never pruned. It is what makes a three-year chart possible in three years'
time. ~600 symbols × ~250 trading days = ~150k rows/year — trivial for Postgres.

**Why `corporate_actions` cannot wait.** When a company issues a 100% bonus the
raw price halves overnight. Unadjusted, the chart shows a crash that never
happened and every return figure is wrong. Retrofitting this means reprocessing
years of rows, so it ships with v1 even if adjustment is applied lazily at read
time.

### 2.2 `market` — session calendar

```sql
market.sessions                              -- normal weekly pattern
  weekday           smallint not null        -- 1=Mon … 5=Fri
  opens_at          time not null
  closes_at         time not null
  seq               smallint not null        -- Friday has two sessions
  primary key (weekday, seq)

market.market_holidays
  holiday_date      date primary key
  reason            text
```

Seeded from the stated hours (PKT, UTC+5, no DST):

| Day | Session 1 | Session 2 |
|---|---|---|
| Mon–Thu | 09:30 – 15:30 | — |
| Fri | 09:30 – 12:00 | 14:30 – 16:30 |

These live in a **table, not in code**, because PSX shortens trading hours during
Ramadan every year and closes on Eid, Ashura and Independence Day. A hardcoded
schedule is wrong for roughly a month a year and silently wrong on holidays.

### 2.3 `public` — user data

```sql
public.profiles           user_id pk → auth.users, name, phone, timezone,
                          currency, notation, theme, created_at
public.otp_codes          user_id, code_hash, purpose, expires_at, attempts,
                          consumed_at
public.accounts           id, user_id, name, kind, balance_paisa, as_of
public.transactions       id, user_id, account_id, label, meta,
                          amount_paisa, occurred_at
public.stock_transactions id, user_id, symbol, type, quantity, price_paisa,
                          commission_paisa, other_charges_paisa, traded_at
public.fund_transactions  id, user_id, fund_id, type, units, nav_paisa,
                          amount_paisa, traded_at
public.loans              id, user_id, name, lender, kind, principal_paisa,
                          markup_rate, tenure_months, start_date,
                          installment_paisa
public.loan_payments      id, loan_id, amount_paisa, principal_paisa,
                          markup_paisa, late_fee_paisa, paid_at
public.goals              id, user_id, name, target_paisa, target_date,
                          category, status
public.goal_contributions id, goal_id, amount_paisa, occurred_at
public.net_worth_daily    user_id, session_date, assets_paisa,
                          liabilities_paisa, primary key (user_id, session_date)
public.sync_runs          id, job, started_at, finished_at, status,
                          rows_written, error
```

**All money is `bigint` paisa.** `PKR 1,234.56` is stored as `123456`. Never a
float — see `frontend/lib/money.ts`, which already formats from integers.

**Every user table carries `user_id` with an index.** RLS policies filter on it;
without the index each query is a sequential scan.

---

## 3. Row Level Security

Enabled in the **same migration** as the table, so a table never exists
unprotected. RLS on with no policy means deny-all, which is the correct
direction to fail.

```sql
ALTER TABLE public.stock_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own" ON public.stock_transactions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "insert own" ON public.stock_transactions
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "update own" ON public.stock_transactions
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "delete own" ON public.stock_transactions
  FOR DELETE USING ((SELECT auth.uid()) = user_id);
```

`(SELECT auth.uid())` rather than bare `auth.uid()` — wrapped in a subquery
Postgres evaluates it once per query instead of once per row.

The sync jobs use the **service role key**, which bypasses RLS. That key is
server-only and must never carry a `NEXT_PUBLIC_` prefix.

**Acceptance test:** an automated check that signs in as user A and attempts to
read user B's rows, asserting zero results. Ships with the first migration.

---

## 4. The PSX sync job

`POST /api/cron/sync-psx` — triggered every 30 minutes; the handler decides
whether to act.

```
1  reject unless Authorization matches CRON_SECRET
2  now := current time in Asia/Karachi
3  if today is in market_holidays        → exit "holiday"
4  session := active session for now     → if none, exit "closed"
5  isClose := now within 5 min of session close
6  last := most recent successful sync_run
7  if !isClose && last is younger than PSX_MIN_SYNC_INTERVAL_MINUTES
                                          → exit "too soon"
8  fetch market watch (ONE request returns the whole market)
9  parse → upsert market.securities, market.price_latest, market.prices
10 if isClose → upsert market.prices_daily for session_date
11 write sync_runs row
```

**Step 5 is not optional.** With a strict 3-hour minimum, Friday's 16:30 close
falls only 2 hours after the 14:30 fetch and would be skipped — so Friday's
closing prices would never be recorded and the weekend portfolio would show
Friday-lunchtime values. `prices_daily` is the table that lives forever, and a
missed close can never be backfilled without a licensed historical feed.

Resulting cadence at 180 minutes: **3 syncs Mon–Thu, 3 on Friday** (two interval
syncs plus the forced close).

**One request covers the market.** PSX's market watch returns every actively
traded symbol at once, so the universe is discovered rather than curated — new
listings appear automatically. Classify what comes back into `kind`:

- include: EQUITY, ETF, REIT, PREF, DEBT (Main, GEM and Debt boards)
- exclude: futures and index derivatives — expiries and rollovers make them a
  different data model
- **not on PSX at all:** open-end mutual funds. Those are bought and redeemed
  from the AMC at NAV and come from MUFAP.

**Delisting.** Symbols absent from the feed get `is_active = false`. They are
**never deleted** — a user may hold one, and deleting the row would destroy
their transaction history and corrupt every past net-worth figure.

### 4.1 Being a good citizen while unlicensed

The 3-hour interval reduces the chance of being rate-limited or IP-blocked. It
does **not** change the licensing position — unlicensed redistribution is
unlicensed at any frequency. What actually limits exposure:

- serve **portfolio valuations to the authenticated owner**, not public price
  tables (the landing page ticker is the most exposed surface in the product)
- keep `market.*` out of the PostgREST-exposed schema
- honest `User-Agent`, no browser spoofing
- attribute the source
- swap in a licensed feed via `MarketDataProvider` before monetising

---

## 5. The MUFAP NAV job

`POST /api/cron/sync-nav` — once daily, ~19:00 PKT.

NAVs are published once per day after the close. Every fund value in the UI
carries the date it was priced; the freshness chips already render this. Any
implication of live fund pricing would be a claim the product cannot keep.

---

## 6. Daily snapshot job

`POST /api/cron/snapshot` — once daily, after the close.

Writes one `net_worth_daily` row per user from that day's `prices_daily`, fund
NAVs, account balances and loan balances. This is what the dashboard's net-worth
chart reads — it is never recomputed from transactions at request time.

---

## 7. Retention

| Table | Retention | Why |
|---|---|---|
| `market.prices` | 90 days | intraday detail stops mattering quickly |
| `market.prices_daily` | forever | the long-horizon chart |
| `market.fund_navs` | forever | small, and the fund chart needs it |
| `public.net_worth_daily` | forever | one row per user per day |
| `public.sync_runs` | 180 days | operational log |

Pruning runs weekly in the same cron family.

---

## 8. Freshness in the UI

The dashboard already renders a per-source freshness chip. Wire them to real
timestamps:

| Source | Chip |
|---|---|
| PSX | `As of 12:30 PKT` — read from `price_latest.as_of` |
| MUFAP | `NAV as of 14 Aug` |
| Manual | `You · 12 Aug` |

**`Delayed 15m` must be removed.** At a 3-hour cadence it is false, and the
per-source design exists precisely so the UI can tell the truth about age.

---

## 9. Build order

1. Supabase project (Mumbai `ap-south-1` — lowest latency to Pakistan)
2. Drizzle wiring + first migration: `market` schema, sessions, holidays
3. `MarketDataProvider` interface + `PsxDpsProvider` + parser tests
4. `/api/cron/sync-psx` with the session/interval guard
5. External cron trigger + `CRON_SECRET`
6. `public` schema + RLS + the cross-user access test
7. Supabase Auth: signup → OTP → session; replace the auth screens' stubs
8. Swap dashboard fixtures for real queries, screen by screen
9. MUFAP job, snapshot job, pruning
10. Corporate-action adjustment at read time

Steps 1–5 make market data real without touching the UI. Step 8 is where the
fixtures in `frontend/lib/dashboard-data.ts` retire.
