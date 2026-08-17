const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuid } = require("uuid");

const TMP_DIR = process.env.TMP_DIR || "./tmp";

// YouTube's bot-detection changes constantly. Rather than requiring manual
// cookie setup by default, we automatically retry a failed (403-style)
// request against several of YouTube's other client "personas" first.
const PLAYER_CLIENT_FALLBACKS = [null, "android", "android,web", "tv", "mweb"];

function userArgs() {
  const args = [];
  if (process.env.YTDLP_COOKIES_FROM_BROWSER) {
    args.push("--cookies-from-browser", process.env.YTDLP_COOKIES_FROM_BROWSER);
  }
  if (process.env.YTDLP_EXTRA_ARGS) {
    args.push(...process.env.YTDLP_EXTRA_ARGS.split(" ").filter(Boolean));
  }
  return args;
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => (code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `${cmd} exited with code ${code}`))));
    proc.on("error", reject);
  });
}

const isForbiddenError = (err) => /403|Forbidden/i.test(err.message || "");

async function runWithFallback(buildArgs) {
  let lastErr;
  for (const client of PLAYER_CLIENT_FALLBACKS) {
    try {
      return await run("yt-dlp", buildArgs(client));
    } catch (err) {
      lastErr = err;
      if (!isForbiddenError(err)) throw err;
    }
  }
  throw new Error(
    `${lastErr.message}\n\nSudah dicoba otomatis dengan beberapa metode berbeda tapi ditolak terus. Coba isi YTDLP_COOKIES_FROM_BROWSER atau YTDLP_COOKIES_B64 di .env.`
  );
}

const clientArgs = (client) => (client ? ["--extractor-args", `youtube:player_client=${client}`] : []);

async function getInfo(url) {
  const { stdout } = await runWithFallback((client) => ["-J", "--no-playlist", ...userArgs(), ...clientArgs(client), url]);
  const info = JSON.parse(stdout);
  return {
    title: info.title,
    artist: info.uploader || info.artist || info.channel || "Unknown",
    duration: info.duration,
    thumbnail: info.thumbnail,
    sourceUrl: url,
  };
}

async function searchFirst(query) {
  const { stdout } = await runWithFallback((client) => [`ytsearch1:${query}`, "-J", "--no-playlist", ...userArgs(), ...clientArgs(client)]);
  const info = JSON.parse(stdout);
  const entry = info.entries && info.entries.length ? info.entries[0] : info.id ? info : null;
  if (!entry) throw new Error(`Gak nemu hasil YouTube buat pencarian: "${query}". Coba cari manual dan pakai link YouTube langsung.`);
  return {
    title: entry.title,
    artist: entry.uploader || entry.channel || "Unknown",
    duration: entry.duration,
    thumbnail: entry.thumbnail,
    sourceUrl: entry.webpage_url || `https://www.youtube.com/watch?v=${entry.id}`,
  };
}

// Generic downloader — works for any yt-dlp-supported site (YouTube,
// SoundCloud, TikTok all extract natively without special-casing).
async function downloadAudio(url) {
  const id = uuid();
  const outTemplate = path.join(TMP_DIR, `${id}.raw.%(ext)s`);
  await runWithFallback((client) => ["-f", "bestaudio/best", "--no-playlist", ...userArgs(), ...clientArgs(client), "-o", outTemplate, url]);
  const files = fs.readdirSync(TMP_DIR).filter((f) => f.startsWith(`${id}.raw.`));
  if (!files.length) throw new Error("Download finished but output file not found");
  return path.join(TMP_DIR, files[0]);
}

// Metadata-only fetch for any yt-dlp-supported URL (used by SoundCloud/TikTok
// resolvers to show a preview before committing to a full download).
async function getInfoGeneric(url) {
  const { stdout } = await runWithFallback((client) => ["-J", "--no-playlist", ...userArgs(), ...clientArgs(client), url]);
  const info = JSON.parse(stdout);
  return {
    title: info.title,
    artist: info.uploader || info.artist || info.channel || "Unknown",
    duration: info.duration,
    thumbnail: info.thumbnail,
    sourceUrl: url,
  };
}

module.exports = { getInfo, searchFirst, downloadAudio, getInfoGeneric };
