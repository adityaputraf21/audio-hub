const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { v4: uuid } = require("uuid");
const db = require("../services/db");
const discord = require("../services/discord");
const { issueToken } = require("../services/auth");
const { requireAuth } = require("../middleware/auth");
const { isPaidActive, FREE_DAILY_LIMIT } = require("../middleware/usageLimit");

router.get("/discord", (req, res) => {
  if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
    return res.status(500).send("Discord OAuth belum dikonfigurasi di .env (DISCORD_CLIENT_ID / DISCORD_REDIRECT_URI).");
  }
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie("oauth_state", state, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: "lax" });
  res.redirect(discord.getAuthorizeUrl(state));
});

router.get("/discord/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (error) return res.redirect(`${appUrl}/login.html?error=${encodeURIComponent(error)}`);
  if (!code || !state || state !== req.cookies?.oauth_state) return res.redirect(`${appUrl}/login.html?error=state_mismatch`);
  res.clearCookie("oauth_state");

  try {
    const accessToken = await discord.exchangeCode(code);
    const profile = await discord.fetchDiscordUser(accessToken);

    let user = db.findUserByDiscordId(profile.discordId);
    if (!user) {
      const isFirstUser = db.getUsers().length === 0;
      user = {
        id: uuid(),
        discordId: profile.discordId,
        username: profile.username,
        handle: profile.handle,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        role: isFirstUser ? "admin" : "user",
        tier: "free",
        paidUntil: null,
        banned: false,
        createdAt: new Date().toISOString(),
      };
      await db.insertUser(user);
    } else {
      user = await db.updateUser(user.id, {
        username: profile.username,
        handle: profile.handle,
        avatarUrl: profile.avatarUrl,
        email: profile.email || user.email,
      });
    }

    if (user.banned) return res.redirect(`${appUrl}/login.html?error=banned`);

    const token = issueToken(user);
    res.redirect(`${appUrl}/auth-callback.html#token=${token}`);
  } catch (err) {
    res.redirect(`${appUrl}/login.html?error=${encodeURIComponent(err.message)}`);
  }
});

router.get("/me", requireAuth, (req, res) => {
  const user = req.user;
  const paidActive = isPaidActive(user);
  const usedToday = db.getUsageToday(user.id);
  res.json({
    user: sanitize(user),
    usage: paidActive
      ? { tier: "paid", unlimited: true }
      : { tier: "free", used: usedToday, limit: FREE_DAILY_LIMIT, remaining: Math.max(0, FREE_DAILY_LIMIT - usedToday) },
  });
});

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

module.exports = router;
