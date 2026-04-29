const LIMITS_ENABLED = true;

const FREE_LIMITS = {
  goals: 5,
  generations: 25,
};

// Comma-separated list of emails that bypass all generation limits.
// Set via UNLIMITED_EMAILS env var: "a@b.com,c@d.com"
const UNLIMITED_EMAILS = new Set(
  (process.env.UNLIMITED_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
);

module.exports = { LIMITS_ENABLED, FREE_LIMITS, UNLIMITED_EMAILS };
