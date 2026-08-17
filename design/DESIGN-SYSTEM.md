# PakFinance Design System — "Ink & Brass"

v1.0 · The single source of truth for every visual decision. If something isn't in here, it doesn't go in the UI.

---

## 0. The one-line brief

> A quiet, warm-dark instrument for looking at your money. Brass for the brand, ivory for the words, green only when you've made something.

Three rules that keep it from drifting into the generated look:

1. **Neutrals are never tinted with the accent.** Greys stay honest (or warm), never brass-grey.
2. **Green is functional, never decorative.** It appears on gains. Nowhere else. Ever.
3. **Brass is rare.** Roughly one brass element per viewport. It marks the single most important thing on screen.

---

## 1. Colour

### 1.1 Grounds — the section backgrounds

These are the six backdrops the scroll journey moves through. They are the *only* legal page backgrounds.

| Token | Hex | Used by |
|---|---|---|
| `ground/ink` | `#0A0B0D` | Hero, final CTA |
| `ground/slate` | `#101318` | Features |
| `ground/warm` | `#17150F` | Portfolio & markets |
| `ground/paper` | `#F2EEE6` | How it works *(the light break)* |
| `ground/pine` | `#0E1C17` | Security |

The paper section is deliberate and load-bearing — dark → light → dark mid-scroll is the single strongest "a human designed this" signal on the page. Do not remove it to "keep things consistent."

### 1.2 Surfaces (cards, panels, inputs)

On dark grounds, elevation is built from **translucent white overlays**, not from separate hex colours — so a card sits correctly on *any* ground.

| Token | Value | Use |
|---|---|---|
| `surface/1` | `rgba(255,255,255,0.035)` | Card resting |
| `surface/2` | `rgba(255,255,255,0.06)` | Card hover, input |
| `surface/3` | `rgba(255,255,255,0.09)` | Pressed, active tab |
| `border/subtle` | `rgba(234,231,224,0.08)` | Default hairline |
| `border/strong` | `rgba(234,231,224,0.16)` | Ghost button, focus-adjacent |

On `ground/paper`, invert: `rgba(20,19,15,0.04 / 0.07 / 0.10)` and borders at `rgba(20,19,15,0.12 / 0.20)`.

### 1.3 Text

| Token | On dark | On paper | Use |
|---|---|---|---|
| `text/primary` | `#EAE7E0` | `#14130F` | Headlines, values |
| `text/secondary` | `#B4B0A8` | `#3D3A33` | Body copy |
| `text/muted` | `#93908A` | `#6B675E` | Labels, captions, eyebrows |
| `text/faint` | `#65625C` | `#8E8A80` | Disabled, timestamps |

Never pure `#FFFFFF` on dark, never pure `#000000` on paper. Pure white on near-black vibrates and is the fastest way to look cheap.

### 1.4 Brand & semantic

| Token | Hex | Rules |
|---|---|---|
| `brass` | `#C9A227` | Primary CTA fill, eyebrow text, active nav, focus ring, thin rules |
| `brass/lit` | `#E6C767` | Hover state, small highlights on dark only |
| `brass/deep` | `#8E7118` | Pressed, borders on paper |
| `gain` | `#3FBF7F` | Positive numbers **only** |
| `loss` | `#E2574C` | Negative numbers **only** |
| `warning` | `#E0A33C` | Overdue installments |
| `info` | `#6E9CC4` | Neutral notices (rare) |

**Text on brass fill is always `#0A0B0D`.** Brass with white text fails contrast and looks like a discount banner.

### 1.5 Contrast floor

Body text ≥ 4.5:1, large display text ≥ 3:1, non-text UI ≥ 3:1. `text/muted #93908A` on `ground/ink` = **6.1:1**. `brass #C9A227` on `ground/ink` = **8.4:1**. Both pass. `brass` on `ground/paper` = 2.1:1 — **fails**, so on the paper section use `brass/deep #8E7118` for any brass-coloured *text*.

---

## 2. Typography

### 2.1 The three faces

| Role | Face | Why | Source |
|---|---|---|---|
| **Display** | **Instrument Serif** | High-contrast serif on a hero is the strongest single break from the generated-sans look. Warm, editorial, pairs with brass. | Google Fonts, free |
| **UI / Body** | **Satoshi** | Clean neutral grotesk with real character in the numerals. Carries the whole app. | Fontshare, free |
| **Mono / Data** | **JetBrains Mono** | Eyebrows, ticker symbols, timestamps, table micro-labels. | Google Fonts, free |

*All-sans alternative if you dislike the serif:* Display → **Clash Display** (Fontshare). Same system, different personality — geometric and confident rather than editorial.

**Self-host all three** (`next/font/local`). No external font CDN — it costs you a render-blocking round trip and a privacy footnote.

### 2.2 Scale

Fluid via `clamp()`, so one scale covers 375px → 1920px.

| Token | Size | Line height | Tracking | Face |
|---|---|---|---|---|
| `display-1` | `clamp(3rem, 8vw, 7rem)` | 0.95 | -0.03em | Display |
| `display-2` | `clamp(2.5rem, 5.5vw, 4.5rem)` | 1.0 | -0.025em | Display |
| `h1` | `clamp(2rem, 4vw, 3rem)` | 1.08 | -0.02em | Display |
| `h2` | `clamp(1.5rem, 2.6vw, 2rem)` | 1.15 | -0.015em | UI 600 |
| `h3` | `1.25rem` | 1.3 | -0.01em | UI 600 |
| `body-lg` | `clamp(1rem, 1.3vw, 1.1875rem)` | 1.6 | 0 | UI 400 |
| `body` | `0.9375rem` | 1.6 | 0 | UI 400 |
| `caption` | `0.8125rem` | 1.45 | 0 | UI 400 |
| `eyebrow` | `0.6875rem` | 1.2 | **0.18em** | Mono 500, uppercase |
| `numeric-xl` | `clamp(2rem, 4vw, 3rem)` | 1.0 | -0.02em | UI 600, **tabular** |

### 2.3 The numeric rule — non-negotiable

```css
.tabular, table, [data-numeric] { font-variant-numeric: tabular-nums; }
```

Every price, balance, percentage, quantity, and date gets this. Without it, a table of holdings **visibly jitters** on every price tick because digit widths differ. It is the fastest way to tell a real finance product from a mockup, and it costs one line.

Also: **`PKR` and `Rs` are set in the mono face at 0.75em, `text/muted`** — the currency mark recedes, the number leads.

### 2.4 Number formatting

- Group with commas: `2,450,000`
- Offer a lakh/crore toggle in settings — `24.5 lakh` is how many users actually think
- Compact form on cards: `Rs 2.45M` / `Rs 1.65M`
- Always sign deltas: `+8.42%` / `−3.10%` (use U+2212 minus, not hyphen)
- Round to 2dp for prices, 0dp for totals ≥ Rs 100,000

---

## 3. Space, radius, depth

### 3.1 Spacing — 4px base

`0 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96 · 128 · 160`

Landing section padding: `clamp(96px, 14vh, 160px)` top and bottom. **Be generous.** Cramped vertical rhythm is the second-biggest tell of a generated page after the palette.

Content max-width: `1200px`. Prose max-width: `68ch`. Headline max-width: `16ch` — display type wants to break early.

### 3.2 Radius

| Token | Value | Use |
|---|---|---|
| `radius/sm` | 8px | Chips, badges, small inputs |
| `radius/md` | 12px | Inputs, dropdowns |
| `radius/lg` | 16px | Cards |
| `radius/xl` | 24px | Feature panels, modals |
| `radius/full` | 9999px | Buttons, pills, avatars |

Pick one and stay with it per component class. Mixed radii on adjacent elements reads as sloppy instantly.

### 3.3 Depth on dark ≠ shadows

Drop shadows are nearly invisible on `#0A0B0D`. Build elevation from three things instead:

1. **Surface tint** (`surface/1 → 3`)
2. **Hairline border** (`border/subtle`)
3. **Top inner highlight** — `inset 0 1px 0 rgba(255,255,255,0.06)`. This one line does most of the work; it reads as light catching the top edge of a raised panel.

```css
.card {
  background: var(--surface-1);
  border: 1px solid var(--border-subtle);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.06),
              0 24px 64px -24px rgba(0,0,0,0.7);
}
```

**On the paper section**, use real warm shadows:
`0 1px 2px rgba(20,19,15,.05), 0 8px 24px -8px rgba(20,19,15,.10), 0 32px 64px -32px rgba(20,19,15,.14)`

### 3.4 Texture

A 3%-opacity noise overlay across the whole page (`position: fixed`, `pointer-events: none`, tiled 128px PNG or an SVG `feTurbulence`). It kills gradient banding on the dark grounds and adds a film-grain richness that flat CSS colour can't produce. Cheap, and one of the highest-return details in this document.

---

## 4. Motion

### 4.1 Tokens

| Token | Value | Use |
|---|---|---|
| `dur/instant` | 120ms | Colour/opacity on hover |
| `dur/fast` | 200ms | Buttons, small state |
| `dur/base` | 320ms | Cards, dropdowns |
| `dur/slow` | 560ms | Section reveals |
| `dur/deliberate` | 900ms | Hero entrance |
| `ease/out` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Default.** Entrances, reveals |
| `ease/inOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | Position changes both ways |
| `ease/spring` | spring(stiffness 260, damping 26) | Interactive: tilt, magnetic, drag |

Never `ease-in-out` on everything. `ease/out` on entrances is what makes motion feel expensive — fast start, long settle.

### 4.2 Only animate `transform` and `opacity`

`top`, `left`, `width`, `height`, `margin` trigger layout on every frame and will drop you to 30fps. If you think you need to animate a size, you need `scale` plus a compensating inverse scale on the child.

### 4.3 Reduced motion

```js
gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
  /* all scroll choreography lives in here */
});
```
With reduced motion on: grounds still change (instant swap, no crossfade), text is simply present, no parallax, no 3D. The page must be fully comprehensible with every animation removed.

---

## 5. The scroll architecture

This is the mechanic you described: **grounds are fixed and swap; text floats over them.**

### 5.1 Structure

```
<div class="ground-layer">        position: fixed; inset: 0; z-index: 0
  <div data-ground="ink">         6 stacked full-bleed divs
  <div data-ground="slate">       only one visible at a time
  <div data-ground="warm">
  <div data-ground="paper">
  <div data-ground="pine">
</div>

<main class="content">            position: relative; z-index: 1
  <section data-scene="hero" data-ground="ink">
  <section data-scene="features" data-ground="slate">
  ...
</main>
```

### 5.2 The three simultaneous motions

**1 · Ground crossfade (scrubbed).** Each section owns a ScrollTrigger spanning its height. Entering the top 20% of section *i*, ground *i* animates `opacity 0→1` while ground *i−1* goes `1→0`. Grounds also get a tiny `scale: 1.06 → 1` over the full section — imperceptible individually, but it stops the backdrop feeling like dead paint.

**2 · Text float (scrubbed).** Inside each section, blocks translate at *different* rates across the section's scroll length:
- Eyebrow: `y: 0 → −40px`
- Headline: `y: 0 → −90px`
- Body + CTA: `y: 0 → −140px`
- Visual/mock: `y: 0 → −30px`

The differential is what produces the floating sensation. Keep total travel under ~150px or it reads as broken layout rather than depth.

**3 · Entrance reveal (once, not scrubbed).** At `start: "top 72%"`, headline words stagger up `y: 32 → 0, opacity: 0 → 1`, 60ms stagger, `dur/slow`, `ease/out`. `once: true` — replaying on scroll-back is the #1 amateur tell.

### 5.3 Colour handoff across the paper section

Do **not** toggle a global theme class — the transition will visibly lag the ground. Instead each section scopes its own tokens, so text colour is correct by construction and needs no JS:

```css
[data-ground="paper"] {
  --text-primary: #14130F;
  --text-muted:   #6B675E;
  --border-subtle: rgba(20,19,15,0.12);
  --brass-text:   #8E7118;   /* contrast-safe on light */
}
```

The nav is the one exception — it's fixed and crosses grounds, so it *does* need a scrubbed colour swap driven by which section is under it.

### 5.4 Smooth scroll

Lenis, wired into GSAP's ticker so ScrollTrigger stays in sync:

```js
const lenis = new Lenis({ duration: 1.1, easing: t => Math.min(1, 1.001 - 2 ** (-10 * t)) })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add(t => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
```

Disable Lenis under reduced motion and on touch devices (native iOS scroll momentum is better than anything we'd fake).

---

## 6. Components

### 6.1 Buttons

| Variant | Rest | Hover | Notes |
|---|---|---|---|
| **Primary** | `brass` fill, `#0A0B0D` text, `radius/full` | `brass/lit`, `translateY(-1px)` | One per viewport |
| **Secondary** | transparent, `border/strong`, `text/primary` | `surface/2`, border → `border/strong` ×1.5 | |
| **Ghost** | transparent, no border | `surface/1` | Nav, toolbars |
| **Danger** | `loss` at 12%, `loss` text | `loss` at 20% | Delete, revoke |

Height 44px (`h-11`), padding `12px 22px`, weight 550, `dur/fast`. Focus ring: `0 0 0 2px var(--ground), 0 0 0 4px var(--brass)`.

### 6.2 Cards

`radius/lg` · `surface/1` · `border/subtle` · inner top highlight · padding 24px. Hover (interactive cards only): `surface/2` + `translateY(-2px)` over `dur/base`.

### 6.3 Data table (holdings)

Row height 52px. Zebra via `rgba(255,255,255,0.02)` — never solid stripes. Right-align every numeric column. Sticky header at `surface/2` with backdrop blur. Symbol in **mono**, company name in UI at `text/muted`.

**Price tick:** background flashes `gain`/`loss` at 14% opacity for 400ms, then fades. Never flash the text colour — it makes the number unreadable at the exact moment it changed.

### 6.4 Inputs

Height 44px, `radius/md`, `surface/2` background, `border/subtle`. Focus: border → `brass`, plus a 3px `brass` glow at 20%. Labels above at `caption`/`text/muted`. Errors in `loss` below, with the border switching to `loss` — never colour alone (colour-blind users), always colour + text.

### 6.5 OTP input

Six separate boxes, 52×60px, mono, `numeric-xl` sizing, `radius/md`, 10px gap. Auto-advance, paste-fills-all, backspace steps back. Filled box gets `border: brass`. On error, shake `x: ±6px` twice over 320ms. On success, all six flash `gain` border then the panel exits upward.

### 6.6 Nav

Fixed, 72px tall, transparent at hero top. After 40px of scroll: `background: rgba(10,11,13,0.72)`, `backdrop-filter: blur(20px)`, bottom hairline. Colours scrub to the ink set when crossing the paper section.

---

## 7. Landing page blueprint

| # | Section | Ground | Content | Motion |
|---|---|---|---|---|
| 1 | Hero | `ink` | Eyebrow · display-1 two-line headline · sub · two CTAs · dashboard mock, tilted | Word stagger in; mock parallax; scroll cue fades at 5% |
| 2 | Live ticker | `ink`→`slate` | Real PSX marquee: symbol, price, delta | Infinite marquee, pauses on hover. **Real data — instant credibility** |
| 3 | Features | `slate` | 6 cards: stocks, funds, loans, bank loans, goals, net worth | Stagger 80ms on entry; hover lift |
| 4 | Portfolio | `warm` | **Pinned.** Dashboard mock fixed while feature copy swaps beside it | Scrubbed pin, 3 copy states |
| 5 | How it works | `paper` | 3 steps: connect → log → watch | The light break. Real shadows, warm depth |
| 6 | Security | `pine` | RLS, encryption, no broker credentials stored, export anytime | SVG lock path draws on scrub |
| 7 | Numbers | `pine` | Stat row: securities tracked, funds, PKR tracked | Count-up from 0 at 60% in view |
| 8 | FAQ | `ink` | 6 accordions incl. "is my data safe", "is this investment advice" (no) | Height auto via grid-rows trick |
| 9 | CTA + footer | `ink` | display-2 close, primary CTA, disclaimer | Brass hairline sweeps in |

---

## 8. Do / Don't

**Do**
- Keep brass to one element per viewport
- Use mono for symbols, eyebrows, timestamps
- `tabular-nums` on every figure
- Let sections breathe — 96–160px vertical padding
- Ship the noise overlay
- Test on a mid-range Android over 4G

**Don't**
- Tint the greys with brass
- Use green as decoration
- Put white text on a brass fill
- Animate anything but `transform` / `opacity`
- Replay reveal animations on scroll-back
- Put 3D anywhere inside the app — landing page only
- Use pure `#FFF` or `#000`

---

## 9. Files

- `design/tokens.css` — drop-in CSS custom properties + Tailwind v4 `@theme`
- `design/palette-preview.html` — the three-direction comparison (A was chosen)
