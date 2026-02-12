const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

const SYSTEM_PROMPT = `You are a productivity planning assistant. Given a user's goals, skill level, timeframe, and availability, generate a structured daily task plan.

The user message includes an "available_dates" array. This is the EXACT list of dates and time slots you are allowed to schedule tasks on. Do NOT schedule tasks on any date or time not in this list.

Rules:
- ONLY use dates and time slots from the "available_dates" array. Every task's date and start_time/end_time must fall within one of the provided slots for that date.
- Each task must fit within a single time slot (do not span across slots).
- Keep task descriptions actionable and specific.
- Tasks should cover all phases of achieving the goal — not just preparation, but also execution and follow-through.
- If regenerating a single day, keep the rest of the plan consistent.
- Return ONLY valid JSON matching the output schema, no extra text.`;

const OUTPUT_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "task_plan",
    strict: true,
    schema: {
      "name": "weekly_schedule_output",
      "strict": true,
      "schema": {
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
      }
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

  const availableDates = computeAvailableDates(user_profile.availability, user_profile.goals);

  const userMessage = JSON.stringify({
    user_profile,
    generation_request,
    existing_plan: existing_plan || [],
    available_dates: availableDates,
  });

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


// hi THERE WOOO