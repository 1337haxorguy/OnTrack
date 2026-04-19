# OnTrack — Claude Notes

## Brand voice & positioning

**OnTrack is for long-term skill building and habit formation** — not short-term tasks like studying for an exam or one-off projects. Goals can have no clear ending, and that's intentional.

**Target use cases**: learning an instrument, getting fit, picking up a language, starting content creation, building any skill over weeks or months.

**NOT for**: cramming for a midterm, finishing a project, one-time tasks.

**Tone**: Hope-core / aspirational. Inspire people to take the life they actually want. Speak to the guitar collecting dust, the language app they abandoned, the gym membership going unused. Make them feel seen — then show them a way forward. NOT cold, NOT feature-listy, NOT generic productivity tool.

**Tagline**: *"Your goals, at your pace."*

**Freedom over guardrails**: Don't enforce minimum timeframes or block "wrong" use cases. The framing should naturally attract the right users without turning anyone away.

---

## What the app does

OnTrack is an AI-powered goal planning app. The core loop:

1. **Create a goal** — title, skill level, timeframe, hours/week, preferred days, restrictions, requests, context.
2. **AI follow-up questions** — GPT-4o generates 3–5 clarifying questions (boolean, multiple_choice, multi_select, scale, or open_ended types). User answers interactively.
3. **Set availability** — WhenToMeet-style drag grid (6am–11pm, 30-min slots by day of week), recurring blocked events, specific blocked dates.
4. **Generate plan** — GPT-4o outputs a structured weekly schedule: dates, time blocks (e.g. "Guitar Practice · 7:00 PM"), and tasks inside each block with estimated minutes.
5. **Execute** — Today view for daily tasks. Calendar for the full week. Users can regenerate a day (with feedback), regenerate blocks for one goal, reschedule blocks, mark tasks complete.
6. **Weekly recap** — Shows completion stats. User writes optional notes for the AI, then generates next week.

---

## Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | GoalsOverview | Goal cards + Generate Plan CTA. Empty state → CreateGoal. |
| `/goals/new` | CreateGoal | Multi-step goal form. Cream theme, no dark nav. |
| `/goals/:id` | CreateGoal | Edit existing goal. Dark nav wrapper. |
| `/today` | Today | Today's time blocks + tasks. Per-block and per-task regen. |
| `/calendar` | Calendar | Week/day/month views. Manual reschedule (date + time edit). |
| `/profile` | Profile | "Schedule" in nav. Drag-grid availability + recurring/specific blocks. |
| `/recap` | Recap | End-of-week completion stats + generate next week. |
| `/account` | Account | Avatar upload, clear data, sign out. |
| `/test` | TestGenerate | Legacy dev page — old payload format. Keep working. |

---

## Theme (unified light)

The entire web app uses a single **cream/light** theme — matching the iOS onboarding aesthetic.

| Element | Class |
|---------|-------|
| Page background | `bg-[#F9F9F9]` (set in `index.css`) |
| Cards | `bg-white border-black/8 shadow-sm rounded-2xl` |
| Primary button | `bg-black text-white rounded-full hover:bg-black/80` |
| Ghost button | `border-black/10 bg-white text-black/40 rounded-full hover:border-black/20` |
| Primary text | `text-black` |
| Secondary text | `text-black/40` |
| Dividers | `border-black/6` or `divide-black/6` |
| Input fields | `bg-white border-black/10 text-black placeholder:text-black/25` |
| Day pills (selected) | `bg-black border-black text-white` |
| Day pills (unselected) | `bg-black/5 border-black/8 text-black/30` |
| Amber warnings | `bg-amber-50 border-amber-200 text-amber-700` or `text-amber-800` |
| Semantic: emerald complete | `bg-emerald-600 border-emerald-600` |
| Semantic: red error | `text-red-500` |
| Nav | `bg-[#F9F9F9]/95 backdrop-blur-md border-b border-black/8 sticky top-0` |
| Active nav underline | `bg-black h-0.5 rounded-full` |
| Spinners inside dark buttons | `border-white/30 border-t-white` (white on black bg) |

**No dark theme** — the old `bg-black`, `text-white`, `border-white/8`, `bg-white/[0.04]` pattern has been completely replaced.

---

## Architecture

### Stack
- **Client**: React 19 + TypeScript + Vite + Tailwind CSS 4 (`index.css` CSS-first, no `tailwind.config.js`)
- **Server**: Node.js + Express 5 + MongoDB (Mongoose) + OpenAI GPT-4o
- **Auth**: Auth0. Only `/api/sync-user` requires JWT. `/api/generate` accepts token but works without (guest mode).

### File map
```
client/src/
  context/AppContext.tsx     — Global state: goals, schedule, plan, avatar, dataLoaded
  pages/
    GoalsOverview.tsx        — / route
    CreateGoal.tsx           — /goals/new and /goals/:id
    Calendar.tsx             — /calendar
    Profile.tsx              — /profile (Schedule)
    Today.tsx                — /today
    Recap.tsx                — /recap
    Account.tsx              — /account
    Landing.tsx              — shown when !isAuthenticated && goals.length === 0
    TestGenerate.tsx         — /test (legacy, keep working)
  App.tsx                    — Nav shell, Routes, isGuest logic
  index.css                  — bg-[#F9F9F9] body + font-smoothing
server/src/
  routes/generate.js         — /api/generate, /api/generate/regenerate-day, /api/generate/followup-questions
```

### State
- All shared state in `AppContext`: `goals`, `schedule`, `plan`, `setPlan`, `showToast`, `avatar`, `dataLoaded`.
- Hydrated from server on load (authenticated users via `/api/sync-user`), otherwise memory/localStorage.
- `plan` = `DayPlan[]`, each with `date` string and `time_blocks` array.

### Auth / Guest mode
- `isGuest = !isAuthenticated && goals.length === 0` — show Landing only if no goals AND not logged in.
- Guests can create goals and generate without signing up.

---

## Goal type

```ts
interface Goal {
  id: string
  title: string
  skill_level: "beginner" | "intermediate" | "advanced"
  timeframe: { start_date: string; end_date: string }
  restrictions: string[]           // injuries, noise limits, equipment constraints
  requests: string[]               // warm-up, specific focus areas
  additional_context: string       // background, deadlines, detail
  followup_questions: FollowupQuestion[]
  hours_per_week: number
  has_daily_limit: boolean
  daily_limit_minutes: number
  selected_days: string[]          // which days of week for this goal
}

interface FollowupQuestion {
  question: string
  user_response: string
  type: "boolean" | "multiple_choice" | "multi_select" | "scale" | "open_ended"
  options?: string[]
}
```

---

## AI Question UI (CreateGoal.tsx)

The `QuestionInput` component (defined near the top of `CreateGoal.tsx`) handles all question types and is shared between:
- **Step 3** (new goal creation flow)
- **Edit mode** (editing an existing goal — `/goals/:id`)

Question type rendering:
| Type | UI |
|------|----|
| `boolean` | Yes / No buttons |
| `multiple_choice` | Full-width rows with radio dot — single select |
| `multi_select` | Full-width rows with checkbox — multiple selections allowed |
| `scale` | 5 numbered buttons, labelled "Not at all" → "Very much" |
| `open_ended` | Text input |

---

## Availability (Profile.tsx)

WhenToMeet-style drag grid:
- **Grid**: 6am–11pm in 30-min slots (34 rows) × 7 day columns
- **Interaction**: click to toggle, click+drag to paint/erase multiple cells
- **Storage**: grid selection is converted to/from `free_slots` format on change
- `free_slots` format: `{ monday: [{start: "09:00", end: "17:00"}], ... }` (consecutive selected slots are merged into ranges)
- Recurring commitments and specific blocked dates are still supported below the grid

---

## Backend API

### POST /api/generate (new format — current app)
```json
{
  "goals": [Goal],
  "availability": {
    "timezone": "America/New_York",
    "free_slots": { "monday": [{"start": "09:00", "end": "17:00"}] },
    "recurring_blocks": [{"id","label","days","start_time","end_time"}],
    "specific_blocks": [{"id","label","date","all_day","start_time","end_time"}]
  },
  "preferences": { "hours_per_week": 8, "sessions_per_day": 1 },
  "previous_week"?: { "total_tasks", "completed_tasks", "task_details", "notes" }
}
```
Returns: `{ weekly_tasks: [{ date, objective, time_blocks: [{ label, start_time, end_time, tasks: [{ title, description, estimated_minutes }] }] }] }`

### POST /api/generate (legacy — TestGenerate.tsx)
Detected by `user_profile.hobby_title`. Uses old prompt builder. **Do not break.**

### POST /api/generate/regenerate-day
```json
{ "date", "goals", "availability", "feedback"?, "current_day_plan"? }
```
Returns: single `DayPlan`.

### POST /api/generate/followup-questions
```json
{ "title", "skill_level", "restrictions", "requests", "additional_context" }
```
Returns: `{ questions: [{ question, type, options?, emoji? }] }`

---

## Prompt engineering notes (generate.js)

- `buildNewFormatMessage()` sends ALL goal context: restrictions, requests, `additional_context`, Q&A pairs, hours/week, daily limit, preferred days.
- `days_per_week` = union of `selected_days` across goals (fallback to count of `free_slots` keys).
- Total hours = sum of `goal.hours_per_week`.
- Key AI instruction: "A user who says they already know basics should NOT get beginner content."

---

## Goal attribution

`attributeBlocks()` in `GoalsOverview.tsx` tags each `TimeBlock` with the `goal_id` of the most likely goal (word overlap heuristic). This enables per-goal regeneration. Breaks for single-word or very generic goal titles.

---

## Landing page structure (onboarding flow)

The landing page is a 4-slide auto-advancing carousel (4s per slide). Slide order is intentional — emotional hook first, then how-it-works:

| Slide | Label | Purpose |
|-------|-------|---------|
| 0 | "finally." | Emotional hook. `VisualTypewriter` cycles through goal examples. CTA: "Show me →" |
| 1 | "step 1" | Tell us your goal. `VisualGoals` card list. CTA: "See how it works →" |
| 2 | "step 2" | AI personalization. `VisualQuestions` chat with typing indicator. CTA: "See how it works →" |
| 3 | "step 3" | Weekly plan output. `VisualPlan` with staggered block animations. Last slide → sign up CTAs |

**Auto-advance**: `useEffect` + `setInterval`, stops on last slide. `progressKey` remounts the progress bar CSS animation on each slide change. `goToSlide()` resets the timer everywhere (dots, swipe, Next button).

**Animations** (defined in `index.css`): `fadeInUp`, `fadeIn`, `blink`, `progressBar`.

**`renderVisual` is a factory function** (not a pre-rendered element) — ensures visual components remount and replay animations on every slide transition.

**Goal creation onboarding**: Step 1 of `CreateGoal.tsx` has a subtle italic line above the title input: *"OnTrack is built for long-term growth — skills and habits you want to genuinely develop over weeks and months."* — styled `text-xs text-black/30 italic`, only shown on new goal creation (not edit mode).

---

## Important gotchas

1. **Legacy TestGenerate format**: `generate.js` has a branch for `user_profile.hobby_title`. Leave it.
2. **`/goals/new` early return**: handled in `App.tsx` before `<Routes>` — cream theme + separate header. Don't move into `<Routes>`.
3. **`isGuest` check**: Landing only shows when `!isAuthenticated && goals.length === 0`. Guests with goals see the full app — intentional.
4. **`isPlanStale`**: GoalsOverview checks if every plan day is before today → shows Recap banner.
5. **`dataLoaded` guard**: most protected routes render nothing until `dataLoaded` is true. Don't remove.
6. **Profile grid sync**: `Profile.tsx` keeps grid in local state (with a ref for drag performance) and syncs to `free_slots` on every change. When `free_slots` changes externally (server hydration), a `useEffect` re-derives the grid.
7. **No `tailwind.config.js`**: Tailwind CSS 4 CSS-first config. All config lives in `index.css`. Use `bg-black/[0.04]` syntax for non-standard opacities. Double-opacity classes like `border-white/10/60` are invalid.

---

## Common tasks

| Task | File(s) |
|------|---------|
| Change AI prompt / output format | `server/src/routes/generate.js` |
| Add a question type | `AppContext.tsx` (QuestionType), `CreateGoal.tsx` (QuestionInput), iOS `Models.swift` + `AIQuestionStepView.swift` |
| Add a field to Goal | `AppContext.tsx` (type), `CreateGoal.tsx` (form), `generate.js` (prompt), iOS `Models.swift` |
| Change plan display | `Calendar.tsx`, `Today.tsx` |
| Change availability UI | `Profile.tsx` |
| Change landing/onboarding | `Landing.tsx`, `App.tsx` (isGuest logic) |
| Change brand copy / tone | `Landing.tsx` (`SLIDES` array + `VisualTypewriter`), `CreateGoal.tsx` (step 1 subtitle) |
| Change goal cards | `GoalsOverview.tsx` |
| Change theme tokens | Search for `bg-white shadow-sm`, `bg-black text-white rounded-full` across pages |

---

## iOS app

Native SwiftUI app at `OnTrackIOS/`. Hits the same backend. See `OnTrackIOS/CLAUDE.md` for full iOS design system, component patterns, and architecture.

Auth0 domain, client ID, backend URLs: `memory/project_ios_config.md`.

iOS question UI (`AIQuestionStepView.swift`): uses `MultipleChoiceRow` for boolean/multiple_choice/multi_select (tap to select/toggle), scale input, and text field for open_ended. Web matches this with the shared `QuestionInput` component.
