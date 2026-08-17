const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const router = express.Router();
const ytdlp = require("../services/ytdlp");
const ffmpeg = require("../services/ffmpeg");
const db = require("../services/db");
const { requireAuth } = require("../middleware/auth");
const { checkUsageLimit } = require("../middleware/usageLimit");

const TMP_DIR = process.env.TMP_DIR || "./tmp";
const upload = multer({ dest: TMP_DIR, limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB cap

// Link-based convert: `url` here should be the actual downloadable source
// (for YouTube/SoundCloud/TikTok that's the original link; for Spotify/Apple
// Music the frontend already resolved it to a matching YouTube link via
// /api/resolve, since those platforms are DRM'd and never give raw audio).
router.post("/", requireAuth, checkUsageLimit, async (req, res) => {
  const { url, speed, amplifyDb, format, title, artist } = req.body;
  if (!url) return res.status(400).json({ error: "url wajib diisi" });

  let rawPath;
  try {
    rawPath = await ytdlp.downloadAudio(url);
    const outPath = await ffmpeg.process(rawPath, {
      speed: Number(speed) || 1.0,
      amplifyDb: Number(amplifyDb) || 0,
      format: format === "ogg" ? "ogg" : "mp3",
    });

    const stats = fs.statSync(outPath);
    const fileId = path.basename(outPath);
    await db.incrementUsage(req.user.id);

    res.json({
      fileId,
      sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      title: title || "Untitled",
      artist: artist || "Unknown",
      format: format === "ogg" ? "ogg" : "mp3",
      usage: req.usageInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (rawPath && fs.existsSync(rawPath)) fs.unlink(rawPath, () => {});
  }
});

// Direct file upload convert ("Upload MP3" tab) — skips resolve/download
// entirely, goes straight to ffmpeg processing of whatever was uploaded.
router.post("/upload-file", requireAuth, checkUsageLimit, upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File audio wajib diupload" });

  const { speed, amplifyDb, format, title, artist } = req.body;
  const rawPath = req.file.path;

  try {
    const outPath = await ffmpeg.process(rawPath, {
      speed: Number(speed) || 1.0,
      amplifyDb: Number(amplifyDb) || 0,
      format: format === "ogg" ? "ogg" : "mp3",
    });

    const stats = fs.statSync(outPath);
    const fileId = path.basename(outPath);
    await db.incrementUsage(req.user.id);

    res.json({
      fileId,
      sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      title: title || req.file.originalname.replace(/\.[^.]+$/, "") || "Untitled",
      artist: artist || "Unknown",
      format: format === "ogg" ? "ogg" : "mp3",
      usage: req.usageInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (rawPath && fs.existsSync(rawPath)) fs.unlink(rawPath, () => {});
  }
});

// Download/preview the converted file before uploading to Roblox
router.get("/file/:fileId", requireAuth, (req, res) => {
  const filePath = path.resolve(TMP_DIR, req.params.fileId);
  if (!filePath.startsWith(path.resolve(TMP_DIR))) return res.status(400).end();
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const ext = path.extname(filePath);
  const safeName = (req.query.name || "audio").replace(/[^a-z0-9 _-]/gi, "").trim() || "audio";
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}${ext}"`);
  res.sendFile(path.resolve(filePath));
});

module.exports = router;
