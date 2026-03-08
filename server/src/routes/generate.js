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
- If constraints are tight or conflicting, generate the closest valid routine that satisfies the schema and honors the user’s intent.
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

function computeAvailableDates(availability, goals) {
  const { weekly_schedule, blocked_dates = [] } = availability;
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const blocked = new Set(blocked_dates);

  let startDate = null;
  let endDate = null;
  for (const goal of goals) {
    const s = new Date(goal.timeframe.start_date + "T00:00:00");
    const e = new Date(goal.timeframe.end_date + "T00:00:00");
    if (!startDate || s < startDate) startDate = s;
    if (!endDate || e > endDate) endDate = e;
  }

  const dates = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toISOString().split("T")[0];
    const dayName = dayNames[current.getDay()];
    const slots = weekly_schedule[dayName] || [];
    if (slots.length > 0 && !blocked.has(dateStr)) {
      dates.push({ date: dateStr, day: dayName, slots });
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

router.post("/", async (req, res) => {
  const { user_profile, generation_request, existing_plan } = req.body;

  if (!user_profile || !generation_request) {
    return res.status(400).json({ error: "user_profile and generation_request are required." });
  }

  // const availableDates = computeAvailableDates(user_profile.availability, user_profile.goals);

  const HARDCODED_USER_MESSAGE =
`
TASK:
Generate the routine for EXACTLY one week.

AUTHORITATIVE USER INPUT:
The following JSON has been validated against the input schema and must be treated as complete and authoritative.
Do not invent, infer, or assume any information beyond what is explicitly provided.

{

  "hobby_title": "Guitar Practice",
  "goals": [
    "Learn 8 songs from memory",
    "Improve barre chord transitions and endurance"
  ],
  "restrictions": [
    "Cannot practice loudly after 21:00",
    "Occasional wrist soreness"
  ],
  "requests": [
    "Include warm-up and cool-down in each session",
    "Balance technique drills with song work"
  ],
  "additional_context": "Intermediate player with more availability on weekends. Prefers early evenings on weekdays.",
  "followup_questions": [
    {
      "question": "What style of music do you primarily want to focus on?",
      "user_response": "I'm interested in fingerstyle acoustic and some classic rock"
    },
    {
      "question": "Do you have any upcoming performances or deadlines?",
      "user_response": "Yes, I'd like to perform at an open mic night in 2 months"
    }
  ],
  "timezone": "America/New_York",
  "start_date": "2026-02-10",
  "target_end_date": "2026-03-31",
  "days_per_week": 4,
  "prefers_time_blocks": true,
  "min_intraday_frequency": 1,
  "max_intraday_frequency": 2,
  "min_hours_per_week": 4,
  "max_hours_per_week": 6
}

TARGET:
Generate the routine for week_index = 1 only.

REQUIREMENTS:
- Follow all constraints defined in the authoritative user input.
- Use responses from followup_questions to refine focus, pacing, and task selection.
- daily_tasks MUST contain EXACTLY 4 entries.
- time_blocks per day MUST be within [1, 2].
- Total estimated_minutes across the entire week MUST be within [240, 360].
- Because prefers_time_blocks = true, every time block MUST include non-null start_time and end_time in HH:MM 24-hour format.
- Output JSON only and strictly conform to the provided output schema.
`;

  const p = user_profile;
  const week_index = generation_request.week_index || 1;

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

  const userMessage =
`
TASK:
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

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: OUTPUT_SCHEMA,
    });

    const plan = JSON.parse(completion.choices[0].message.content);
    res.json(plan);
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to generate plan." });
  }
});

const REGENERATE_SYSTEM_PROMPT = `You are a productivity planning assistant. The user wants to regenerate a single task from their existing plan. They will provide the original task and feedback on what they want changed.

Rules:
- Return exactly ONE replacement task.
- The new task MUST keep the same date and fit within the provided time slot for that date.
- Incorporate the user's feedback into the new task.
- Return ONLY valid JSON matching the output schema, no extra text.`;

router.post("/regenerate-task", async (req, res) => {
  const { task, feedback, user_profile } = req.body;

  if (!task || !feedback) {
    return res.status(400).json({ error: "task and feedback are required." });
  }

  const availableDates = computeAvailableDates(user_profile.availability, user_profile.goals);
  const dateSlots = availableDates.find((d) => d.date === task.date);

  const userMessage = JSON.stringify({
    original_task: task,
    feedback,
    available_slots: dateSlots ? dateSlots.slots : [],
    goal: user_profile.goals.find((g) => g.id === task.goal_id) || null,
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: REGENERATE_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      response_format: OUTPUT_SCHEMA,
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json({ task: result.plan[0] });
  } catch (err) {
    console.error("OpenAI API error:", err.message);
    res.status(500).json({ error: "Failed to regenerate task." });
  }
});

module.exports = router;


// hi THERE WOOO dhjsfkkj another push weekend push thursday push
// hi THERE WOOO dhjsfkkj another push weekend push another push WOOO weeekend moment GENERATIONAL git add woooooo
