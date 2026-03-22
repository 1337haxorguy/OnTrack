const express = require("express");
const router = express.Router();
const User = require("../../models/user");

// GET /api/user-data  — load goals, schedule, plan for the authenticated user
router.get("/", async (req, res) => {
  try {
    const sub = req.auth.payload.sub;
    const user = await User.findOne({ auth0Sub: sub });
    if (!user) return res.json({ goals: [], schedule: null, plan: null });
    res.json({ goals: user.goals ?? [], schedule: user.schedule ?? null, plan: user.plan ?? null });
  } catch (err) {
    console.error("user-data GET error:", err);
    res.status(500).json({ error: "Failed to load user data" });
  }
});

// PUT /api/user-data  — save (partial or full) goals, schedule, plan
router.put("/", async (req, res) => {
  try {
    const sub = req.auth.payload.sub;
    const { goals, schedule, plan } = req.body;

    const patch = {};
    if (goals    !== undefined) patch.goals    = goals;
    if (schedule !== undefined) patch.schedule = schedule;
    if (plan     !== undefined) patch.plan     = plan;

    await User.findOneAndUpdate(
      { auth0Sub: sub },
      { $set: patch },
      { upsert: true, new: true, runValidators: false }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("user-data PUT error:", err);
    res.status(500).json({ error: "Failed to save user data" });
  }
});

module.exports = router;
