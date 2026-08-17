const express = require("express");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");
const router = express.Router();
const { uploadAudio } = require("../services/robloxUpload");
const { requireAuth } = require("../middleware/auth");
const db = require("../services/db");

const TMP_DIR = process.env.TMP_DIR || "./tmp";

router.post("/", requireAuth, async (req, res) => {
  const { fileId, displayName, artist, description, creator, apiKey } = req.body;
  if (!fileId) return res.status(400).json({ error: "fileId wajib diisi (convert dulu sebelum upload)" });

  const filePath = path.resolve(TMP_DIR, fileId);
  const tmpRoot = path.resolve(TMP_DIR);
  if (!filePath.startsWith(tmpRoot) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File hasil convert tidak ditemukan / sudah kadaluarsa" });
  }

  try {
    const key = apiKey || process.env.ROBLOX_API_KEY;
    const resolvedCreator = creator || {
      userId: process.env.ROBLOX_DEFAULT_USER_ID || undefined,
      groupId: process.env.ROBLOX_DEFAULT_GROUP_ID || undefined,
    };

    const result = await uploadAudio({
      filePath,
      displayName: displayName || "Untitled Track",
      description,
      apiKey: key,
      creator: resolvedCreator,
    });

    const stats = fs.statSync(filePath);
    const status = result.pending ? "pending" : result.rejected ? "removed" : "active";
    await db.insertUploadRecord({
      id: uuid(),
      userId: req.user.id,
      title: displayName || "Untitled Track",
      artist: artist || null,
      assetId: result.assetId || null,
      operationId: result.pending ? result.operationId : null,
      status,
      rejectReason: result.rejected ? result.rejectReason : null,
      format: path.extname(filePath).replace(".", "") || null,
      sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
      creator: resolvedCreator,
      createdAt: new Date().toISOString(),
    });

    res.json({ success: true, assetId: result.assetId, pending: result.pending, rejected: result.rejected, rejectReason: result.rejectReason, raw: result.raw });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
