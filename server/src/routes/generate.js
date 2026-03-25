const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

const SYSTEM_PROMPT =
`You are a routine-planning engine that generates weekly schedules for general hobbies.

Your role is to create structured, practical, and realistic weekly routines based on validated user input, prior weekly context, and user feedback.

SCOPE:
- You generate exactly ONE week of a routine per request.
- You do NOT generate multi-week plans in a single response.
- You do NOT provide explanations, commentary, or advice outside the requested routine.

INPUT HANDLING:
- The user input is authoritative and already validated.
- Do not invent goals, restrictions, preferences, or constraints not present in the input.
- Previous weeks and user feedback are provided as context and should influence pacing, intensity, and structure for the current week only.
- Do not modify or restate past weeks.

CONSTRAINTS:
- All numerical, scheduling, and structural constraints in the user input MUST be respected.
- If constraints are tight or conflicting, generate the closest valid routine that satisfies the schema and honors the user's intent.
- Prefer consistency and sustainability over intensity unless explicitly requested otherwise.

OUTPUT RULES:
- The output MUST strictly conform to the provided JSON schema.
- Dates, counts, and durations must be internally consistent.

FAILURE HANDLING:
- If any constraint cannot be perfectly satisfied, still return a valid JSON object that follows the schema and best satisfies the constraints.
- Do not ask clarifying questions.
- Do not output partial data.

You are a deterministic planning system, not a conversational assistant.`;

const OUTPUT_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "task_plan",
    strict: true,
    schema: {
        "type": "object",
        "properties": {
          "weekly_tasks": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "date": {
                  "type": "string",
                  "format": "date",
                  "description": "The date for the day's tasks (yyyy-mm-dd format)"
                },
                "objective": {
                  "type": "string",
                  "description": "General overview explaining the main purpose and goals for the given day"
                },
                "time_blocks": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "label": {
                        "type": "string",
                        "description": "Short title which tells the user the main purpose/focus of this time block"
                      },
                      "start_time": {
                        "anyOf": [
                          {
                            "type": "string",
                            "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
                          },
                          {
                            "type": "null"
                          }
                        ],
                        "description": "HH:MM format in military time OR null if the user's prefers_time_blocks value is false"
                      },
                      "end_time": {
                        "anyOf": [
                          {
                            "type": "string",
                            "pattern": "^([0-1][0-9]|2[0-3]):[0-5][0-9]$"
                          },
                          {
                            "type": "null"
                          }
                        ],
                        "description": "HH:MM format in military time OR null if the user's prefers_time_blocks value is false"
                      },
                      "tasks": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "title": {
                              "type": "string",
                              "description": "A title which briefly describes the given task"
                            },
                            "description": {
                              "type": "string",
                              "description": "In-depth notes detailing exactly what the user needs to do in order to complete the current task"
                            },
                            "estimated_minutes": {
                              "type": "integer",
                              "minimum": 0,
                              "description": "An integer value that estimates how long this task should take the user to complete"
                            }
                          },
                          "required": [
                            "title",
                            "description",
                            "estimated_minutes"
                          ],
                          "additionalProperties": false
                        },
                        "minItems": 1,
                        "description": "List of tasks for this time block"
                      }
                    },
                    "required": [
                      "label",
                      "start_time",
                      "end_time",
                      "tasks"
                    ],
                    "additionalProperties": false
                  },
                  "minItems": 1,
                  "description": "List of time blocks for the day"
                }
              },
              "required": [
                "date",
                "objective",
                "time_blocks"
              ],
              "additionalProperties": false
            },
            "minItems": 1,
            "description": "List of daily tasks for the week"
          }
        },
        "required": [
          "weekly_tasks"
        ],
        "additionalProperties": false
    },
  },
};

// ---- Availability helpers ----

function timeToMins(t) {
  const [h, m] = (t || "00:00").split(":").map(Number);
  return h * 60 + (m || 0);
}

function minsToTime(m) {
  if (m >= 24 * 60) return "24:00";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// Subtract a blocked interval [blockStart, blockEnd) from a list of free windows.
function subtractInterval(windows, blockStart, blockEnd) {
  const result = [];
  for (const w of windows) {
    if (blockEnd <= w.start || blockStart >= w.end) {
      result.push(w);
    } else {
      if (blockStart > w.start) result.push({ start: w.start, end: blockStart });
      if (blockEnd < w.end) result.push({ start: blockEnd, end: w.end });
    }
  }
  return result;
}

// Returns available windows (array of {start, end} in minutes) for a specific date.
function computeAvailableWindows(dateStr, free_slots, recurring_blocks, specific_blocks) {
  const dayOfWeek = new Date(dateStr + "T00:00:00")
    .toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  // All-day specific block → nothing available
  const allDayBlock = (specific_blocks || []).find(sb => sb.date === dateStr && sb.all_day);
  if (allDayBlock) return [];

  const rawFree = (free_slots || {})[dayOfWeek] || [];
  let windows = rawFree.length > 0
    ? rawFree.map(s => ({ start: timeToMins(s.start), end: timeToMins(s.end) }))
    : [{ start: 0, end: 24 * 60 }]; // no defined slots → treat as open all day

  // Subtract recurring blocks for this day-of-week
  for (const rb of (recurring_blocks || [])) {
    if ((rb.days || []).includes(dayOfWeek)) {
      windows = subtractInterval(windows, timeToMins(rb.start_time), timeToMins(rb.end_time));
    }
  }

  // Subtract specific (non-all-day) blocks for this exact date
  for (const sb of (specific_blocks || [])) {
    if (sb.date === dateStr && !sb.all_day) {
      windows = subtractInterval(windows, timeToMins(sb.start_time), timeToMins(sb.end_time));
    }
  }

  return windows.filter(w => w.end - w.start > 0);
}

// Drop past days and shift/drop today's blocks that have already passed.
function enforceAfterNow(result, timezone) {
  const tz = timezone || "UTC";
  const now = new Date();

  // Today's date string in the user's timezone (YYYY-MM-DD via en-CA locale)
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);

  // Current time in minutes in the user's timezone
  const timeParts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const nowHour = parseInt(timeParts.find(p => p.type === "hour").value);
  const nowMin  = parseInt(timeParts.find(p => p.type === "minute").value);
  const nowMins = nowHour * 60 + nowMin;
  // Round up to the next 15-minute mark for a clean block start
  const startFloor = Math.ceil(nowMins / 15) * 15;

  result.weekly_tasks = (result.weekly_tasks || [])
    // Drop days that have already passed
    .filter(day => day.date >= todayStr)
    .map(day => {
      // Future days need no adjustment
      if (day.date !== todayStr) return day;

      const adjustedBlocks = (day.time_blocks || []).filter(block => {
        // Untimed blocks have no start/end — leave them alone
        if (!block.start_time || !block.end_time) return true;

        const blockEnd   = timeToMins(block.end_time);
        const blockStart = timeToMins(block.start_time);
        const duration   = blockEnd - blockStart;

        // Block has already ended — drop it
        if (blockEnd <= nowMins) return false;

        // Block started in the past but hasn't ended — shift it forward
        if (blockStart < startFloor) {
          const newEnd = startFloor + duration;
          // Would push past midnight — drop it
          if (newEnd > 24 * 60) return false;
          block.start_time = minsToTime(startFloor);
          block.end_time   = minsToTime(newEnd);
        }

        return true;
      });

      return { ...day, time_blocks: adjustedBlocks };
    })
    // Drop days that have no time blocks left after adjustment
    .filter(day => (day.time_blocks || []).length > 0);

  return result;
}

// Move any time block that falls outside available windows into a valid window.
// Called after reconcileBlockTimes so durations are already correct.
function enforceAvailableWindows(result, availability) {
  const { free_slots = {}, recurring_blocks = [], specific_blocks = [] } = availability || {};

  for (const day of result.weekly_tasks || []) {
    const windows = computeAvailableWindows(day.date, free_slots, recurring_blocks, specific_blocks);
    if (windows.length === 0) continue; // no windows → leave as-is (edge case)

    for (const block of day.time_blocks || []) {
      if (!block.start_time || !block.end_time) continue;

      const blockStart = timeToMins(block.start_time);
      const blockEnd = timeToMins(block.end_time);
      const duration = blockEnd - blockStart;

      // Already fits within an available window — nothing to do
      if (windows.some(w => blockStart >= w.start && blockEnd <= w.end)) continue;

      // Find the first window wide enough to hold the block
      const fitWindow = windows.find(w => (w.end - w.start) >= duration);
      if (fitWindow) {
        block.start_time = minsToTime(fitWindow.start);
        block.end_time = minsToTime(fitWindow.start + duration);
      } else {
        // No window is wide enough — fit into the largest available window, clipping end
        const largest = windows.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
        block.start_time = minsToTime(largest.start);
        block.end_time = minsToTime(Math.min(largest.start + duration, largest.end));
      }
    }
  }
  return result;
}

// Recalculates each time block's end_time to exactly match start_time + sum(task estimated_minutes).
// The AI often leaves gaps between task durations and block duration — this fixes that.
function reconcileBlockTimes(result) {
  for (const day of result.weekly_tasks || []) {
    for (const block of day.time_blocks || []) {
      if (!block.start_time) continue;
      const totalMinutes = (block.tasks || []).reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);
      if (totalMinutes === 0) continue;
      const [h, m] = block.start_time.split(":").map(Number);
      const endTotal = h * 60 + m + totalMinutes;
      const endH = Math.floor(endTotal / 60) % 24;
      const endM = endTotal % 60;
      block.end_time = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    }
  }
  return result;
}

// Build prompt from new structured format (App.tsx)
function buildNewFormatMessage(goals, availability, preferences, previousWeek) {
  const { timezone = "UTC", free_slots = {}, recurring_blocks = [], specific_blocks = [] } = availability;
  const { sessions_per_day = 1 } = preferences || {};

  // Determine date range from goals
  let startDate = null;
  let endDate = null;
  for (const goal of goals) {
    if (!goal.timeframe?.start_date || !goal.timeframe?.end_date) continue;
    const s = new Date(goal.timeframe.start_date + "T00:00:00");
    const e = new Date(goal.timeframe.end_date + "T00:00:00");
    if (!startDate || s < startDate) startDate = s;
    if (!endDate || e > endDate) endDate = e;
  }

  if (!startDate || !endDate) {
    startDate = new Date();
    endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
  }

  // days_per_week: union of selected_days across goals, fallback to free_slots,
  // fallback to all 7 days if neither is specified
  const ALL_DAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const allSelectedDays = new Set();
  for (const goal of goals) {
    (goal.selected_days || []).forEach(d => allSelectedDays.add(d));
  }
  const daysWithSlots = Object.entries(free_slots).filter(([, slots]) => Array.isArray(slots) && slots.length > 0);
  const activeDays = allSelectedDays.size > 0
    ? Array.from(allSelectedDays).map(d => [d, free_slots[d] || []])
    : daysWithSlots.length > 0
    ? daysWithSlots
    : ALL_DAYS.map(d => [d, []]);  // no schedule set → assume all 7 days open
  const days_per_week = activeDays.length;

  // Total hours: sum per-goal commitments
  const totalHours = goals.reduce((s, g) => s + (g.hours_per_week || 2), 0);

  // Build rich goal descriptions with all context
  const goalDescs = goals.map(g => {
    const lines = [
      `- "${g.title}" | Level: ${g.skill_level} | ${g.timeframe?.start_date} → ${g.timeframe?.end_date} | ${g.hours_per_week || 2} hrs/week`,
    ];
    if (g.selected_days?.length > 0) {
      lines.push(`  Preferred days: ${g.selected_days.join(", ")}`);
    }
    if (g.has_daily_limit && g.daily_limit_minutes) {
      lines.push(`  Daily limit: max ${g.daily_limit_minutes} min/day`);
    }
    if (g.restrictions?.length > 0) {
      lines.push(`  Restrictions: ${g.restrictions.join(" | ")}`);
    }
    if (g.requests?.length > 0) {
      lines.push(`  Requests: ${g.requests.join(" | ")}`);
    }
    if (g.additional_context) {
      lines.push(`  Context: ${g.additional_context}`);
    }
    if (g.followup_questions?.length > 0) {
      lines.push("  Q&A:");
      for (const fq of g.followup_questions) {
        lines.push(`    Q: ${fq.question}`);
        lines.push(`    A: ${fq.user_response}`);
      }
    }
    return lines.join("\n");
  }).join("\n\n");

  // Compute exact available windows per scheduled date
  const scheduledDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  const windowsPerDate = scheduledDates.map(dateStr => {
    const windows = computeAvailableWindows(dateStr, free_slots, recurring_blocks, specific_blocks);
    const dayName = new Date(dateStr + "T00:00:00")
      .toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    const isActive = activeDays.some(([d]) => d === dayName);
    if (!isActive) return null; // not a scheduled day for any goal
    if (windows.length === 0) return `  ${dateStr} (${dayName}): UNAVAILABLE — do not schedule`;
    const windowStr = windows.map(w => `${minsToTime(w.start)}–${minsToTime(w.end)}`).join(", ");
    return `  ${dateStr} (${dayName}): ${windowStr}`;
  }).filter(Boolean).join("\n");

  const hardMaxMinutes = totalHours * 60;
  const targetPerDay = Math.round(hardMaxMinutes / days_per_week);
  const maxBlocksPerDay = sessions_per_day >= 2 ? 2 : 1;

  let previousWeekSection = "";
  if (previousWeek && previousWeek.total_tasks > 0) {
    const rate = Math.round((previousWeek.completed_tasks / previousWeek.total_tasks) * 100);
    const completed = (previousWeek.task_details || []).filter(t => t.completed).map(t => `  ✓ ${t.title} (${t.block})`).join("\n");
    const skipped = (previousWeek.task_details || []).filter(t => !t.completed).map(t => `  ✗ ${t.title} (${t.block})`).join("\n");
    previousWeekSection = `

PREVIOUS WEEK CONTEXT:
Completion rate: ${rate}% (${previousWeek.completed_tasks}/${previousWeek.total_tasks} tasks)${previousWeek.notes ? `\nUser notes: "${previousWeek.notes}"` : ""}${completed ? `\nCompleted:\n${completed}` : ""}${skipped ? `\nSkipped:\n${skipped}` : ""}
Adjust next week's intensity, volume, and focus accordingly — if completion was low, reduce volume or simplify tasks; if high, increase intensity.`;
  }

  return `TASK:
Generate the routine for EXACTLY one week starting from ${startDate.toISOString().split("T")[0]}.

GOALS:
${goalDescs}

SCHEDULING WINDOWS (these are the ONLY times the user is available — do NOT schedule outside these windows):
${windowsPerDate}

TIMEZONE: ${timezone}

CONSTRAINTS:
- Generate exactly ${days_per_week} day entries in weekly_tasks, one per available date listed above
- Skip any date marked UNAVAILABLE
- CRITICAL: Every time block MUST start and end within one of the listed windows for that date — no exceptions
- Honor per-goal daily limits if specified
- CRITICAL TIME CONSTRAINT: The SUM of every estimated_minutes value across ALL tasks in ALL days MUST NOT exceed ${hardMaxMinutes} minutes total. Do NOT go over ${hardMaxMinutes} minutes. Aim for approximately ${targetPerDay} minutes per day across ${days_per_week} days.
- Each day should have 1–${maxBlocksPerDay} time block(s)
- CRITICAL: Each time block must contain tasks for ONLY ONE goal. Never mix tasks from different goals in the same block. If multiple goals are scheduled on the same day, give each goal its own separate block.
- CRITICAL: Never schedule passive or non-actionable activities as time blocks. This includes rest days, active recovery, stretching cooldowns, "take it easy" days, hydration reminders, or any block whose sole purpose is to not do something. If a goal requires rest on a given day, simply do not schedule that goal on that day — omit it entirely rather than filling the slot with a placeholder.
- Every time block MUST include non-null start_time and end_time in HH:MM 24-hour format
- Strictly respect each goal's restrictions (do not assign tasks that violate them)
- Incorporate each goal's requests into the session structure
- Use Q&A responses and additional context to tailor difficulty, content, and focus — a user who says they already know basics should NOT get beginner content
- Output JSON only and strictly conform to the provided output schema.${previousWeekSection}`;
}

router.post("/", async (req, res) => {
  const { user_profile, goals, availability, preferences, generation_request, previous_week } = req.body;

  let userMessage;

  if (user_profile && user_profile.hobby_title) {
    // Legacy format (TestGenerate.tsx)
    const p = user_profile;
    const week_index = generation_request?.week_index || 1;

    const inputJson = JSON.stringify({
      hobby_title: p.hobby_title,
      goals: p.goals,
      restrictions: p.restrictions,
      requests: p.requests,
      additional_context: p.additional_context,
      followup_questions: p.followup_questions,
      timezone: p.timezone,
      start_date: p.start_date,
      target_end_date: p.target_end_date,
      days_per_week: p.days_per_week,
      prefers_time_blocks: p.prefers_time_blocks,
      min_intraday_frequency: p.min_intraday_frequency,
      max_intraday_frequency: p.max_intraday_frequency,
      min_hours_per_week: p.min_hours_per_week,
      max_hours_per_week: p.max_hours_per_week,
    }, null, 2);

    const timeBlockRule = p.prefers_time_blocks
      ? "- Because prefers_time_blocks = true, every time block MUST include non-null start_time and end_time in HH:MM 24-hour format."
      : "- Because prefers_time_blocks = false, every time block MUST have start_time and end_time set to null.";

    userMessage =
`TASK:
Generate the routine for EXACTLY one week.

AUTHORITATIVE USER INPUT:
The following JSON has been validated against the input schema and must be treated as complete and authoritative.
Do not invent, infer, or assume any information beyond what is explicitly provided.

${inputJson}

TARGET:
Generate the routine for week_index = ${week_index} only.

REQUIREMENTS:
- Follow all constraints defined in the authoritative user input.
- Use responses from followup_questions to refine focus, pacing, and task selection.
- daily_tasks MUST contain EXACTLY ${p.days_per_week} entries.
- time_blocks per day MUST be within [${p.min_intraday_frequency}, ${p.max_intraday_frequency}].
- CRITICAL TIME CONSTRAINT: The SUM of every estimated_minutes value across ALL tasks in ALL days of the week MUST be >= ${p.min_hours_per_week * 60} and <= ${p.max_hours_per_week * 60}. Do NOT exceed ${p.max_hours_per_week * 60} total minutes. Aim for roughly ${Math.round(p.min_hours_per_week * 60 / p.days_per_week)}-${Math.round(p.max_hours_per_week * 60 / p.days_per_week)} minutes per day.
${timeBlockRule}
- Output JSON only and strictly conform to the provided output schema.
`;
  } else if (goals && availability) {
    // New format (App.tsx)
    userMessage = buildNewFormatMessage(goals, availability, preferences, previous_week);
  } else {
    return res.status(400).json({ error: "Invalid request: provide either user_profile (legacy) or goals + availability." });
  }

  console.log("\n=== GENERATE PLAN ===");
  console.log("Goals:", goals?.map(g => ({
    title: g.title,
    skill_level: g.skill_level,
    hours_per_week: g.hours_per_week,
    selected_days: g.selected_days,
    timeframe: g.timeframe,
    has_daily_limit: g.has_daily_limit,
    daily_limit_minutes: g.daily_limit_minutes,
  })));
  console.log("Timezone:", availability?.timezone);
  console.log("Free slots:", JSON.stringify(availability?.free_slots, null, 2));
  console.log("Recurring blocks:", availability?.recurring_blocks);
  console.log("Specific blocks:", availability?.specific_blocks);
  console.log("Prompt:\n", userMessage);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: OUTPUT_SCHEMA,
    });

    const tz = availability?.timezone || "UTC";
    const raw = reconcileBlockTimes(JSON.parse(completion.choices[0].message.content));
    console.log("AI raw output:", JSON.stringify(raw, null, 2));
    const afterEnforce = enforceAfterNow(raw, tz);
    console.log("After enforceAfterNow:", JSON.stringify(afterEnforce, null, 2));
    const result = enforceAvailableWindows(afterEnforce, availability);
    console.log("After enforceAvailableWindows:", JSON.stringify(result, null, 2));
    console.log("=== END GENERATE ===\n");
    res.json(result);
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to generate plan." });
  }
});

router.post("/regenerate-day", async (req, res) => {
  const { date, current_day_plan, feedback, goals, availability, preserve_times } = req.body;

  if (!date || !goals || !availability) {
    return res.status(400).json({ error: "date, goals, and availability are required." });
  }

  const dayOfWeek = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const { free_slots = {}, recurring_blocks = [], specific_blocks = [] } = availability;

  const availableWindows = computeAvailableWindows(date, free_slots, recurring_blocks, specific_blocks);
  const windowsDesc = availableWindows.length > 0
    ? availableWindows.map(w => `${minsToTime(w.start)}–${minsToTime(w.end)}`).join(", ")
    : "none — day is fully blocked";

  const goalDescs = goals.map(g => `- "${g.title}" (${g.skill_level})`).join("\n");

  const userMessage =
`TASK:
Regenerate the schedule for ${date} (${dayOfWeek}).

GOALS:
${goalDescs}

AVAILABLE WINDOWS ON THIS DAY (schedule ONLY within these times):
${windowsDesc}
${feedback ? `\nUSER FEEDBACK:\n${feedback}` : ""}
${current_day_plan ? `\nCURRENT SCHEDULE TO REPLACE:\n${JSON.stringify(current_day_plan, null, 2)}` : ""}

CONSTRAINTS:
- Generate EXACTLY 1 entry in weekly_tasks for date ${date}
- Include 1–2 time blocks
- CRITICAL: Every time block MUST start and end within one of the available windows listed above
- CRITICAL: Never schedule passive or non-actionable activities (rest, active recovery, cooldowns, hydration reminders). If the plan calls for rest, omit that block entirely.
- Every time block MUST have start_time and end_time in HH:MM 24-hour format
- Output JSON only and strictly conform to the provided output schema.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: OUTPUT_SCHEMA,
    });

    const tz = availability?.timezone || "UTC";
    let result = reconcileBlockTimes(JSON.parse(completion.choices[0].message.content));
    if (!preserve_times) result = enforceAfterNow(result, tz);
    result = enforceAvailableWindows(result, availability);
    const dayPlan = result.weekly_tasks?.[0] ?? null;
    res.json(dayPlan);
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to regenerate day." });
  }
});

const FOLLOWUP_SYSTEM_PROMPT =
`You are an AI that specializes in building personalized routines for users to follow for any hobby or special interest.

Your task is to generate a short list of follow-up questions (up to 5 maximum) that are important for building a strong, personalized routine for the user. Questions should be highly specific to the goal and have a notable impact on how the routine would be constructed.

Do NOT ask about timeline, daily/weekly frequency, or total time to commit — those are handled separately.

For each question, decide:
1. Whether it is mandatory (true if answering would significantly change the structure, content, or safety of the routine).
2. The best input type for the question:
   - "boolean": yes/no questions (e.g. "Do you have access to a gym?")
   - "multiple_choice": pick exactly one from a short list of distinct options (e.g. skill sub-level, training style, preferred focus area). Provide 3–5 concise options.
   - "multi_select": pick any number from a list (e.g. available equipment, areas to focus on). Provide 3–6 concise options.
   - "scale": a 1–5 intensity/comfort rating (e.g. "How comfortable are you with X?")
   - "open_ended": free-text, for questions that can't be meaningfully bucketed (e.g. specific injuries, deadlines, personal context).

Choose the most natural type for each question. Prefer structured types (boolean, multiple_choice, multi_select) over open_ended when the answer space is predictable.
For multiple_choice and multi_select, options must be short (1–4 words each) and mutually distinct.

Return a JSON object with a "questions" array.
If no additional questions are needed, return an empty array for "questions".`;

router.post("/followup-questions", async (req, res) => {
  const { title, skill_level, restrictions, requests, additional_context } = req.body;

  if (!title) {
    return res.status(400).json({ error: "title is required." });
  }

  const userMessage =
`Generate follow-up questions for this goal:

Hobby/Goal Title: ${title}
Skill Level: ${skill_level || "not specified"}
Restrictions: ${restrictions?.length > 0 ? restrictions.join(", ") : "none"}
Requests: ${requests?.length > 0 ? requests.join(", ") : "none"}
Additional Context: ${additional_context || "none"}

Return a JSON array of up to 5 question strings. Return [] if no questions are needed.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: FOLLOWUP_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "followup_questions",
          strict: true,
          schema: {
            type: "object",
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question: { type: "string" },
                    mandatory: { type: "boolean" },
                    type: { type: "string", enum: ["open_ended", "boolean", "multiple_choice", "multi_select", "scale"] },
                    options: { type: "array", items: { type: "string" } },
                  },
                  required: ["question", "mandatory", "type", "options"],
                  additionalProperties: false,
                },
                description: "List of follow-up questions (up to 5)",
              },
            },
            required: ["questions"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ questions: result.questions || [] });
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to generate questions." });
  }
});

const VALIDATE_GOAL_SYSTEM_PROMPT =
`You are validating whether a user-submitted goal is real and meaningful enough to build a routine around.

A goal is INVALID if it is: random gibberish, a nonsensical string, clearly not a real goal, offensive, or so vague it cannot be planned for (e.g. "asdfg", "lol idk", "xkcd 123", "???").
A goal is VALID if it describes any real hobby, skill, sport, habit, or personal development goal — even an unusual one.

Return a JSON object with:
- "valid": true or false
- "reason": a short, friendly explanation of why it's invalid (empty string if valid)`;

router.post("/validate-goal", async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "title is required." });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: VALIDATE_GOAL_SYSTEM_PROMPT },
        { role: "user", content: `Goal title: "${title}"` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "goal_validation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              valid: { type: "boolean" },
              reason: { type: "string" },
            },
            required: ["valid", "reason"],
            additionalProperties: false,
          },
        },
      },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to validate goal." });
  }
});

module.exports = router;
