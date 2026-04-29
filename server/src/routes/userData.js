const express = require("express");
const router = express.Router();
const User = require("../../models/user");
const { UNLIMITED_EMAILS } = require("../config/limits");

function checkUnlimited(req) {
  const email = (req.auth?.payload?.email || "").toLowerCase();
  return UNLIMITED_EMAILS.has(email);
}

// GET /api/user-data  — load goals, schedule, plan for the authenticated user
router.get("/", async (req, res) => {
  try {
    const sub = req.auth.payload.sub;
    const user = await User.findOne({ sub });
    const subscriptionStatus = user?.subscriptionStatus ?? null;
    const unlimited = checkUnlimited(req) || subscriptionStatus === "active";
    if (!user) return res.json({ goals: [], schedule: null, plan: null, avatar: null, usage: { generations: 0 }, subscriptionStatus: null, unlimited });
    res.json({ goals: user.goals ?? [], schedule: user.schedule ?? null, plan: user.plan ?? null, avatar: user.avatar ?? null, usage: user.usage ?? { generations: 0 }, subscriptionStatus, unlimited });
  } catch (err) {
    console.error("user-data GET error:", err);
    res.status(500).json({ error: "Failed to load user data" });
  }
});

// PUT /api/user-data  — save (partial or full) goals, schedule, plan
router.put("/", async (req, res) => {
  try {
    const sub = req.auth.payload.sub;
    const { goals, schedule, plan, avatar } = req.body;

    const patch = {};
    if (goals    !== undefined) patch.goals    = goals;
    if (schedule !== undefined) patch.schedule = schedule;
    if (plan     !== undefined) patch.plan     = plan;
    if (avatar   !== undefined) patch.avatar   = avatar;

    await User.findOneAndUpdate(
      { sub },
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
