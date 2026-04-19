const express = require("express");
const router = express.Router();
const User = require("../../models/user");

router.post("/", async (req, res) => {
  try {
    const sub = req.auth.payload.sub;
    const email = req.auth.payload.email || req.body.email || "";

    const user = await User.findOneAndUpdate(
      { sub },
      { $setOnInsert: { email } },
      { upsert: true, new: true }
    );

    res.json(user);
  } catch (err) {
    console.error("sync-user error:", err);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

module.exports = router;
