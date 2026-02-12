const express = require("express");
const OpenAI = require("openai");

const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// ──────────────────────────────────────────────
// Edit these directly to test different prompts
// ──────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a productivity planning assistant. Given a user's goals, skill level, timeframe, and availability, generate a structured daily task plan.

Rules:
- Keep task descriptions actionable and specific. WOW
- Tasks should cover all phases of achieving the goal — not just preparation, but also execution and follow-through.
- Return ONLY valid JSON matching the output schema, no extra text.`;

const USER_MESSAGE = `Generate a 2-week plan for a beginner learning to play guitar, available Monday-Friday 6pm-8pm.`;

// ──────────────────────────────────────────────
// Adjust OpenAI parameters here
// ──────────────────────────────────────────────

const CONFIG = {
  model: "gpt-4o",
  temperature: 1,
  max_tokens: 4096,
  top_p: 1,
  frequency_penalty: 0,
  presence_penalty: 0,
  // response_format: { type: "json_object" },
  // seed: 42,
};

// ──────────────────────────────────────────────

router.post("/", async (req, res) => {
  const params = {
    model: CONFIG.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: USER_MESSAGE },
    ],
    temperature: CONFIG.temperature,
    max_tokens: CONFIG.max_tokens,
    top_p: CONFIG.top_p,
    frequency_penalty: CONFIG.frequency_penalty,
    presence_penalty: CONFIG.presence_penalty,
  };

  if (CONFIG.response_format) params.response_format = CONFIG.response_format;
  if (CONFIG.seed !== undefined) params.seed = CONFIG.seed;

  try {
    const start = Date.now();
    const completion = await openai.chat.completions.create(params);
    const elapsed = Date.now() - start;

    res.json({
      content: completion.choices[0].message.content,
      usage: completion.usage,
      model: completion.model,
      finish_reason: completion.choices[0].finish_reason,
      latency_ms: elapsed,
      config: CONFIG,
      system_prompt: SYSTEM_PROMPT,
      user_message: USER_MESSAGE,
    });
  } catch (err) {
    console.error("Playground error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
