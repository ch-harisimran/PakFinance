# PakFinance — what's left

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

### 1.3 Settings saves nothing
Profile fields, password change, notation, theme and notification switches are
all local component state. Nothing writes to `profiles`. Reload and it's gone.

### 1.4 Records can be created but not edited or deleted
`deleteRow` exists as an action with an allowlist; no UI calls it. There is no
edit path for any record, and `updateAccountBalance` has an action but no
button. A user who fat-fingers a trade is stuck with it.

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

### 4.6 Legal pages are dead links
Terms and Privacy are linked from signup and the footer and point at `#`.

---

## 5. Suggested order

1. ~~Dashboard overview off fixtures~~ — done
2. ~~Net worth snapshot job~~ — done
3. **Push + GitHub secrets** so prices and snapshots maintain themselves. This
   moved up: every day the snapshot workflow is not live is a day permanently
   missing from the net-worth chart.
4. **Edit and delete** — data entry without correction is a trap
5. **Settings persistence** — profile, notation, theme
6. **Tests** for holdings and money
7. **Domain + deploy**
8. **MUFAP** automation, when the Cloudflare challenge can be dealt with
9. Sector names, index column, holidays, pruning
10. Search, theme, reports

Steps 4–5 finish the "remove the mock data" goal. Step 7 is what turns it from a
local project into something another person can use.
