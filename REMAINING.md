# PakFinance — what's left

## Deferred items 24–27 — DONE (16 Aug 2026)

**25 — Rate limiting.** `lib/rate-limit.ts`, counters in Postgres (migration
`0011`). Applied to sign-in, sign-up, OTP verify, OTP resend, password reset,
recovery verify and password change — each limited by email AND by caller IP,
because per-identity alone lets one host walk a list of accounts and per-IP alone
lets a botnet hammer one. The whole window moves in ONE statement: read-then-write
would let parallel requests all read the same count, which is the race an attacker
generates for free. Fails OPEN on database error — this guards a login form, not a
vault door, and locking everyone out over a counter table is a worse outage.
Verified with `npm run verify:ratelimit`: 7/7, including a concurrent burst where
6 of 11 parallel attempts got through against a limit of 6.

**24 — Proving schedules fire.** A green manual run proves the code; only a cron
run proves the cron. `sync_runs.trigger` (migration `0012`) now records
`schedule` / `workflow_dispatch` / `api` / `local` from `GITHUB_EVENT_NAME`, and
`npm run schedule:report` separates the two. Currently reports all jobs as NOT
PROVEN — correct, the column is new and no cron has fired since.

**27 — Restore path.** `docs/RUNBOOK.md`: what is irreplaceable and what is not,
`pg_dump` as the real backup, `npm run backup` as the no-dependency fallback,
verification, four restore scenarios, and a rehearsal procedure. The backup is
real — 427,516 rows, 45 MB, and `--verify` passes. It does NOT include
`auth.users`; the runbook says so twice, because restoring only that leaves every
record intact and nobody able to log in.

**26b — Dashboard accessibility, without a session.** `app/dev/audit/page.tsx`
renders the dashboard's components against fixture props on a route outside
`/dashboard`, so contrast and tap targets can be measured without logging in —
both depend on CSS and markup, not on data. It calls `notFound()` in production;
verified against the real build, where the route prerenders as a 404 rather than
the harness. Delete it if you would rather not carry it.

It immediately found two more tap-target defects the public pages could not
surface: the "Needs you" action links (20px) and the search input, which sat at
21px inside a 36px box so the padding around it was dead space. Both fixed; now
0 contrast failures and 0 undersized targets at 387px and 600px.

**26 — Accessibility and responsive.** Audited the public pages with proper
alpha compositing and per-scene ground detection. Two real defects found and
fixed:
- `--text-faint` was #65625C — **2.65:1**, below AA, and used for exactly the
  11.5px captions that most need contrast. Lightened to #8E8B83; /login now
  reports zero contrast failures.
- Nav and footer links were 19px tall against WCAG 2.5.8's 24px minimum. Now 0
  targets under 24px, no horizontal overflow at narrow widths.

Three findings were artefacts of my own audit and are recorded so nobody chases
them: hidden `$ACTION_*` inputs "missing labels", `rgba(255,255,255,0.035)` read
as solid white, and paper-ground sections measuring 1.06:1 because the
scroll-driven ground cross-fade never runs in a non-compositing tab.


## Security review + dead-code sweep — DONE (16 Aug 2026)

**Two new checks, both runnable on demand:**
- `npm run audit:security` — schema-wide. Every table in `public` must have RLS
  enabled AND forced AND policies; every policy must reference `auth.uid()`;
  `market` must not be reachable by `anon` or `authenticated`. Catches the
  *next* mistake (a table added without policies), not just the last one.
  Result: 17 tables, 64 policies, no problems.
- `npm run test:rls` — behavioural, with two real throwaway users. Now covers all
  17 tables for read, forged insert, and signed-out access. 63/63.

**Hardened:**
- `getNetWorthSeries(userId)` → `getNetWorthSeries()`. It reads through Drizzle,
  which bypasses RLS, so a `userId` parameter meant the database could not catch
  a caller's mistake. Both callers were passing verified ids, but the signature
  made an IDOR one careless line away. Same for `revokeSessionFor` →
  `revokeSession`.
- Client bundle scanned for every value in `.env.local`: only the two
  `NEXT_PUBLIC_` ones appear. Service-role key, DB URLs, CRON_SECRET and the
  Brevo key are all absent.
- All 37 dashboard actions establish identity via `withUser()`; all four cron
  routes require `CRON_SECRET`; `/api/export` requires a session.

**Dead code:** 13 unreferenced exports → 3, and those three are Drizzle table
definitions that must stay (drizzle-kit diffs migrations against this file;
deleting them would generate a DROP). Removed `lib/db/index.ts` (nothing imported
it, and its `server-only` guard is already present in every query module) and
`sessionsFor`. `PIN_LENGTH` is now actually used by `PinPad` instead of a
duplicated `6`.

**Filled the last gap:** budgets and recurring entries had actions, forms, logic
and a job but no screen — now on the Transactions page, where the ledger they
describe lives.


## Batch 5 of the full audit — DONE (16 Aug 2026)
Migration `0010` adds assets, budgets, recurring rules, committees and Zakat
assessments, all with RLS.

- **Other assets** (`/dashboard/assets`). Gold, silver, property, vehicle,
  crypto, foreign currency. User-maintained values with an `as_of` date, since
  there is no gold or property price feed — the screen flags anything not
  revalued in six months, because a stale gold price is a wrong net worth that
  degrades quietly.
- **Zakat** (`/dashboard/zakat`). Gathers cash, shares, funds, marked assets,
  receivables and committee contributions; deducts debts; applies 2.5% above
  nisab. Every contested judgement is a switch, never an assumption: gold vs
  silver nisab, whether long-held shares count, which debts are deductible. The
  metal price is an input, not a guess — it is the threshold that decides whether
  anything is owed at all. The disclaimer is at the top, not the bottom.
- **Committees / BC** (`/dashboard/committees`). A rotating pool is saving before
  your turn and a debt after it, so the position lands on the correct side of the
  balance sheet rather than being filed under "savings" and wrong half the time.
- **Recurring transactions.** `lib/recurring.ts` plus a poster in the maintenance
  job. Catches up every missed period rather than only the latest, and cannot
  post a period twice: the window starts the day after `last_posted_on`, entries
  and the watermark move in one transaction, and a concurrent run finds a
  watermark that has already moved.
- **Budgets.** Limits per category; spend derived from the ledger so the two can
  never disagree.
- **Net worth now includes** other assets and committee balances, with the
  allocation split showing "Gold & other" and "Committees".
- 58 new tests (154 total), covering the Zakat threshold behaviour especially —
  nisab is a threshold, not an allowance, which is the easiest thing here to get
  quietly wrong.

## Batch 4 of the full audit — DONE (16 Aug 2026)
- **Corporate actions applied.** `buildHoldings` and `portfolioSeries` now take
  actions and replay them on one timeline with the trades. Split, symbol change
  and merger only — BONUS and RIGHT stay user-entered, because applying both
  would double the shares. Seed with `npm run seed:actions -- --file x.csv`;
  `--list` shows what is recorded and which kinds are applied.
- **Splits, mergers, symbol changes.** A split scales quantity and leaves book
  cost alone. A symbol change moves the whole position, realised gains and
  dividends included, and drops the dead ticker. A merger does both at a ratio.
  22 new tests, including "shares bought after the ex-date are not re-adjusted".
  Wired into the PSX screen, the dashboard and — importantly — the snapshot job,
  where a wrong number is written down permanently.
- **PSX coverage answered with evidence.** `npm run reconcile:psx` compares our
  universe against the live feed: 495 symbols, 0 missing, 0 orphaned, 482 equity
  / 9 ETF / 4 REIT. No debt instruments appear in the market watch at all, which
  settles the original question.
- **Fund identity.** `market.fund_aliases` maps a previous name onto the fund it
  really is, checked by `findFundByName` before anything is created, so a rename
  no longer splits a position. `npm run merge:funds` moves orders and NAV history
  in one transaction and records the alias; dry by default.
- **Rename detection deliberately gated.** Name similarity does not work here —
  numbered plans ("Plan XXVII/XXVIII") and bracketed sub-plans swamp it. The
  data signal (one fund's NAVs stopping where another's begin) is right but needs
  continuous history; on two fixture imports it produced 50 confident false
  positives. It now refuses to guess until the median fund has 10+ days of NAV
  history. Manual merge works today.

## Batch 3 of the full audit — DONE (16 Aug 2026)
- **Dashboard drill-through.** Holdings, funds, goals, transactions and expense
  categories are links into the owning screen, pre-filtered with `?q=` — which
  only works because batch 1 made search real. The dashboard stays read-only;
  it is now a way in rather than a dead end. Row menus keep their own hit area,
  since a button inside an anchor is invalid markup.
- **Change email.** `requestEmailChange` re-checks the password first (whoever
  controls the address can reset the password), then starts Supabase's
  double-confirmation flow. `/auth/confirm` verifies the token and reports back;
  its `next` parameter is restricted to in-app paths so it cannot be turned into
  an open redirect carrying a fresh session.
- **Real session list.** `auth.sessions` carries `user_agent` and `ip`; it is not
  exposed through PostgREST, so `lib/queries-sessions.ts` reads it with Drizzle
  scoped to the verified user id. Devices can be signed out individually —
  deleting the row stops the refresh token renewing. The current session has no
  revoke button, because that spelling of "log out" already exists below.

## Batch 2 of the full audit — DONE (16 Aug 2026)
- **Test runner.** Vitest, `npm test`. 96 unit tests over `holdings`,
  `fund-holdings`, `money`, `alerts`, `due-dates` and `search` — all pure, no
  database, 1.2s. `scripts/verify-due-dates.ts` folded in and deleted.
- **Bug the tests found.** `daysUntil` compared a midnight due date against the
  current time, so from 00:01 on the due day the date rolled forward a month and
  the installment alert vanished from the bell — on the day it mattered most.
  Fixed and pinned by a regression test at three different hours.
- **RLS cross-user test.** `npm run test:rls` creates two throwaway users, tries
  every read/update/delete/forge across them over nine tables plus anonymous
  access and the `market` schema, then deletes both. 20/20 pass.
- **Retention.** `lib/market/prune.ts` trims intraday prices and sync runs past
  90 days, chunked so it cannot lock out a running sync. `prices_daily`,
  `net_worth_daily` and `loan_reminders_sent` are explicitly never pruned.
- **Job failure alerting.** `lib/notify/watchdog.ts` reports errors AND silence —
  a job that has not succeeded inside its expected window, which is the failure
  that leaves no log. Emails once a day at most to `ALERT_EMAIL`. Already found
  three real problems on its first run.
- Both run from `.github/workflows/maintenance.yml` at 04:30 UTC.

## Batch 1 of the full audit — DONE (16 Aug 2026)
- **Drizzle fan-out cliff.** `/dashboard` now awaits its three waves in turn, so
  peak concurrency is 3 against a pool of 5 instead of sitting exactly on the
  limit. Comment added at the inner wave in `queries-networth.ts` too.
- **Error, loading and not-found boundaries.** `app/error.tsx`,
  `app/dashboard/error.tsx`, `app/dashboard/loading.tsx`, `app/not-found.tsx`.
- **Search works.** `?q=` in the URL, debounced, filtered server-side on all six
  screens. Totals deliberately keep describing everything, not the filtered view.
- **Sector names.** `market.sectors` lookup + `getSecurityMeta().sectorName`,
  falling back to "Sector 0813" until seeded. `npm run seed:sectors -- --codes`
  lists what needs naming; `-- --file x.csv` seeds it. Nothing is guessed.
- **Index membership.** `securities.indices text[]` with a GIN index, backfilled
  from the packed `board` column, which is now deprecated but still written.
- **Number notation applies everywhere.** Threaded as an explicit prop through
  every compact formatter — server and client components alike.
- **Legal pages.** `/privacy` and `/terms` written against what the code actually
  does. Footer links all resolve; landing sections gained `#psx`, `#funds`,
  `#goals` anchors.


Status as of the end of the current session. Grouped by what blocks what, not by
size.

---

## 1. Blocking — the app is not coherent until these are done

### 1.1 Dashboard overview is still fixtures
`app/dashboard/page.tsx` and everything it renders reads `lib/dashboard-data.ts`:

| Component | Fixture it uses |
|---|---|
| `NetWorthHero` | `NET_WORTH`, `NET_WORTH_SERIES` |
| `BalanceSheet` | `ALLOCATION`, `TOTAL_ASSETS`, `TOTAL_LIABILITIES`, `LIABILITIES` |
| `Attention` | `ATTENTION` |
| `Panels` (holdings, funds, cash flow, expenses, transactions, goals) | all of it |
| page | `MARKET_OPEN` |

This is the first screen after login and **every number on it is invented**.
Everything it needs now exists — accounts, transactions, loans, goals, PSX
holdings — so this is assembly, not new capability.

### 1.2 Mutual Funds screen is entirely fixtures
No MUFAP provider, no sync, no data. `market.funds` and `market.fund_navs` are
empty. Blocked on a saved copy of the MUFAP NAV page — their robots.txt
disallows ClaudeBot, so the fetch has to come from you.

### 1.3 Settings saves nothing — DONE
Profile name and phone save to `profiles`; the password change verifies the
current password before setting the new one; number notation persists. The photo
uploads to a Supabase Storage bucket (migration `0006_avatars_bucket.sql`) under
`avatars/<user id>/`, and old files are swept on replace. Export as CSV or JSON
works via `/api/export`.

Three controls were removed rather than wired, because nothing behind them
existed and a control that lies is worse than an absent one:

- **Two-factor switch.** Toggled nothing. What protects the account — a verified
  email at sign-up and the PIN lock — is now stated instead.
- **Theme switcher.** `design/tokens.css` has one palette, so Light and System
  changed nothing. See §4.7.
- **Notification switches.** No email or push delivery exists. Alerts now appear
  in the bell, which is real; the copy says so.

Still local: the notation preference is stored but only applied to the sample on
the settings screen. Applying it across every screen is §3.x below.

### 1.4 Records can be created but not edited or deleted — DONE
Every record type now has a row menu (`components/dashboard/RowActions.tsx`)
with Edit and a confirmed Delete: accounts, transactions, loans, loan payments,
goals, contributions, PSX trades and fund orders.

Each type defines its fields once, as a `*Fields` component that both the Add
dialog and the Edit dialog render, so the two cannot drift apart.

Two deliberate limits: the fund on an existing order cannot be changed (moving
units between funds would corrupt both positions' cost basis — delete and
re-enter), and the dashboard overview stays read-only, since it is a read
surface and the records are owned by their own screens.

---

## 2. Data layer gaps

### 2.1 Net worth snapshot job — DONE
`lib/market/snapshot.ts` computes every user's assets and liabilities and
upserts `public.net_worth_daily`. Reachable as `scripts/snapshot.ts`,
`/api/cron/snapshot`, and `.github/workflows/snapshot.yml` (13:30 UTC daily,
with a 14:30 retry that no-ops if the first run succeeded).

The chart still has exactly one point, and will only ever have one point per day
from here — the series cannot be backfilled, because bank balances and NAVs are
not recoverable after the fact. The workflow going live is what starts the
clock, so §2.2 gates the value of this one.

### 2.4 Loan repayment reminders — DONE
A loan can be repaid monthly (`due_day`) or in one go (`due_date`, new), and
either can carry a reminder with 0/1/3/7 days of notice. `lib/notify/reminders.ts`
runs daily at 03:30 UTC (08:30 PKT) via `.github/workflows/reminders.yml` and
emails through Brevo's HTTP API.

Sending is idempotent: `loan_reminders_sent` is keyed on (loan, repayment date,
channel) with a unique index, so a retried workflow, an overlapping cron and a
manual run collapse to one email. The row is written *after* a successful send —
failing toward a possible duplicate tomorrow rather than a silent miss. Only the
job writes that table; clients get SELECT and nothing else, so nobody can forge
an "already sent" row to silence their own reminders.

The date arithmetic is pure and covered by `scripts/verify-due-dates.ts`
(26 checks, including a loan due on the 31st landing on 28/29 February).

### 2.2 GitHub Actions not live
`.github/workflows/sync-psx.yml` is written and correct, but:
- the repo has not been pushed
- `DATABASE_URL` / `DATABASE_POOL_URL` are not set as repository secrets

Until then prices only update when the sync is run by hand.

### 2.3 Sector codes have no names
PSX gives `0825`, `0808` — 38 codes, no mapping in the feed. The PSX screen
currently prints "Sector 0825". Needs a lookup table sourced separately.

### 2.4 Index membership is in the wrong column
`KSE100`, `KMI30`, `KMIALLSHR` are being written into `securities.board`, which
was meant for Main/GEM/Debt. Useful data — free KSE-100 membership and a
Shariah filter — sitting in the wrong place. Small migration.

### 2.5 Holiday calendar is incomplete
Only fixed-date 2026 holidays are seeded. Eid al-Fitr, Eid al-Adha, Ashura and
Eid Milad un-Nabi move each year and are announced by PSX. On an unrecorded
holiday the sync wastes a fetch and logs a misleading run.

### 2.6 Retention/pruning not implemented
`market.prices` is meant to be pruned at 90 days and `sync_runs` at 180. Nothing
prunes. Not urgent — it is the smallest table — but it grows forever.

### 2.7 Corporate actions table is empty
Evidence says the EOD feed is already adjusted, so this is a safety net rather
than a gap. No adjustment logic is applied at read time.

---

## 3. Feature gaps

- **Search boxes are inert.** Every screen has one; none filter anything.
- **Theme switching does nothing.** Only dark exists. `tokens.css` has a paper
  ground for the landing page, but there is no light theme for the app.
- **Lakh/crore is not global.** `lib/money.ts` implements it and Settings
  previews it, but no screen reads the preference.
- **"Keep me signed in" is not wired to the PIN.** The checkbox exists; the PIN
  is set from Settings instead. Should prompt on first login.
- **Reports screen** was dropped from the sidebar rather than shipped as a stub.
  Natural home for CGT estimates, dividend income, year-on-year.
- **Landing page 3D** — scenes A (hero ecosystem) and B (security shield) were
  scoped as WebGL and built as DOM/SVG instead. Deliberate, and the page works;
  listed so it isn't forgotten.

---

## 4. Production readiness

### 4.1 Not deployed
No Vercel project yet. Everything runs on localhost.

### 4.2 Email deliverability will fail for real users
Sending as `pakfinance.app@gmail.com` through Brevo's shared IP fails DMARC
alignment — Brevo warns about this directly. Fine for testing to your own inbox;
for real users the OTP lands in spam or is rejected under Google/Yahoo sender
rules. **Needs a domain.** This is the single hardest blocker between "works for
me" and "works for anyone".

### 4.3 No tests
Nothing is tested. The highest-value targets, in order:
1. `lib/market/holdings.ts` — cost basis, bonus handling, portfolio replay
2. `lib/money.ts` — paisa conversion and rounding
3. `lib/market/sessions.ts` — session/holiday/post-close logic
4. An RLS test proving user A cannot read user B's rows

The first two are pure functions; both were verified by hand once and have no
regression guard.

### 4.4 Never tested on a real device
No phone testing. No Lighthouse run. No accessibility pass. The landing page has
heavy scroll choreography that has only ever run on one desktop browser.

### 4.5 The dashboard is one query away from hanging
Drizzle's postgres-js driver never resumes queries it queues beyond the client's
`max` (5) — they hang silently, forever. `app/dashboard/page.tsx` currently runs
exactly 5 concurrent Drizzle reads. It works, but there is no headroom: adding
one more concurrent read to that page hangs it with no error. Documented at
length in `lib/db/client.ts`. Worth either sequencing that fan-out or checking
whether a newer drizzle-orm than 0.45.2 fixes the queueing.

### 4.6 Decided against, or still worth building
- **Light theme — decided against.** Not a palette swap: the design language is
  brass-on-ink with glow shadows, and the landing page's scroll choreography
  transitions between four named ground colours. It is a second design system.
  The `profiles.theme` column stays, so this is not a one-way door.
- **Two-factor switch — removed.** Toggled nothing.
- **Price alerts — removed** at the owner's request. Not wanted.
- **Delete account — DONE.** `deleteAccount` in `app/dashboard/actions.ts`, via
  the service-role client in `lib/supabase/admin.ts`. Gated on typing the
  account's own email AND re-entering the password: the email catches "wrong
  account on a shared machine", the password catches "unlocked laptop". Avatar
  objects are removed first because `storage.objects.owner` does not cascade;
  everything in `public` does cascade from `auth.users` (migration 0003).
- **Change email.** Supabase requires confirmation from both addresses; it is a
  flow, not a field. The input is disabled with a hint.

### 4.7 Loan reminders — DONE, but not yet deliverable
Per-loan email reminders ship (§2.4). They will not actually arrive until
`BREVO_API_KEY` and `BREVO_SENDER` are set AND the sender is at a domain you own
with SPF/DKIM/DMARC configured. A `@gmail.com` sender fails DMARC alignment and
lands in spam — the same limitation as the OTP mail. The domain is the blocker,
not the code.

### 4.8 PDF report — DONE
`/api/export?format=pdf` renders a portfolio report with `@react-pdf/renderer`
(`lib/report/`). Light "paper" palette rather than the app's ink-and-brass: a
dark PDF is a document nobody can print. Built-in Helvetica only — registering a
web font would mean a network fetch inside a serverless function, a new way for
a download to fail.

Unlike CSV and JSON, which hand back records verbatim, this is a report *about*
them: allocation, sector concentration, net-worth trend, and a derived insight
section (concentration risk, debt ratio, cash runway, savings rate, goals off
pace). Every claim is computed; when the data will not support one, it is not
made.

Layout is verified by `scripts/verify-report.ts`, which renders against sample
data with no database or session — the only way to catch a page break landing
badly before a user does.

### 4.9 Legal pages are dead links
Terms and Privacy are linked from signup and the footer and point at `#`.

---

## 5. Suggested order

1. ~~Dashboard overview off fixtures~~ — done
2. ~~Net worth snapshot job~~ — done
3. **Push + GitHub secrets** so prices and snapshots maintain themselves. This
   moved up: every day the snapshot workflow is not live is a day permanently
   missing from the net-worth chart.
4. ~~Edit and delete~~ — done
5. ~~Settings persistence~~ — done
6. **Tests** for holdings and money
7. **Domain + deploy**
8. **MUFAP** automation, when the Cloudflare challenge can be dealt with
9. Sector names, index column, holidays, pruning
10. Search, theme, reports

The "remove the mock data" goal is met: nothing in the dashboard is invented any
more. Step 7 is what turns it from a
local project into something another person can use.
