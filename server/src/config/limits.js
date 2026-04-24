// Flip LIMITS_ENABLED to true when ready to enforce usage caps.
// When false, all limit checks are bypassed completely — zero runtime effect.
const LIMITS_ENABLED = false;

const FREE_LIMITS = {
  goals: 3,
  generations: 5,
};

module.exports = { LIMITS_ENABLED, FREE_LIMITS };
