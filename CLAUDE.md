# OnTrack — Claude Notes

## What the app actually does

OnTrack is an AI-powered goal planning app. The core loop:

1. **User creates a goal** — they name it (e.g. "learn guitar"), set their skill level, timeframe, hours/week, preferred days, any restrictions (injuries, equipment limits), and specific requests (focus areas, warm-up preferences).
2. **AI asks follow-up questions** — the backend calls GPT-4o to generate 3–5 clarifying questions tailored to that specific goal. The user answers them in a chat-like UI.
3. **User sets their availability** — free time slots by day of week, recurring blocked events (gym class every Tuesday), and specific blocked dates.
4. **AI generates a full week plan** — GPT-4o takes all goal context + availability and outputs a structured weekly schedule: specific dates, time blocks (e.g. "Guitar Practice · 7:00 PM"), and individual tasks inside each block with estimated minutes.
5. **User executes and iterates** — Today view shows today's tasks. Calendar shows the full week. Users can regenerate a single day (with or without feedback), regenerate blocks for one specific goal, reschedule a time block, or mark tasks complete.
6. **Weekly recap + new week** — When the plan expires, a recap view shows what was completed vs missed. User can generate a fresh week.

## Pages and their purpose

| Route | Page | Purpose |
|-------|------|---------|
| `/` | GoalsOverview | Lists all goals + Generate Plan button. Empty state leads to CreateGoal. |
| `/goals/new` | CreateGoal | Full goal creation form — title, skill level, timeframe, restrictions, requests, context, AI Q&A, hours/week, days, daily limit. Light cream theme (not dark nav). |
| `/goals/:id` | CreateGoal | Same form, editing an existing goal. Dark nav wrapper. |
| `/today` | Today | Shows today's time blocks + tasks. Per-block and per-task regen with feedback. Task editing. |
| `/calendar` | Calendar | Week/day/month views. Drag-reschedule not implemented, but manual date+time edit for blocks. |
| `/profile` | Profile | Labeled "Schedule" in nav. User sets free slots + recurring/specific blocks. |
| `/recap` | Recap | End-of-week review. Shows completion stats, lets user generate new plan. |
| `/account` | Account | Avatar upload, basic account settings. |
| `/test` | TestGenerate | Legacy dev page. Keep working — uses old payload format. |

## Key architectural facts

### Auth
- Auth0. Only `/api/sync-user` requires JWT. `/api/generate` accepts a token but works without one (guest mode).
- Guest users can create goals and generate a plan without signing up. They're nudged to sign up via a banner on GoalsOverview.
- `isGuest = !isAuthenticated && goals.length === 0` — only show Landing if user has no goals AND isn't logged in.

### State
- All shared state lives in `AppContext` (`client/src/context/AppContext.tsx`): `goals`, `schedule`, `plan`, `setPlan`, `showToast`, `avatar`, `dataLoaded`.
- State is hydrated from the server on load if authenticated (via `/api/sync-user`), otherwise lives only in memory/localStorage.
- The `plan` is an array of `DayPlan` objects, each with a `date` string and `time_blocks` array.

### Two generate payload formats
- **New format** (current app): `{ goals, availability, preferences }` — detected when `user_profile.hobby_title` is absent.
- **Legacy format** (TestGenerate.tsx): detected by presence of `user_profile.hobby_title`. Keep this path working in `generate.js`.

### Goal attribution on plan
`attributeBlocks()` in `GoalsOverview.tsx` tags each `TimeBlock` with the `goal_id` of the most likely goal (word overlap heuristic). This enables per-goal regeneration.

### iOS app
There is a native iOS app (SwiftUI) at `OnTrackIOS/`. It hits the same backend. Auth0 domain, client ID, and backend URLs are documented in `memory/project_ios_config.md`.

## Prompt engineering notes (generate.js)

- `buildNewFormatMessage()` sends ALL goal fields to GPT: restrictions, requests, `additional_context`, Q&A pairs, hours/week, daily limit minutes, preferred days.
- `days_per_week` is the union of `selected_days` across all goals (falls back to count of `free_slots` keys).
- Total hours = sum of `goal.hours_per_week`.
- Critical instruction sent to GPT: "A user who says they already know basics should NOT get beginner content."
- Single-day regeneration endpoint: `POST /api/generate/regenerate-day` — takes `{ date, goals, availability, feedback?, current_day_plan? }`, returns one `DayPlan`.

## UI conventions

- **Landing / CreateGoal (/goals/new)**: cream (`#F9F9F9`) background, black text — light theme.
- **All other pages**: dark (`bg-black` / dark gray) with white text — dark theme.
- Nav is sticky, dark, `bg-black/90 backdrop-blur-md`.
- Tailwind CSS 4. No `tailwind.config.js` — uses CSS-first config in `index.css`.
- Rounded full buttons, rounded-2xl cards, `border-white/8` or `border-black/8` for subtle borders.

## Things to be careful about

1. **Don't break the legacy TestGenerate format.** `generate.js` has a branch for `user_profile.hobby_title`. Leave it.
2. **`/goals/new` is rendered outside the dark nav wrapper.** It's handled by an early-return in `App.tsx` before the main `<Routes>`. Don't move it into `<Routes>` or it loses the cream theme + header.
3. **`isGuest` check**: the Landing only shows when `!isAuthenticated && goals.length === 0`. If a guest creates a goal, they see the dark app — this is intentional.
4. **Plan staleness**: `isPlanStale` in GoalsOverview checks if every day in the plan is before today. Stale plans show the Recap banner.
5. **`dataLoaded` guard**: most protected routes render nothing until `dataLoaded` is true. Don't remove this guard or you'll flash empty states.
6. **`attributeBlocks` depends on goal title words**: the word-overlap heuristic breaks for single-word goals or very generic titles. The `goal_id` on each block is what makes per-goal regen work.

## Common tasks and where to look

| Task | File(s) |
|------|---------|
| Change AI prompt / output format | `server/src/routes/generate.js` |
| Add a field to Goal | `AppContext.tsx` (type), `CreateGoal.tsx` (form), `generate.js` (prompt), iOS `Models.swift` |
| Change how plan is displayed | `Calendar.tsx`, `Today.tsx` |
| Change schedule UI | `Profile.tsx` |
| Change landing/onboarding | `Landing.tsx`, `App.tsx` (the isGuest logic) |
| Change goal cards | `GoalsOverview.tsx` |
| AI follow-up questions | `CreateGoal.tsx` + `AIQuestionStepView.swift` (iOS) |
