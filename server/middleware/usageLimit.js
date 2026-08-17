const db = require("../services/db");

const FREE_DAILY_LIMIT = Number(process.env.FREE_DAILY_LIMIT || 2);

function isPaidActive(user) {
  if (user.tier !== "paid") return false;
  if (!user.paidUntil) return true;
  return new Date(user.paidUntil) > new Date();
}

async function checkUsageLimit(req, res, next) {
  const user = req.user;
  if (isPaidActive(user)) {
    req.usageInfo = { tier: "paid", used: null, limit: null, remaining: null };
    return next();
  }

  const usedToday = db.getUsageToday(user.id);
  if (usedToday >= FREE_DAILY_LIMIT) {
    return res.status(429).json({
      error: `Limit gratis ${FREE_DAILY_LIMIT}x/hari sudah habis. Upgrade ke Premium buat unlimited, atau coba lagi besok.`,
      limitReached: true,
      used: usedToday,
      limit: FREE_DAILY_LIMIT,
    });
  }

  req.usageInfo = { tier: "free", used: usedToday, limit: FREE_DAILY_LIMIT, remaining: FREE_DAILY_LIMIT - usedToday };
  next();
}

module.exports = { checkUsageLimit, isPaidActive, FREE_DAILY_LIMIT };
