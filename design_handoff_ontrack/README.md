# Handoff: OnTrack — Landing Page & Goals Page

## Overview
OnTrack is a goal-planning product with a single-opinionated loop: the user names a skill or habit they want to get good at, answers a few questions, and receives a weekly plan that reshuffles when they miss a day. This bundle contains two designs:

1. **Landing Page** — public marketing page introducing the product
2. **Goals Page** — in-app view listing a user's goals, with an **empty state** for first-time users and a **populated list** state

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not** production code to copy directly. Your task is to **recreate these HTML designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns, component library, and routing. If no environment exists yet, choose the most appropriate framework for the project and implement there. Do not ship the HTML files as-is.

The `.jsx` files (`app.jsx`, `sections.jsx`, `visuals.jsx`, `tweaks.jsx`) are the source files used by the Landing Page prototype via in-browser Babel — treat them as design references, not production React.

## Fidelity
**High-fidelity.** Colors, spacing, type, radii, and interaction states are final. Recreate pixel-perfectly using your codebase's existing libraries and patterns.

---

## Design Tokens

### Colors
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#F9F9F9` | Page background (warm off-white) |
| `--paper` | `#FFFFFF` | Card / surface background |
| `--ink` | `#0D0D0D` | Primary text, primary buttons |
| `--ink-60` | `rgba(13,13,13,.6)` | Secondary text |
| `--ink-40` | `rgba(13,13,13,.4)` | Tertiary text, muted labels |
| `--ink-25` | `rgba(13,13,13,.25)` | Faint text, inactive icons |
| `--ink-12` | `rgba(13,13,13,.12)` | Borders |
| `--ink-08` | `rgba(13,13,13,.08)` | Faint borders, dividers |
| `--ink-05` | `rgba(13,13,13,.05)` | Very faint surfaces, progress track |
| `--green-ink` | `#1F5E46` | Green text on light green |
| `--green-solid` | `#2F7D5E` | Primary green — CTAs, progress fill, slab underline |
| `--green-bg` | `#E8F1EC` | Light green surfaces, chip fills |
| `--green-bg-2` | `#D9E8DF` | Slightly deeper green surface |

### Typography
- **Font family**: `Epilogue` (Google Fonts), weights 400/500/600/700/800, with `system-ui, -apple-system, sans-serif` fallback
- **Display (H1)**: 44–52px, weight 800, letter-spacing -0.025em to -0.03em, line-height ~0.98
- **Section headers (H2)**: 22–36px, weight 700–800, letter-spacing -0.01em to -0.02em
- **Card titles**: 22px, weight 700, letter-spacing -0.015em
- **Body**: 14–15px, weight 400–500, line-height 1.55, color `--ink-60`
- **Small / meta**: 12–13px, color `--ink-40` or `--ink-60`
- **Micro labels**: 10–11px, weight 700, `text-transform: uppercase`, letter-spacing 0.14em–0.18em
- All product copy is **lowercase** by deliberate choice (e.g., "lets start one step at a time", "your goals")
- `text-wrap: pretty` on long headings

### Spacing
- Base unit ~4px. Common values: 4 / 6 / 8 / 10 / 12 / 14 / 18 / 22 / 28 / 36 / 40px
- Page max-width: `1180px`, horizontal padding `28px`
- Main content top padding: `36px`, bottom padding: `120px`

### Radii
- Small controls / chips: `8–12px`
- Buttons / pills: `999px` (fully rounded)
- Cards: `14–20px`
- Large hero cards: `20px`

### Shadows
- Card hover: `0 8px 24px -12px rgba(0,0,0,.08)`
- Subtle lift: `0 1px 0 rgba(0,0,0,.02)`
- Input focus ring: `0 0 0 4px var(--green-bg)`

### Motion
- Button transitions: `background .2s, border-color .2s, color .2s, transform .1s`
- Card hover: `border-color .2s, transform .15s, box-shadow .2s`, lifts `translateY(-1px)`
- Typewriter in empty state: ~55ms per char typing, ~28ms deleting, 1400ms pause at end
- Blinking caret: 1s step-end infinite

---

## Signature Visual Elements

### 1. Hand-drawn ON TRACK wordmark
Used as the product logo in the top-left of the app nav. Implemented as inline SVG — each letter is individually positioned, rotated, and skewed on a gentle arc to feel hand-drawn. The SVG block exists in `Goals Page.html` inside the `.nav-left` element — copy it verbatim rather than rebuilding.

### 2. "Slab" underline accent
A green underline behind the final word of a headline, creating a highlighter-marker effect.

```css
.slab { position: relative; display: inline-block; }
.slab::after {
  content: ""; position: absolute; left: 0; right: 0; bottom: .06em; height: .14em;
  background: var(--green-solid); border-radius: 999px; z-index: -1;
}
```

Applied to one keyword per headline — **never** more than one per heading. Examples: "lets start **one step** at a time", "3 things **in motion.**".

### 3. "i want to…" typewriter prompt
A white rounded card with a faint green focus ring that cycles through placeholder goals. Used in the empty state as a concrete visual of what's about to happen.

Cycled strings: `["learn guitar", "speak spanish", "run a 10k", "write every morning", "get stronger"]`.

### 4. Green pill CTA
Primary action = green (`--green-solid`) pill button with white text. Secondary = white pill with `--ink-12` border. Tertiary = transparent text link. Never use multiple primary CTAs on one screen.

---

## Screens / Views

### Screen 1 — Goals Page, Empty State
`section#state-empty` in `Goals Page.html`.

**Purpose**: A brand-new user, never created a goal. Onboard them to the "one thing at a time" mental model without overwhelming.

**Layout**:
- Full-width page, sticky nav at top
- Single centered column, `max-width: 560px`, `margin: 60px auto 0`
- All contents center-aligned, stacked vertically with `display: flex; flex-direction: column; align-items: center`

**Components (in order, top to bottom)**:

1. **Headline** (`.empty-h`)
   - Text: `lets start <slab>one step</slab> at a time`
   - 52px, weight 800, letter-spacing -0.03em, line-height 0.98
   - `max-width: 14ch` so it wraps naturally to 2 lines
   - Slab accent on "one step"

2. **Subhead** (`.empty-p`)
   - Text: `tell ontrack what you want to get good at. we'll plan your week around it.`
   - 15px, `--ink-60`, line-height 1.55, `max-width: 44ch`
   - `margin: 0 0 28px`

3. **Typewriter input** (`.fake-input`)
   - Rounded 14px white card, 1px `--ink-12` border, `box-shadow: 0 0 0 4px var(--green-bg)` for the green focus ring
   - Left: small uppercase label "i want to" (`--ink-40`, 11px, letter-spacing 0.1em)
   - Right: animated goal text (16px, weight 600, `--ink`) + blinking green caret
   - `max-width: 480px`, `padding: 14px 14px 14px 18px`
   - Cycling animation: types a string char-by-char, holds 1400ms, deletes char-by-char, moves to next

4. **Primary CTA** (`.btn.btn--green.btn--lg`)
   - Text: `create your first goal →`
   - Green solid pill, 14px, weight 600, padding 12px 20px, border-radius 999px
   - `margin-top: 22px`
   - Hover: background darkens to `--green-ink`

5. **Mini steps trail** (`.empty-steps`)
   - Three small inline pieces separated by em-dashes, `--ink-40`
   - Format: `<1 chip> tell us the goal — <2 chip> answer a few questions — <3 chip> get your week`
   - Number chips: 18×18 circles, `--green-bg` fill, `--green-ink` text, 10px weight 700
   - `margin-top: 40px`, 12.5px text

**Nothing else on this page.** No cards, no starters, no testimonials — the single column is the entire screen.

---

### Screen 2 — Goals Page, Populated List
`section#state-list` in `Goals Page.html`.

**Purpose**: User has one or more goals. Let them see all of them at once, open one, or add another.

**Layout**:
- Same sticky nav + main container as empty state
- **List header** (`.list-header`): flex row, title on left, `+ add goal` button on right, `margin-bottom: 32px`
- **Goals grid** (`.goals-grid`): 2-column grid, `gap: 20px`. Collapses to 1 column below 960px

**List header**:
- H1: `3 things <slab>in motion.</slab>` — 44px, weight 800, letter-spacing -0.025em
- Sub: `a quiet list. open one to see this week's plan.` — 14px, `--ink-60`
- `+ add goal` button — white pill with `--ink-12` border

**Goal card** (`.goal-card`): `padding: 28px`, `border-radius: 20px`, `background: --paper`, `1px solid --ink-08`, `min-height: 220px`, `display: flex; flex-direction: column; gap: 22px`.
On hover: `transform: translateY(-1px)`, `border-color: --ink-25`, shadow `0 8px 24px -12px rgba(0,0,0,.08)`.

Card anatomy (top → bottom):

1. **Top row** (`.goal-top`): flex, space-between
   - Left (`.goal-title-row`): 44×44 rounded-12 tile with category emoji (bg `--green-bg`, color `--green-ink`, 22px) + title block
     - Title: 22px, weight 700, letter-spacing -0.015em
     - Level/pace: 12px, `--ink-40`, e.g. "beginner · 4 hrs / week"
   - Right (`.goal-actions`): one 30×30 circular icon button (edit pencil). Completed cards show a view/eye icon instead.

2. **Progress block** (`.progress`)
   - Row: date range text ("apr 20 → may 20") on left, `46%` number (13px, weight 700) on right
   - Bar: 6px tall, `--ink-05` track, `--green-solid` fill, rounded 999px

3. **Footer row** (`.goal-foot`): flex, space-between, `margin-top: auto`
   - Meta (`.goal-foot-meta`): 12px, `--ink-40`, e.g. "**3 of 4** sessions this week" (the number bolded to `--ink`)
   - **Day dots** (`.day-dots`): 7 tiny 20×20 rounded-6 squares labeled m/t/w/t/f/s/s. Active days: `--green-bg` / `--green-ink`. Inactive: `--ink-05` / `--ink-25`.

**Completed state** (`data-status="done"`):
- Whole card background swapped to `--green-bg`, border `--green-bg-2`
- Title gets a green strikethrough (`text-decoration-color: --green-solid; text-decoration-thickness: 2px; opacity: .85`)
- Level text color overridden to `--green-ink`
- Footer becomes a summary line like "**12 books** · best streak 28 days" (no day dots)
- Action button is 👁 view-recap instead of edit

**Add-goal card** (`.add-card`): last item in the grid, same size as goal cards (`min-height: 220px`), but `border: 1.5px dashed --ink-12`, transparent background. Centered column: 40×40 circle with "+", "add another goal" strong, small subline.
Hover: border becomes `--green-solid`, background becomes `--green-bg`, text becomes `--green-ink`.

**Seed data used in the mock**:
| Emoji | Title | Level | Dates | % | Week | Days active |
|---|---|---|---|---|---|---|
| 🎸 | learn guitar | beginner · 4 hrs / week | apr 20 → may 20 | 46% | 3/4 | M W F S S |
| 🏃 | run a 10k | intermediate · 3 sessions / week | apr 01 → jun 30 | 32% | 2/3 | T T S |
| 📚 | read 12 books | completed · 13 weeks | jan 01 → mar 31 | 100% | — (summary) | — |

---

### Screen 3 — Landing Page
`Landing Page.html` with the `.jsx` companion files. Public marketing page. Uses the same tokens, wordmark, slab accent, and green CTAs. See the HTML for the full section breakdown (hero, how-it-works, features, footer). The empty-state typewriter and the slab underline both originate here — keep them consistent across the app.

---

## Navigation

Top nav is sticky, 64px tall, with a translucent backdrop-filter (`blur(10px)` over `rgba(249,249,249,.92)`).

Three-column grid: **wordmark** (left) · **tabs** (center) · **avatar + state toggle** (right).

**Tabs** (pill group inside `--ink-05` pill container): **Goals · Today · Calendar · Recap**. Active tab: black pill background, white text, small dot indicator before label. Inactive: `--ink-60` text on hover-only black.

> Note: the right-side "Empty / Goals" state toggle is a **prototype-only control** used to flip the mock between empty and populated states. Do not ship this in production — the real app renders whichever state matches the current user's data.

**Avatar**: 32×32 black circle with white monogram, weight 700, 12px.

---

## Interactions & Behavior

**Empty state**:
- Typewriter auto-plays on mount, cycles forever. Pause when `prefers-reduced-motion: reduce` is set.
- `create your first goal` → opens a goal-creation flow (out of scope here; design placeholder).

**Goals list**:
- Card click → opens goal detail view (out of scope).
- Edit pencil → inline edit modal or route to goal settings.
- `+ add goal` button (header) and `+ add another goal` card → both route to the same create-goal flow.
- Completed cards: eye icon → recap view.
- Grid is sortable in the real app (drag-reorder). Not wired in the mock.

**Hover states** — all specified in the CSS: button color shifts, card lift, add-card green tint.

**Responsive**:
- Goals grid collapses to 1 column under 960px.
- Empty state column is already narrow; it just stays centered on smaller widths.
- Nav tabs would need a mobile drawer in the real implementation (the mock shows desktop only).

**Accessibility**:
- All icon-only buttons need real `aria-label` values (mock uses "edit goal", "view recap", etc.)
- Ensure the typewriter decorative text is `aria-hidden="true"` (already set) so SRs don't read characters mid-animation
- Tabs should be a proper tablist with keyboard arrow navigation
- Color contrast: `--green-ink` on `--green-bg` passes AA; `--ink-40` on `--bg` is borderline — use it only for non-essential secondary info

---

## State Management

For the Goals page:
- `goals: Goal[]` — the user's goals
- `Goal` shape:
  ```ts
  type Goal = {
    id: string
    emoji: string
    title: string
    level: 'beginner' | 'intermediate' | 'advanced' | null
    pace: { kind: 'hoursPerWeek' | 'sessionsPerWeek', value: number }
    startDate: Date
    endDate: Date
    status: 'active' | 'completed'
    progressPct: number                  // 0–100
    weekProgress: { done: number, total: number }
    weekDays: boolean[]                  // length 7, Mon…Sun
    bestStreakDays?: number              // completed goals
    summary?: string                     // completed goals, e.g. "12 books"
  }
  ```
- Render rule: `goals.length === 0` → empty state. Otherwise → list state with one card per goal + an add-card at the end.

---

## Assets
- **Fonts**: Epilogue via Google Fonts (`https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700;800&display=swap`). Self-host in production.
- **Wordmark**: inline SVG (in `Goals Page.html`, `.nav-left`). Copy verbatim — do not redraw.
- **Category icons**: currently emoji (🎸 🏃 📚 🌍 ✍). Replace with a proper icon set in production (Lucide, Phosphor, or a custom set). Keep the 44×44 rounded-12 tile with `--green-bg` fill.
- **Avatar**: initial monogram placeholder. Replace with real user avatars.

---

## Files in this handoff
- `README.md` — this document
- `Goals Page.html` — Goals page prototype with both empty and populated states (state toggle in top-right)
- `Landing Page.html` — Landing page prototype
- `app.jsx`, `sections.jsx`, `visuals.jsx`, `tweaks.jsx` — Landing page source (in-browser Babel)

## Out of scope in this handoff
- Goal creation flow (form, question-answer steps)
- Today view, Calendar view, Recap view
- Account / profile / availability settings
- Mobile layouts
- Onboarding wizard

Ask the designer before filling these in — they're intentionally not yet designed.
