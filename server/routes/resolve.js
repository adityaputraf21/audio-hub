const express = require("express");
const router = express.Router();
const resolvers = require("../services/resolvers");
const { requireAuth } = require("../middleware/auth");

router.post("/", requireAuth, async (req, res) => {
  const { url, platform } = req.body;
  if (!url) return res.status(400).json({ error: "url wajib diisi" });
  if (!platform) return res.status(400).json({ error: "platform wajib diisi" });

  try {
    const track = await resolvers.resolve(platform, url);
    res.json({ track });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
