# PakFinance Landing Page — Build Spec

Merge of the product brief with the **Ink & Brass** design system. Where the two disagreed, the resolution and reasoning is recorded in §1. Read `DESIGN-SYSTEM.md` first — this document does not repeat tokens.

---

## 1. Conflict resolutions

| # | Brief said | System says | Resolution | Why |
|---|---|---|---|---|
| 1 | Emerald + teal/cyan accent, `#080A0A`, white text | Brass `#C9A227` on five grounds, ivory text | **Brass wins** | This is the exact palette that was rejected as "AI looking." Also: if green is the brand colour, green can no longer mean *gain* — a finance product loses its most important signal. Brass brands; green means profit. |
| 2 | Inter / Plus Jakarta Sans / Geist | Instrument Serif + Satoshi + JetBrains Mono | **System wins** | Satoshi already is a modern geometric sans with strong hierarchy. Inter/Geist are the default fonts of generated landing pages — using them reintroduces the problem we just solved. |
| 3 | One near-black background throughout | Five grounds: ink / slate / warm / pine / paper | **System wins, and it serves the brief better** | §24 asked for "each section a continuation of the previous." The scrubbed ground handoff *is* that mechanism. One flat background cannot produce it. |
| 4 | 3D in ~8 sections | Recommended dropping 3D entirely | **Compromise: 2 WebGL scenes + 1 2D canvas** | See §4. Eight scenes is ~4 weeks and a mobile performance disaster. Two well-lit scenes at the two highest-impact moments read as *more* premium than eight mediocre ones. |
| 5 | "Avoid excessive glassmorphism" | Surface tints + hairline + inner top highlight | **Already aligned** | Our elevation model is not glassmorphism. Backdrop blur is used on exactly two things: the nav, and the hero centrepiece card. |
| 6 | White typography | Ivory `#EAE7E0` | **System wins** | Pure `#FFF` on near-black vibrates optically. Ivory is the single cheapest upgrade in the whole system. |

**Kept from the brief without change:** the entire scroll storyboard, all section content and copy, all figures, the animation inventory (§18), microinteractions (§22), cursor behaviour (§23), and the performance requirements (§25). The brief's narrative structure is better than the blueprint it replaces.

---

## 2. Storyboard & ground map

Thirteen scenes. The ground column is the fixed backdrop; the handoff between them is the section transition.

| # | Scene | Ground | Beat |
|---|---|---|---|
| 01 | Hero | `ink` | The promise |
| 02 | Problem — scattered | `ink → slate` | The pain. **The ground crossfade happens *as* the cards converge** |
| 03 | One dashboard | `slate` | The resolution |
| 04 | PSX portfolio | `warm` | Proof #1 |
| 05 | Mutual funds | `warm` | Proof #2 |
| 06 | Goals | **`paper`** | The emotional break |
| 07 | Loans | `warm` | The honest half |
| 08 | Bank accounts | `slate` | The daily half |
| 09 | Net worth | `ink` | The crescendo |
| 10 | Security | `pine` | The reassurance |
| 11 | How it works | `slate` | The ask, made easy |
| 12 | Final CTA | `ink` | The close |
| 13 | Footer | `ink` | — |

**Why Goals gets the paper ground:** it lands at ~55% scroll and it's the most emotional beat in the brief ("make finance feel motivating"). Coming out of two dark market sections into warm paper — then plunging back into dark for the net-worth crescendo — is the strongest dynamic on the page. It's also the moment no generated site produces.

**Scenes 04/05 and 07 share `warm`.** They're differentiated by a radial bloom that shifts position and intensity per scene rather than by a new ground colour. Proliferating grounds would weaken the ones that matter.

---

## 3. Scene specifications

Every scene inherits the three simultaneous motions from `DESIGN-SYSTEM.md` §5.2 (scrubbed ground crossfade, differential text float, once-only word-stagger entrance). Below is only what's *additional*.

### 01 · Hero — `ink`

Layout and content per the existing `hero-mock.html`, upgraded with the WebGL ecosystem.

**Load sequence** (this is the brief's §4, timed):

| t | Event |
|---|---|
| 0ms | Ground + grain fade in, 400ms |
| 120ms | Wordmark and nav fade down 8px |
| 300ms | Eyebrow fades in |
| 420ms | Headline reveals **word by word**, 70ms stagger, `y: 40 → 0`, `ease/out`, 900ms |
| 900ms | Sub-headline fades up 16px |
| 1050ms | CTAs scale `0.96 → 1` + fade, 40ms apart |
| 1150ms | WebGL objects drift in from `z: -400` to rest, staggered 90ms, 1400ms |
| 1500ms | Centrepiece card settles into `rotateY(-11°) rotateX(4°)` |
| 1900ms | Sparkline draws, goal ring fills, first price tick flashes |
| 2400ms | Scroll cue fades in |

Nothing moves simultaneously. Total ~2.4s, and the headline is readable at 1.3s — the LCP element must not wait on WebGL.

**Centrepiece:** the DOM card from `hero-mock.html` — net worth `PKR 2,450,000`, `+8.42%`, drawing sparkline, three tiles. It stays DOM, not WebGL: text in WebGL is blurry, unselectable, and invisible to search engines.

**Around it (WebGL, Scene A):** 7 abstract objects on slow orbital drift — a brushed-brass disc with an embossed ₨, two smaller coin discs, a frosted-glass panel, a ribbon surface reading as a rising chart, a rounded card slab, a torus as goal target. Materials: `MeshPhysicalMaterial`, metalness 0.9 / roughness 0.25 for brass, transmission 0.9 for glass. One key light warm from upper right, one cool rim from lower left, soft env map. **Abstract, never literal** — no wallet icons, no cartoon coins.

**Cursor parallax:** whole deck rotates ±3° toward pointer, spring damped, disabled on touch.

### 02 · Problem — scattered → converged — `ink → slate`

Headline: *Your money shouldn't be scattered everywhere.*

**Pinned scene, ~180vh of scroll.** Five DOM cards (PSX portfolio, mutual funds, bank account, loan, savings goal) begin scattered at wide `x/y/rotate` offsets and low opacity.

Scrubbed to progress `0 → 1`: each card lerps to centre, rotation → 0, scaling into a stack, and at `p > 0.82` the stack cross-dissolves into the single unified dashboard card. **The ground crossfade `ink → slate` is tied to the same scrub**, peaking exactly as the cards merge — so the backdrop change reads as *caused by* the convergence. This is the single most important sync on the page.

Headline swaps at `p = 0.85` to *One place. Everything.*

### 03 · One dashboard — `slate`

Headline: *One dashboard. Your entire financial life.*

Large dashboard visualization. Numbers count from 0 on entry, 1200ms, `ease/out`, `tabular-nums`:
Net Worth `PKR 2,450,000` · Investments `PKR 1,650,000` · Bank Balance `PKR 900,000` · Loans `PKR 650,000` · Goals `72%`

Area chart draws via `stroke-dashoffset` **scrubbed to scroll**, not time — the user's scroll speed draws the line.

### 04 · PSX — `warm`

Headline: *Your PSX portfolio, always within reach.*
Sub: *Track your holdings, portfolio value, and performance without jumping between spreadsheets and websites.*

Floating holdings panel: OGDC `+12.4%` · MEBL `+8.7%` · LUCK `+15.2%` · HBL `+6.8%`. Rows stagger in 70ms apart; deltas count up; one row flashes a live tick on a loop.

Restraint note from the brief — **not a trading terminal**. No order book, no depth chart, no candlesticks here. Generous padding, one sparkline, large type. A KSE-100 chip and "Market open · 15:12 PKT" stamp supply the Pakistani market reference.

### 05 · Mutual funds — `warm` (bloom shifts left)

Headline: *Investments that grow with you.*

Three fund cards (Meezan Islamic, UBL Liquidity Plus, Atlas Income) with NAV values and an "as of" date. Scrubbed: cards rotate and collapse into a **donut allocation chart**, arcs sweeping in clockwise. Card colours become the arc segments — the transformation must be legible as the same data, not a swap.

### 06 · Goals — `paper` ⭐

Headline: *Turn financial goals into something you can see.*

Three cards on warm paper with **real shadows**: Emergency Fund `350,000 / 500,000` 70% · New Car `1.2M / 2M` 60% · Dream Home `4.5M / 10M` 45%.

Progress bars fill on entry, 900ms, staggered 120ms. Percentages count alongside. Glowing points drift toward each goal marker — on paper these are **brass-deep motes, not white glows**; light-ground particles need darkening, not lightening, to read.

This is the one section where the page breathes. Extra vertical padding: `clamp(140px, 20vh, 220px)`.

### 07 · Loans — `warm`

Headline: *Know what you owe. Know when you're free.*

Car Loan · Remaining `PKR 1,250,000` · Monthly `PKR 42,500` · 62%.

Scrubbed: the remaining balance **counts down** as the user scrolls and an amortization ring closes. A payoff date resolves at the end — *Debt-free: March 2029*. Emotional payload without a word of copy.

### 08 · Bank accounts — `slate`

Headline: *Your money, clearly accounted for.*

Meezan Bank · `PKR 350,000`. Transactions materialise one at a time, 180ms apart, each sliding up 12px with a fading top hairline — never a table:
`+100,000 Salary` · `−25,000 Rent` · `−8,500 Groceries` · `−5,000 Utilities`.
Balance re-counts after each. Credits in `gain`, debits in `text/primary` — **not** in `loss`. Spending money is not a loss; misusing the red would be a real semantic error.

### 09 · Net worth — `ink`

Headline: *Watch your wealth grow.*

Full-bleed, **pinned, ~250vh**. The graph draws left to right on scrub, the value label riding the line's head: `1.0M → 1.2M → 1.5M → 1.8M → 2.1M → 2.45M`.

As the line climbs, a brass bloom behind it grows in radius and opacity, and the ground lifts imperceptibly from `#0A0B0D` to `#0E0F12`. The background literally brightens as wealth rises. Gridlines fade in behind; the area fill under the curve builds from 0% to 18% opacity.

The brief's most-impressive section — this is where the budget goes, and it needs no WebGL.

### 10 · Security — `pine`

Headline: *Your financial data deserves privacy.*

**WebGL Scene B:** a slowly rotating shield — faceted glass with a brass rim, refracting a blurred dashboard behind it. Fresnel edge glow, soft particles orbiting.

Four claims fade in staggered: Secure authentication · Encrypted data · Private financial information · User-controlled data. Each cross-references a real system guarantee (RLS, hashed OTP, no broker credentials stored, one-click export) — vague security copy reads as marketing; specifics read as engineering.

### 11 · How it works — `slate`

`01` Create your account — *Sign up securely in seconds.*
`02` Add your finances — *Connect or enter your investments, accounts, loans, and goals.*
`03` See the bigger picture — *PakFinance brings everything together into one simple financial overview.*

Numerals in Instrument Serif at `display-2`, `text/faint`, oversized. A brass vertical rule draws downward on scrub, connecting the three; each step activates as the rule passes it.

### 12 · Final CTA — `ink`

Headline: *Your money has a bigger picture.* Sub: *Bring everything together with PakFinance.*
Button: **Create Your Free Account →**

**Canvas Scene C (2D, not WebGL):** ~400 particles drifting toward a central brass point, brightening as they converge. A 2D canvas does this at a fraction of the cost and nobody can tell the difference. Falls back to a static radial gradient under reduced motion.

Button hover: magnetic pull 8px, brass glow blooms `0 → 24px`, arrow translates 4px, 200ms.

### 13 · Footer — `ink`

Wordmark · *Your finances. One view.*
**Product:** Features, PSX, Mutual Funds, Goals · **Company:** About, Security, Contact · **Legal:** Privacy, Terms
`© 2026 PakFinance. All rights reserved.` plus the required line: *PakFinance is a personal finance tracking tool and does not provide investment advice.*

---

## 4. 3D budget

**Funded:**
| Scene | Where | Why it earns it |
|---|---|---|
| **A** | Hero ecosystem | First impression; the brief's centrepiece; nothing in CSS replicates real refraction and orbital depth |
| **B** | Security shield | Makes an abstract promise physical; a hero-grade moment at 78% scroll where attention normally dies |
| **C** | Final CTA particles | **2D canvas**, not WebGL. Indistinguishable, ~2% of the cost |

**Not funded — DOM/CSS/SVG instead:** scattered cards, dashboard, PSX panel, fund cards, goal cards, loan visual, bank transactions, net worth graph. Every one of these contains **text and numbers**, which is exactly what WebGL is worst at. DOM keeps them crisp, selectable, accessible, and SEO-visible.

**Rules for A and B:**
- `next/dynamic` with `ssr: false`, mounted only when within 200px of viewport
- Static poster (a rendered still) behind every canvas
- `dpr={[1, 2]}` — never 3× on phones
- Render loop pauses via IntersectionObserver when off-screen
- **Below 768px: static poster only, no canvas.** The brief's §25 asks for this
- Killed entirely under `prefers-reduced-motion`
- Combined budget: **≤ 320KB gzipped**, loaded after LCP

---

## 5. Global interaction

**Custom cursor** (desktop, pointer:fine only): 8px brass dot + 32px trailing ring, lerp 0.15. Expands to 56px with `surface-2` fill over CTAs. Collapses to a 2px line over text inputs. Hidden entirely on touch. Native cursor stays visible underneath — never `cursor: none` without a replacement in place, or you break the page for anyone the effect fails on.

**Magnetic buttons:** translate up to 8px toward pointer within a 90px radius, spring back on leave.

**Card tilt:** ±6° `rotateX/rotateY` from pointer position, `perspective: 1000px`, spring damped.

**Nav:** transparent over the hero. Past 40px: `rgba(10,11,13,0.72)` + `backdrop-filter: blur(20px)` + bottom hairline. Colour scrubs to the ink set while the paper section (06) is beneath it.

**Smooth scroll:** Lenis wired to the GSAP ticker (`DESIGN-SYSTEM.md` §5.4). Disabled on touch and under reduced motion.

---

## 6. Performance budget

| Metric | Target |
|---|---|
| LCP (hero headline) | < 2.0s on 4G |
| First-load JS, excl. 3D | < 190KB gz |
| 3D chunks | < 320KB gz, lazy, post-LCP |
| CLS | < 0.02 — reserve every animated block's height |
| Frame rate | 60fps desktop, 50fps floor on mid-range Android |
| Lighthouse perf | ≥ 90 desktop, ≥ 80 mobile |

**Enforcement:** only `transform`/`opacity` animate. `will-change` applied only while a ScrollTrigger is active, removed on complete — leaving it on permanently is itself a memory leak. All ScrollTriggers registered through one `gsap.matchMedia()` so mobile gets a reduced set and reduced-motion gets none. `ScrollTrigger.refresh()` on font load, or every trigger position is wrong by a few hundred pixels.

**Mobile degradation:** no WebGL, no custom cursor, no Lenis, no parallax float, no card tilt. Reveals and counters stay — they're cheap and carry most of the feel.

---

## 7. Component inventory

```
components/
├─ layout/        Nav · Footer · SectionShell · GroundLayer · NoiseOverlay
├─ motion/        Reveal · WordStagger · CountUp · Magnetic · Tilt
│                 ScrubProvider · Cursor · ScrollCue
├─ three/         HeroEcosystem · SecurityShield · CtaParticles(2D) · SceneFallback
├─ mock/          DashboardCard · PsxPanel · FundCard · GoalCard
│                 LoanCard · BankPanel · NetWorthChart · AllocationDonut
├─ ui/            Button · Card · Badge · Accordion · Ticker
└─ scenes/        01Hero … 13Footer
```

`ScrubProvider` owns every ScrollTrigger for a scene and disposes them on unmount — scattering `gsap.to()` calls through components is how these pages become unmaintainable by scene 06.

---

## 8. Build order

1. Scaffold: Next.js 15 + TS + Tailwind v4 + `tokens.css` + self-hosted fonts
2. `layout/` — GroundLayer, ScrubProvider, Lenis, noise, nav, footer
3. Scene 01 hero, DOM only (no WebGL) — proves the type, colour, and load sequence
4. `motion/` primitives — Reveal, WordStagger, CountUp, Magnetic, Tilt, Cursor
5. Scenes 03 → 13 in DOM. **The whole page works with zero WebGL at this point**
6. Scene 02 convergence pin — the hardest choreography, deserves its own pass
7. Scene 09 net worth pin
8. WebGL A + B, lazy, with posters
9. Responsive pass → reduced-motion pass → performance pass

Steps 1–5 give a complete, shippable, genuinely premium page. Everything after is enhancement — which means the project cannot fail on the 3D.

**Estimate:** 3–4 weeks. Roughly 2 of that is steps 1–5.
