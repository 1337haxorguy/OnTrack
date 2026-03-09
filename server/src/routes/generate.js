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

// Build prompt from new structured format (App.tsx)
function buildNewFormatMessage(goals, availability, preferences) {
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

  // days_per_week: union of selected_days across goals, fallback to free_slots
  const allSelectedDays = new Set();
  for (const goal of goals) {
    (goal.selected_days || []).forEach(d => allSelectedDays.add(d));
  }
  const activeDays = allSelectedDays.size > 0
    ? Array.from(allSelectedDays).map(d => [d, free_slots[d] || []])
    : Object.entries(free_slots).filter(([, slots]) => Array.isArray(slots) && slots.length > 0);
  const days_per_week = Math.max(1, activeDays.length);

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

  const freeTimeDesc = activeDays.length > 0
    ? activeDays.map(([day, slots]) => {
        const slotStr = Array.isArray(slots) && slots.length > 0
          ? slots.map(s => `${s.start}–${s.end}`).join(", ")
          : "open";
        return `  ${day}: ${slotStr}`;
      }).join("\n")
    : "  No specific free slots provided — distribute sessions on reasonable days";

  const recurringDesc = recurring_blocks.length > 0
    ? recurring_blocks.map(b =>
        `  - ${b.label}: ${b.days.join(", ")} ${b.start_time}–${b.end_time} (BLOCKED — do NOT schedule here)`
      ).join("\n")
    : "  None";

  const specificDesc = specific_blocks.length > 0
    ? specific_blocks.map(b =>
        `  - ${b.date}: ${b.all_day ? "All day" : `${b.start_time}–${b.end_time}`}${b.label ? ` (${b.label})` : ""} (BLOCKED)`
      ).join("\n")
    : "  None";

  const minMinutes = Math.max(60, (totalHours - 1) * 60);
  const maxMinutes = (totalHours + 1) * 60;
  const maxBlocksPerDay = sessions_per_day >= 2 ? 2 : 1;

  return `TASK:
Generate the routine for EXACTLY one week starting from ${startDate.toISOString().split("T")[0]}.

GOALS:
${goalDescs}

AVAILABLE TIME (when user is free to work on their goals):
${freeTimeDesc}

RECURRING COMMITMENTS (user is NOT available during these times):
${recurringDesc}

SPECIFIC BLOCKED DATES/TIMES:
${specificDesc}

TIMEZONE: ${timezone}

CONSTRAINTS:
- Generate exactly ${days_per_week} day entries in weekly_tasks
- Prefer days listed in each goal's "Preferred days"; if none specified, use days with free slots
- Schedule sessions within the user's free time windows; do NOT schedule during recurring commitments or blocked dates
- Honor per-goal daily limits if specified
- Total estimated_minutes across ALL tasks MUST be between ${minMinutes} and ${maxMinutes}
- Each day should have 1–${maxBlocksPerDay} time block(s)
- Every time block MUST include non-null start_time and end_time in HH:MM 24-hour format
- Strictly respect each goal's restrictions (do not assign tasks that violate them)
- Incorporate each goal's requests into the session structure
- Use Q&A responses and additional context to tailor difficulty, content, and focus — a user who says they already know basics should NOT get beginner content
- Output JSON only and strictly conform to the provided output schema.`;
}

router.post("/", async (req, res) => {
  const { user_profile, goals, availability, preferences, generation_request } = req.body;

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
    userMessage = buildNewFormatMessage(goals, availability, preferences);
  } else {
    return res.status(400).json({ error: "Invalid request: provide either user_profile (legacy) or goals + availability." });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: OUTPUT_SCHEMA,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to generate plan." });
  }
});

router.post("/regenerate-day", async (req, res) => {
  const { date, current_day_plan, feedback, goals, availability } = req.body;

  if (!date || !goals || !availability) {
    return res.status(400).json({ error: "date, goals, and availability are required." });
  }

  const dayOfWeek = new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const freeSlots = (availability.free_slots || {})[dayOfWeek] || [];

  const goalDescs = goals.map(g => `- "${g.title}" (${g.skill_level})`).join("\n");
  const slotsDesc = freeSlots.length > 0
    ? freeSlots.map(s => `${s.start}–${s.end}`).join(", ")
    : "flexible timing";

  const userMessage =
`TASK:
Regenerate the schedule for ${date} (${dayOfWeek}).

GOALS:
${goalDescs}

AVAILABLE TIME ON THIS DAY:
${slotsDesc}
${feedback ? `\nUSER FEEDBACK:\n${feedback}` : ""}
${current_day_plan ? `\nCURRENT SCHEDULE TO REPLACE:\n${JSON.stringify(current_day_plan, null, 2)}` : ""}

CONSTRAINTS:
- Generate EXACTLY 1 entry in weekly_tasks for date ${date}
- Include 1–2 time blocks
- Schedule tasks within the available time window
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

    const result = JSON.parse(completion.choices[0].message.content);
    const dayPlan = result.weekly_tasks?.[0] ?? null;
    res.json(dayPlan);
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to regenerate day." });
  }
});

module.exports = router;
