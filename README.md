# 💰 PakFinance

**Your finances. One view.**

A personal net-worth and portfolio tracker built for Pakistan — PSX holdings, mutual funds, bank balances, loans, committees and Zakat in a single dashboard, with every figure derived from records you enter yourself.

<p>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.3-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3FCF8E?logo=supabase&logoColor=white">
  <img alt="Drizzle" src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black">
  <img alt="Tests" src="https://img.shields.io/badge/tests-173%20passing-3FBF7F">
</p>

> [!NOTE]
> **A personal project, not a commercial service.** Built and run by one person for personal use. Nothing is sold, no subscription is charged, and no data is shared for commercial gain. Market data belongs to the Pakistan Stock Exchange and MUFAP, is used only to value holdings you enter yourself, and is never redistributed. Not affiliated with PSX, MUFAP, any AMC or any bank. **Not investment advice.**

---

## 📑 Table of contents

- [Why it exists](#-why-it-exists)
- [Features](#-features)
- [Tech stack](#-tech-stack)
- [How the core features work](#-how-the-core-features-work)
- [Architecture](#-architecture)
- [Security model](#-security-model)
- [Scheduled jobs](#-scheduled-jobs)
- [Getting started](#-getting-started)
- [Environment variables](#-environment-variables)
- [Scripts reference](#-scripts-reference)
- [Testing & verification](#-testing--verification)
- [Deployment](#-deployment)
- [Known limitations](#-known-limitations)

---

## 🎯 Why it exists

Pakistani personal finance doesn't fit international tools. There's no Plaid, no bank API, no aggregator. A committee (BC) is a rotating savings pool that is an **asset before your turn and a liability after it**. Zakat needs nisab, hawl and a dozen scholarly judgements. PSX quotes are behind a market-watch page, and mutual fund NAVs live in a single daily MUFAP report.

PakFinance handles all of that natively, and asks for **no bank credentials, ever** — there is no field for one anywhere in the product.

---

## ✨ Features

### 📊 Portfolio & investments

| Feature | What it does |
|---|---|
| **PSX portfolio** | Weighted-average cost basis including brokerage and CDC charges. Unrealised P&L per scrip, sector concentration, index membership (KSE100 / KMI30). |
| **Corporate actions** | Splits, symbol changes and mergers replayed on a single timeline with your trades, so a post-split snapshot never records pre-split quantities. |
| **Mutual funds** | Units, NAV and allocation across every AMC. Fractional units, weighted-average NAV, fund-rename tracking via an alias table. |
| **Other assets** | Gold, silver, property, vehicles, crypto, foreign currency — with an `as-of` date, and a warning when a valuation goes stale. |

### 🏦 Money & obligations

| Feature | What it does |
|---|---|
| **Bank accounts** | Balances you enter and confirm. A freshness indicator shows when one was last verified. |
| **Transactions** | Income and expenses with categories, feeding cash-flow and spending breakdowns. |
| **Budgets** | Monthly limits per category. Spend is **derived from the ledger**, so a budget and its actual can never disagree. |
| **Recurring entries** | Salary, rent, utilities. Catches up every missed period, and cannot post one twice. |
| **Loans** | Outstanding balance derived from the payment ledger, never stored. Monthly instalments or a single lump sum. |
| **Committees (BC)** | Rotating savings modelled properly — savings before your payout, debt after it, landing on the correct side of the balance sheet. |

### 🕌 Zakat

A calculator that shows its working line by line. Gathers cash, shares, funds, marked assets, receivables and committee contributions; deducts short-term debt; applies 2.5% above nisab.

Every contested judgement is a **switch, never an assumption** — gold vs silver nisab, whether long-held shares count, which debts are deductible. The metal price is an input, because it is the threshold that decides whether anything is owed at all.

### 📈 Net worth

- Daily snapshots build a permanent history — bank balances and NAVs cannot be reconstructed after the fact, so the chart is drawn only from real recorded days.
- **Today's point is live**, recomputed on every load, so the line moves the moment you add a record or prices update.
- Round-numbered axes with value and date gridlines.

### 🔐 Security & account

| Feature | What it does |
|---|---|
| **Quick-unlock PIN** | 6-digit PIN that locks the app after 3 minutes idle. Belongs to the **account**, so signing out never loses it. |
| **Session list** | Every signed-in device, with the ability to end any of them. |
| **Delete account** | Removes everything, permanently — gated on typing your own email *and* your password. |
| **Admin console** | A separate `/admin` surface behind its own password, for market-data maintenance. |

### 📤 Your data

| Format | Contents |
|---|---|
| **PDF** | A portfolio *report* — allocation, sector concentration, net-worth trend, and derived observations (concentration risk, debt ratio, cash runway, savings rate). |
| **JSON** | Every record you have entered, kept whole. The complete copy. |
| **CSV** | One row per money movement — the shape a spreadsheet can sort and pivot. |

---

## 🛠 Tech stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Next.js 16.3 (App Router, Turbopack) | Server Components keep queries on the server; Server Actions remove a hand-written API layer. |
| **UI** | React 19.2, Tailwind CSS 4 | Design tokens in `design/tokens.css` drive a single dark theme. |
| **Language** | TypeScript 5 (strict) | |
| **Auth** | Supabase Auth (`@supabase/ssr`) | Email + password with OTP verification, cookie-based SSR sessions. |
| **Database** | Supabase Postgres | Row Level Security is the access control, not application code. |
| **ORM** | Drizzle ORM 0.45 + postgres.js | Typed schema, SQL-first migrations. |
| **Motion** | GSAP, Lenis, Motion | Landing-page scroll choreography and the custom cursor. |
| **PDF** | `@react-pdf/renderer` | Server-rendered reports with no browser dependency. |
| **Testing** | Vitest | 173 unit tests over pure financial logic. |
| **Jobs** | GitHub Actions | Free, and independent of the hosting platform. |
| **Hosting** | Vercel | |

---

## ⚙️ How the core features work

### 💵 Money is always integer paisa

`PKR 1,234.56` is stored as `123456`. Never a float — floating-point rounding on money is how a portfolio drifts by a rupee a year and nobody can explain why. Formatting happens at the edge, in `lib/money.ts`, with lakh/crore notation as a user preference.

### 🧮 Balances are derived, never stored

A loan's outstanding balance is computed from its payment ledger. A goal's progress is the sum of its contributions. A budget's spend comes from the transaction ledger.

> A stored balance and a payment log drift apart the first time either is edited. Deriving costs a little CPU and removes an entire class of bug.

### 📉 Cost basis and corporate actions

`buildHoldings()` merges trades and corporate actions into one chronological timeline, replaying them in order. A split scales quantity and leaves book cost alone. A symbol change moves the whole position — realised gains and dividends included — and retires the dead ticker.

Only `SPLIT`, `SYMBOL_CHANGE` and `MERGER` are applied. `BONUS` and `RIGHT` are recorded for reference, because the EOD feed already adjusts for them and applying both would double the shares.

### 🕐 Market hours live in the database

PSX shortens hours through Ramadan, closes for Eid and Independence Day, and runs a **split session on Fridays** (09:30–12:00, then 14:30–16:30) around Jummah.

A crontab cannot express that. So the schedule fires often and cheaply, and `lib/market/sync.ts` decides whether to actually fetch — reading session hours and holidays from `market.sessions` and `market.market_holidays`.

The closing snapshot has a **180-minute post-close window**, because market watch keeps serving settled closing prices afterwards, so a later snapshot is safer than an earlier one and absorbs scheduler drift.

### 🔒 The PIN lock

Two independent mechanisms:

1. **Server** — a scrypt verifier on the profile, so the PIN survives sign-out, a cleared browser and a new device.
2. **Client** — the Supabase refresh token encrypted with a key derived from the PIN (PBKDF2, 600k iterations → AES-GCM).

The PIN does not "hide the UI" — that would be theatre, bypassed with devtools. Without the right PIN the stored token is unreadable. Five wrong attempts destroys the blob.

---

## 🏗 Architecture

```
app/
├── (marketing)/          Landing page — GSAP scroll choreography
├── (auth)/               Sign in, sign up, OTP verify, password reset
├── (legal)/              Privacy, terms
├── dashboard/            The app — 11 screens + server actions
├── admin/                Operator console, own password
└── api/
    ├── cron/             4 job endpoints, CRON_SECRET required
    └── export/           PDF / JSON / CSV
lib/
├── market/               Holdings, cost basis, sync, snapshots, sessions
├── db/                   Drizzle schema + 16 SQL migrations
├── notify/               Reminders, watchdog, email
├── pin/                  PIN crypto, storage, verifier
└── *.ts                  Pure logic: money, zakat, committees, recurring…
scripts/                  27 operational and verification scripts
.github/workflows/        5 scheduled jobs
```

### Data model

| Schema | Tables | Access |
|---|---|---|
| `public` | 19 — accounts, transactions, loans, goals, assets, budgets, committees, Zakat… | User-owned. **RLS forced, 64 policies.** |
| `market` | 12 — securities, prices, daily bars, funds, NAVs, sessions, holidays, sync runs | Shared reference data. Not exposed via PostgREST. |

Currently tracking **499 PSX securities** and **547 mutual funds**.

---

## 🛡 Security model

| Control | Implementation |
|---|---|
| **Row Level Security** | Enabled **and forced** on every `public` table. 64 policies, all scoping on `auth.uid()`. Verified by `npm run test:rls` — 67 checks across read, forged insert and signed-out access. |
| **No bank credentials** | There is no field for one anywhere in the product. |
| **Rate limiting** | Postgres-backed fixed windows on sign-in, sign-up, OTP, password reset, PIN and admin unlock — per identity **and** per IP. The whole window moves in one atomic statement, because read-then-write is exactly the race an attacker generates. |
| **PIN verifier** | scrypt, with `SELECT`/`UPDATE` revoked from client roles at column level, so it can be set and checked but never read back or overwritten from a browser. |
| **Admin console** | `ADMIN_EMAIL` from the environment only — no role column, no invite, no first-user-wins. Returns **404** to everyone else. Second password, scrypt-hashed, in a deny-all table. |
| **Cron endpoints** | `CRON_SECRET` required; return 401 otherwise. |
| **Account deletion** | Every user-owned table cascades from `auth.users`, verified automatically by the security audit. |
| **Secrets** | The client bundle is scanned; only the two `NEXT_PUBLIC_` values appear. |

---

## ⏰ Scheduled jobs

Run on **GitHub Actions**, not the host — so they work on any plan and survive a hosting change.

| Job | Schedule (UTC) | What it does |
|---|---|---|
| 📈 **PSX price sync** | `0,30 4-12 * * 1-5` | Fetches market watch. Most runs exit on a guard; ~3/day actually fetch. Writes the permanent daily bar at close. |
| 📸 **Net-worth snapshot** | `13:30`, retry `14:30` | One row per user per day. Cannot be backfilled. |
| 🔔 **Loan reminders** | `03:30` | Emails upcoming repayments. Idempotent — a retried run cannot double-send. |
| 🧹 **Maintenance** | `04:30` | Prunes old prices, posts recurring entries, runs the watchdog. |
| 💹 **MUFAP NAV sync** | *disabled* | MUFAP sits behind a Cloudflare challenge — imported through the admin console instead. |

---

## 🚀 Getting started

**Prerequisites:** Node 22+, npm 11+, a Supabase project.

```bash
git clone https://github.com/ch-harisimran/PakFinance.git
cd PakFinance
npm install
cp .env.example .env.local     # then fill it in
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> [!TIP]
> Use **localhost**, not your LAN IP. `crypto.subtle` — which the PIN lock needs — is only available in a secure context, and plain HTTP on a LAN address is not one.

---

## 🔑 Environment variables

| Variable | Required | Purpose |
|---|:---:|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | Public origin. Used for OG images and email links. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Ships to the browser by design. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | RLS protects the data, not this key's secrecy. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Bypasses RLS.** Server only. |
| `DATABASE_URL` | ✅ | Session pooler (5432) — migrations. |
| `DATABASE_POOL_URL` | ✅ | Transaction pooler (6543) — runtime. |
| `CRON_SECRET` | ✅ | Shared secret for `/api/cron/*`. |
| `ADMIN_EMAIL` | — | The one address that may reach `/admin`. |
| `PSX_MIN_SYNC_INTERVAL_MINUTES` | — | Default 180. |
| `PSX_USER_AGENT` | — | Identifies the client honestly. |
| `MUFAP_NAV_URL` | — | Report location. |
| `BREVO_API_KEY` / `BREVO_SENDER` | — | Loan reminder email. |

---

## 📜 Scripts reference

### Development

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build and serve |
| `npm run lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `npm test` | 173 unit tests |

### Database

| Command | Purpose |
|---|---|
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run backup` | Full row-level backup, with verification |

### Market data

| Command | Purpose |
|---|---|
| `npm run sync:psx` | PSX prices (`--force` to bypass guards) |
| `npm run sync:nav -- --file <html>` | Import a saved MUFAP report |
| `npm run snapshot` | Net-worth snapshot |
| `npm run seed:sectors -- --file <csv>` | Name PSX sector codes |
| `npm run seed:actions -- --file <csv>` | Record corporate actions |
| `npm run reconcile:psx` | Compare our universe against the live feed |
| `npm run merge:funds` | Merge a renamed fund, preserving history |

### Verification

| Command | Proves |
|---|---|
| `npm run test:rls` | No user can read another's rows — 67 checks |
| `npm run audit:security` | Every table has RLS forced, policies scope on `auth.uid()`, deletion cascades |
| `npm run verify:ratelimit` | Limits hold, including under a concurrent burst |
| `npm run verify:pin` | A PIN survives sign-out |
| `npm run verify:report` | PDF layout, without a database |
| `npm run schedule:report` | Which jobs have actually fired **on schedule** |

---

## 🧪 Testing & verification

**173 unit tests across 11 files**, all pure functions with no database:

| Suite | Covers |
|---|---|
| `market/holdings` | Cost basis, splits, symbol changes, mergers |
| `market/fund-holdings` | Fractional units, weighted-average NAV |
| `money` | Paisa conversion, rounding, lakh/crore |
| `zakat` | Nisab as a **threshold**, not an allowance |
| `committees` | Position, payout timing, balance-sheet side |
| `recurring` | Catch-up posting, no double-post |
| `notify/due-dates` | Month-end edges — a loan due on the 31st in February |
| `alerts`, `search`, `chart-ticks`, `networth-series` | Supporting logic |

Beyond unit tests, the repo carries **behavioural** verification — RLS, rate limiting, PIN persistence and schedule proof each have a script that exercises the real database with throwaway users and cleans up after itself.

> A green manual run proves the code. Only a cron run proves the cron — which is why `schedule:report` distinguishes `trigger='schedule'` from a manual dispatch.

---

## ☁️ Deployment

Deployed on **Vercel**, with the database and jobs independent of it.

1. Import the repo — **Root Directory: repo root**
2. Set the function region close to your Supabase region (e.g. `bom1` for `ap-south-1`)
3. Add the environment variables above
4. Deploy, then set `NEXT_PUBLIC_SITE_URL` to the real URL and **redeploy** (it is baked in at build time)
5. In Supabase → Authentication → URL Configuration, add the domain to **Site URL** and **Redirect URLs**

No `vercel.json` and no platform cron needed — the scheduled jobs run on GitHub Actions.

---

## ⚠️ Known limitations

Stated plainly rather than hidden:

- **MUFAP NAVs are imported manually.** Every MUFAP route answers `cf-mitigated: challenge`, and the site offers no download URL. Defeating that challenge would be circumventing bot detection, so the admin console accepts a saved copy of the report instead.
- **Email deliverability needs a domain.** A `@gmail.com` sender fails DMARC alignment, so verification codes may land in spam until a domain with SPF/DKIM/DMARC is configured.
- **Gold and property have no price feed.** Values are user-maintained with an `as-of` date, and the app says so rather than inventing a number.
- **Only one theme.** The design language is brass-on-ink; a light theme would be a second design system, not a palette swap.
- **The net-worth chart cannot be backfilled.** History begins when the snapshot job starts running.

---

<p align="center">
  <sub>Built in Pakistan 🇵🇰 · Not investment advice · Not affiliated with PSX, MUFAP or any bank</sub>
</p>
