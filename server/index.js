require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");

const TMP_DIR = process.env.TMP_DIR || "./tmp";
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// On headless servers (no real browser), YTDLP_COOKIES_FROM_BROWSER doesn't
// work. Paste exported cookies.txt content — base64 encoded — into
// YTDLP_COOKIES_B64 and we decode it to a file + point yt-dlp at it here.
if (process.env.YTDLP_COOKIES_B64) {
  try {
    const cookiesPath = path.join(TMP_DIR, "cookies.txt");
    fs.writeFileSync(cookiesPath, Buffer.from(process.env.YTDLP_COOKIES_B64, "base64"));
    const cookieArg = `--cookies ${cookiesPath}`;
    process.env.YTDLP_EXTRA_ARGS = process.env.YTDLP_EXTRA_ARGS ? `${process.env.YTDLP_EXTRA_ARGS} ${cookieArg}` : cookieArg;
    console.log("YTDLP_COOKIES_B64 terdeteksi — cookies.txt berhasil ditulis dan dipakai otomatis.");
  } catch (err) {
    console.error("Gagal decode YTDLP_COOKIES_B64:", err.message);
  }
}

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/payment", require("./routes/payment"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/resolve", require("./routes/resolve"));
app.use("/api/convert", require("./routes/convert"));
app.use("/api/upload", require("./routes/upload"));
app.use("/api/history", require("./routes/history"));

app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Audio Hub jalan di http://localhost:${PORT}`);
  console.log("Pastikan yt-dlp dan ffmpeg sudah terinstall di PATH.");
});
