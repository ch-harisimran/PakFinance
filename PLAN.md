# PakFinance — Full Build Plan

A single web app where a Pakistani user tracks their entire financial life: PSX stock portfolio, mutual funds, loans, bank loans, and savings goals.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15 (App Router) + React 19 + TypeScript** | Server components for fast dashboards, route handlers for the price-sync API, Vercel Cron built in |
| Styling | **Tailwind CSS v4** + **shadcn/ui** (Radix) | Fast, accessible primitives you fully own; easy dark/light theming |
| Auth | **Supabase Auth** | Email OTP, magic links, password reset, sessions — all built in. Saves ~2 weeks vs. rolling your own |
| Database | **Postgres (Supabase)** with **Row Level Security** | RLS means a user can *never* read another user's portfolio, even if you write a buggy query |
| ORM | **Drizzle ORM** | Type-safe, SQL-shaped, works great with Supabase migrations |
| Server state | **TanStack Query** | Polling, caching, background refetch for live prices |
| Client state | **Zustand** | Tiny, for UI-only state (theme, sidebar, modals) |
| Forms | **React Hook Form + Zod** | One Zod schema shared by client + server validation |
| Charts | **Recharts** (portfolio/allocation) + **lightweight-charts** (TradingView, for candlesticks) | Recharts for dashboards, TradingView lib for real stock charts |
| Animation | **GSAP + ScrollTrigger**, **Motion (Framer Motion)**, **Lenis** | GSAP for scroll storytelling, Motion for component/layout transitions, Lenis for smooth scroll |
| 3D | **Three.js via React Three Fiber + @react-three/drei + postprocessing** | Hero scenes, glass cards, shader gradients |
| Email | **Resend** + **React Email** | OTP and alert emails that don't look like 2009 |
| Rate limiting | **Upstash Redis** | Protect OTP + login endpoints |
| Jobs | **Vercel Cron** (or Supabase Edge Functions + pg_cron) | Price sync every N minutes during market hours |
| Money math | **decimal.js** or integer paisa | **Never use JS floats for money.** Store paisa as `bigint`/`numeric` |
| Testing | **Vitest** (unit) + **Playwright** (e2e) | Test the auth flow and loan amortization math |
| Deploy | **Vercel** + **Supabase** | Free tier covers you until real users |

> **Alternative if you prefer one codebase, no vendor:** Next.js + Postgres (Neon) + Auth.js + Prisma. More control, ~2 extra weeks of auth work. I recommend Supabase for v1.

**Estimated monthly cost at launch:** $0–25 (Vercel Hobby + Supabase Free + Resend free tier), rising to ~$45/mo at Pro tiers.

---

## 2. The Hard Part: Where Market Data Comes From

Read this before writing any code — it shapes the whole app.

### PSX (Pakistan Stock Exchange)
There is **no free official real-time PSX API.** Your realistic options:

1. **PSX Data Portal (`dps.psx.com.pk`)** — public market-watch and company pages. Parseable server-side. Delayed (typically ~15 min), free. **Best starting point.**
2. **PSX official Data & Analytics licensing** — real-time feed, paid, requires an agreement with PSX. Do this when you have paying users.
3. **Third-party aggregators** — Mettis Global, Sarmaaya, or generic providers (EODHD, Twelve Data). PK coverage varies; check before committing.

**Do not scrape from the browser.** Scrape server-side on a cron, store snapshots in your own DB, and serve those to clients. This gives you caching, rate-limit safety, one source of truth, and historical data for free.

**Legal:** review the terms of any source before commercial use. For a public/monetized product, plan on a licensed feed.

### Mutual Funds
**MUFAP** (`mufap.com.pk`) publishes daily NAVs for all Pakistani AMCs (Meezan, UBL, HBL, Alfalah, Atlas, NBP, etc.).

⚠️ **Set the right expectation in your UI:** mutual fund NAVs are **end-of-day, once per day** — they do not tick live. Label it "NAV as of 14 Aug 2025" rather than implying real-time. Sync once daily around 19:00–21:00 PKT.

### Architecture that keeps you unblocked

```ts
// lib/market/provider.ts
export interface MarketDataProvider {
  getQuotes(symbols: string[]): Promise<Quote[]>
  getHistory(symbol: string, range: Range): Promise<Candle[]>
}
```

Implement `PsxDpsProvider` today; drop in `LicensedFeedProvider` later without touching a single UI file. Same for `NavProvider` (MUFAP).

### Market hours (Pakistan)
- Mon–Thu: 09:32–15:30 PKT, Fri: 09:17–12:00 & 14:32–16:30 PKT
- Store all timestamps in **UTC**, render in **Asia/Karachi**
- Poll every 60–120s **only during market hours**; freeze and show "Market closed" otherwise. This alone cuts your API calls ~80%.

---

## 3. Screens & Features

### A. Public
| Screen | Contents |
|---|---|
| **Landing** | 3D hero, live PSX ticker strip (real data — instant credibility), feature scroll-story, KSE-100 mini chart, security section, pricing, FAQ, footer |
| Legal | Privacy policy, terms, "not investment advice" disclaimer |

### B. Auth
```
Sign up (name, email, password)
   ↓
Email OTP verification (6-digit, 10-min expiry)
   ↓
Onboarding (currency = PKR, timezone, optional starting balances)
   ↓
Dashboard
```
Also: **Login** (+ optional OTP as 2FA), **Forgot password** → email link/OTP → **Reset password**, **Change password** (requires current password, invalidates other sessions).

**OTP rules — implement all of these:**
- 6 digits, cryptographically random, **hashed** in DB (never store plaintext)
- 10-minute expiry, single-use, deleted on success
- Max 5 verify attempts, then the code dies
- Resend cooldown 60s, max 5/hour per email **and** per IP
- Rate limit login: 5 fails → 15-min lockout
- **Email OTP for v1.** SMS OTP to Pakistani numbers costs real money per message (Twilio/local gateways) and invites SMS-pumping fraud. Add SMS later if users ask.

### C. Dashboard
- Net worth hero card + sparkline (assets − liabilities)
- Today's P&L, total invested, unrealized gain %
- Asset allocation donut (stocks / funds / cash)
- Net worth over time (area chart)
- Upcoming loan installments (next 30 days)
- Goal progress rings
- Top movers from *your* holdings
- Recent activity feed

### D. PSX Portfolio
- Holdings table: symbol, company, qty, avg cost, LDCP, current price, market value, unrealized P&L, % change, day change — with **live price updates** (colour flash green/red on tick)
- Add/edit/delete transactions: BUY/SELL/DIVIDEND/BONUS/RIGHT, with date, qty, price, brokerage commission, CDC/FED charges
- **Cost basis: weighted average** (matches how Pakistani brokers report). Realized vs unrealized split
- Per-symbol detail: candlestick chart, your transaction history for that scrip, position stats
- Sector allocation, dividend income tracker, CGT-estimate note
- CSV import/export

### E. Mutual Funds
- Holdings: fund name, AMC, category (Money Market / Income / Equity / Islamic), units, avg NAV, current NAV, value, gain
- Manual buy/redeem entries + optional recurring monthly SIP entry
- NAV history chart, "as of" date badge everywhere
- Islamic (Shariah-compliant) filter toggle — this matters a lot to your audience

### F. Loans (money you lent / borrowed personally)
- Counterparty name, principal, direction (lent/borrowed), optional interest, start date, due date
- Payment log with running balance
- Status: active / partially repaid / settled / overdue
- Reminders for due dates

### G. Bank Loans (manual entry, as you specified)
- Bank, loan type (personal / car / home / credit card), principal, markup rate, tenure, start date
- **Auto-generated amortization schedule** — this is the killer feature. Show principal vs. markup split per installment
- Manual payment log: date, amount, mark as principal/markup/late fee
- Outstanding balance, total markup paid to date, payoff date
- "What if I pay X extra per month?" payoff simulator

### H. Goals
- Goal name, target amount, target date, category (Hajj, house, car, emergency fund, wedding, education)
- Link goal to funding sources (stocks/funds/cash)
- Progress ring + required monthly contribution to stay on track
- On-track / behind indicator, milestone celebration animation

### I. Settings
- Profile (name, avatar, phone)
- **Change password** (current password required)
- **Theme**: Light / Dark / System + accent colour picker
- Currency & number format (PKR, lakh/crore vs. million toggle — Pakistani users expect both)
- Notifications: email alerts, price alerts, installment reminders
- Security: active sessions list + revoke, 2FA toggle, login history
- Data: export all as CSV/JSON, **delete account** (with typed confirmation)

---

## 4. Data Model

```
users                (Supabase auth.users)
profiles             id, user_id, full_name, avatar_url, phone, timezone, currency,
                     theme, accent_color, number_format, created_at
otp_codes            id, user_id, code_hash, purpose(signup|reset|2fa),
                     expires_at, attempts, consumed_at
sessions             (Supabase-managed) + audit_log for login history

securities           symbol PK, company_name, sector, isin, is_active
prices               symbol, price, ldcp, day_high, day_low, volume, change_pct,
                     as_of  → PK (symbol, as_of), hypertable-ish, indexed on as_of
price_latest         symbol PK, ... (materialized "current" row — read this on every page load)

stock_transactions   id, user_id, symbol, type(BUY|SELL|DIVIDEND|BONUS|RIGHT),
                     quantity, price_paisa, commission_paisa, other_charges_paisa,
                     traded_at, notes
holdings_view        (SQL view) user_id, symbol, qty, avg_cost, realized_pnl

funds                id, name, amc, category, is_islamic, mufap_code
fund_navs            fund_id, nav, as_of  → PK (fund_id, as_of)
fund_transactions    id, user_id, fund_id, type(BUY|REDEEM|DIVIDEND),
                     units, nav_paisa, amount_paisa, traded_at

loans                id, user_id, counterparty, direction(LENT|BORROWED),
                     principal_paisa, interest_rate, start_date, due_date, status
loan_payments        id, loan_id, amount_paisa, paid_at, note

bank_loans           id, user_id, bank_name, loan_type, principal_paisa,
                     markup_rate, tenure_months, start_date, installment_paisa
bank_loan_schedule   id, bank_loan_id, installment_no, due_date,
                     principal_paisa, markup_paisa, balance_paisa
bank_loan_payments   id, bank_loan_id, amount_paisa, paid_at,
                     principal_paisa, markup_paisa, late_fee_paisa

goals                id, user_id, name, target_paisa, current_paisa,
                     target_date, category, linked_account_ids[], status

net_worth_snapshots  id, user_id, date, assets_paisa, liabilities_paisa  (daily cron)
```

**Rules:**
- Every user-owned table gets an RLS policy: `auth.uid() = user_id`. No exceptions.
- All money as `bigint` **paisa**. `PKR 1,234.56` → `123456`. Format only at the render layer.
- All timestamps `timestamptz` in UTC.

---

## 5. Security Checklist

- RLS on every table + a Playwright test that proves user A can't read user B's data
- OTP hashed, single-use, rate-limited (see §3B)
- HTTP-only, secure, SameSite cookies for sessions
- Zod validation on **every** server action and route handler — never trust the client
- CSRF protection on mutations, strict CSP headers
- Upstash rate limits on `/auth/*` and `/api/prices`
- Never store broker credentials or CDC account passwords. Ever. Manual entry + CSV import only
- Audit log: logins, password changes, data exports, account deletion
- Encrypt sensitive columns at rest if you later add account numbers
- Prominent disclaimer: *"PakFinance is a tracking tool. It does not provide investment advice."*

---

## 6. Making It Look Premium (3D + Scroll Animations)

### 6.1 Design system first — this matters more than the 3D
Premium comes from restraint, not effects. Effects on a mediocre base look cheap.

- **Palette:** dark-first. Base `#08090C` → `#101218`, surfaces at 4–8% white overlay. **One** accent (emerald `#00D492` reads as PKR-green and as "gain"). Semantic red `#FF4D4D` for loss. Never more than 2 hues.
- **Type:** display font with character — *Clash Display*, *Satoshi*, or *General Sans* (Fontshare, free). UI font: *Inter* or *Geist*.
  - **Critical for finance:** every number uses `font-variant-numeric: tabular-nums`. Non-tabular figures make tables jitter on every price tick and instantly look amateur.
- **Space:** 4px base scale. Generous — `py-32` between landing sections, not `py-12`.
- **Depth:** layered shadows (`0 1px 2px`, `0 8px 24px`, `0 24px 64px` all at low alpha), 1px borders at `rgba(255,255,255,.06)`, subtle noise texture overlay at 3% opacity to kill banding.
- **Radius:** consistent — `rounded-2xl` for cards, `rounded-xl` for inputs, `rounded-full` for pills.
- **Motion tokens:** durations `150 / 250 / 400 / 700ms`; easing `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for entrances, spring for interactions. Never `ease-in-out` on everything.

### 6.2 The 3D layer (React Three Fiber)

**Landing hero — pick ONE, execute perfectly:**
1. **Animated gradient mesh** — a plane with a custom fragment shader, slow flowing noise in your brand colours. Cheapest, most premium, hardest to make look bad.
2. **Floating glass cards** — 3–5 planes with `MeshTransmissionMaterial` (drei), holding your actual UI screenshots, drifting on sine waves, tilting toward the cursor.
3. **Particle field / data cloud** — 5–10k `Points` forming a rising-chart shape, dispersing on hover.

```tsx
<Canvas
  dpr={[1, 2]}                      // never render at 3x on phones
  gl={{ antialias: false, powerPreference: 'high-performance' }}
  camera={{ position: [0, 0, 6], fov: 35 }}
>
  <Suspense fallback={null}>
    <GradientMesh />
    <EffectComposer>
      <Bloom intensity={0.4} luminanceThreshold={0.8} />
    </EffectComposer>
  </Suspense>
</Canvas>
```

**Non-negotiable rules:**
- `next/dynamic` with `ssr: false` — Three.js is ~600KB; it must not block first paint
- Static gradient poster image behind the canvas as fallback
- **Kill 3D entirely** on `prefers-reduced-motion` and on mobile below 768px (use a static image)
- Pause the render loop when the canvas leaves the viewport (`useFrame` + IntersectionObserver)
- **Zero 3D inside the app itself.** The dashboard must be fast, calm, and legible. 3D lives on the landing page only. This contrast is exactly what premium products do.

**Cheaper "3D" that works everywhere:** CSS `transform: perspective() rotateX/rotateY` on cards, layered parallax on scroll, `backdrop-filter: blur()` glass panels. 90% of the perceived effect, 2% of the cost.

### 6.3 Scroll animations (GSAP ScrollTrigger + Lenis)

```bash
npm i gsap lenis @gsap/react
```

```tsx
// Smooth scroll driving ScrollTrigger
const lenis = new Lenis({ duration: 1.1, easing: t => Math.min(1, 1.001 - 2**(-10*t)) })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add(t => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
```

**Landing scroll story:**
| Section | Effect |
|---|---|
| Hero | Headline words stagger up (`y: 40 → 0`, 60ms stagger); 3D scene camera pushes in as you scroll (`scrub: 1`) |
| Live ticker | Infinite marquee of real PSX prices, pauses on hover |
| "Everything in one place" | **Pinned** section; a phone/dashboard mockup stays fixed while feature text swaps beside it on scrub |
| Portfolio feature | Horizontal scroll gallery (`x: -100%` tied to vertical scroll) |
| Stats | Numbers count up from 0 when 60% in view (`ScrollTrigger` + GSAP tween on a proxy object) |
| Loan/goal | SVG path draws itself (`strokeDashoffset` → 0 on scrub) |
| Security | Cards rise + fade with 80ms stagger |
| CTA | Background gradient hue shifts across the section |

**Recipe for section reveals (use everywhere):**
```ts
gsap.from('.reveal', {
  y: 32, opacity: 0, duration: 0.8, stagger: 0.08,
  ease: 'expo.out',
  scrollTrigger: { trigger: section, start: 'top 75%', once: true }
})
```
`once: true` — replaying on every scroll-back is the #1 sign of an amateur site.

**Micro-interactions that sell "premium":**
- Magnetic buttons (button translates ~8px toward cursor)
- Card tilt on mouse move, spring back on leave
- Spotlight hover: radial gradient follows the cursor inside a card
- Price ticks flash a background colour for 400ms then fade
- Number roll-ups when values change
- Skeleton shimmer while prices load — never a spinner
- Page transitions with Motion's `AnimatePresence` + shared layout IDs

### 6.4 Performance budget (enforce it or the "premium" evaporates)
- Animate **only** `transform` and `opacity`. Never `top`/`left`/`width`/`height`
- 60fps floor; profile with Chrome Performance panel, not vibes
- Landing LCP < 2.5s, JS on first load < 200KB (excluding the lazy 3D chunk)
- Lighthouse ≥ 90 on the landing page
- **Every** animation respects `prefers-reduced-motion` — wrap in `gsap.matchMedia()`
- Test on a mid-range Android on 4G, not just your laptop

---

## 7. Folder Structure

```
pakfinance/
├─ app/
│  ├─ (marketing)/page.tsx           # landing
│  ├─ (auth)/login|signup|verify-otp|forgot-password|reset-password/
│  ├─ (app)/
│  │  ├─ dashboard/
│  │  ├─ stocks/ [symbol]/
│  │  ├─ funds/
│  │  ├─ loans/
│  │  ├─ bank-loans/ [id]/
│  │  ├─ goals/
│  │  └─ settings/
│  └─ api/
│     ├─ cron/sync-prices/route.ts   # Vercel Cron, market hours only
│     ├─ cron/sync-navs/route.ts     # daily
│     └─ cron/snapshot-networth/route.ts
├─ components/
│  ├─ ui/            # shadcn
│  ├─ three/         # R3F scenes (client-only)
│  ├─ motion/        # Reveal, Magnetic, CountUp, Tilt
│  └─ charts/
├─ lib/
│  ├─ market/        # providers, parsers, market-hours
│  ├─ finance/       # amortization, XIRR, cost-basis, money (paisa)
│  ├─ db/            # drizzle schema + queries
│  └─ auth/
└─ tests/
```

---

## 8. Build Order (realistic solo timeline)

| Phase | Work | Time |
|---|---|---|
| **0** | Next.js + Tailwind + shadcn + Supabase + Drizzle scaffold, design tokens, dark/light theme | 3–4 days |
| **1** | Full auth: signup → OTP → login → forgot/reset/change password, rate limits, RLS | 1 week |
| **2** | App shell, nav, empty dashboard, settings (theme + password) | 4 days |
| **3** | **Market data spike** — PSX provider, prices table, cron, market hours. *Do this early; it's the riskiest piece* | 1 week |
| **4** | Stock portfolio: transactions, holdings, cost basis, live prices, charts | 1.5 weeks |
| **5** | Mutual funds + MUFAP NAV sync | 1 week |
| **6** | Bank loans + amortization engine + payment log | 1 week |
| **7** | Personal loans + goals | 5 days |
| **8** | Dashboard aggregation, net worth snapshots, allocation charts | 5 days |
| **9** | **Landing page: 3D hero + GSAP scroll story** | 1–1.5 weeks |
| **10** | Polish, perf, a11y, e2e tests, deploy | 1 week |

**~10–12 weeks solo.** Phase 3 before Phase 4 — if PSX data proves harder than expected, you find out in week 3, not week 8.

---

## 9. Key Risks

| Risk | Mitigation |
|---|---|
| PSX data source breaks or blocks you | Provider interface + 2 implementations; cache aggressively; alert on sync failure; budget for a licensed feed |
| Users expect real-time NAVs | Label "as of" dates prominently; explain once in onboarding |
| Float rounding on money | Integer paisa everywhere, enforced by a `Money` type |
| 3D tanks mobile performance | Lazy-load, mobile fallback, reduced-motion, strict budget |
| Scope creep (tax reports, broker sync, multi-currency) | Ship v1 with manual entry only. Everything else is v2 |

---

## 10. Immediate Next Steps

1. `npx create-next-app@latest pakfinance --typescript --tailwind --app`
2. Create a Supabase project, enable Email OTP, set up Drizzle + first migration
3. **Spike the PSX data source for one day** before writing any UI — everything downstream depends on it
4. Build the design tokens + theme switch, then the auth flow

---

*Disclaimer to ship in the app: PakFinance is a personal finance tracking tool and does not provide investment advice.*
