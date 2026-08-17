const { spawn } = require("child_process");
const path = require("path");
const { v4: uuid } = require("uuid");

const TMP_DIR = process.env.TMP_DIR || "./tmp";

// atempo only accepts 0.5–2.0 per instance, so speeds outside that range need
// chaining. rubberband (checked below) does it in one higher-quality pass.
function buildAtempoChain(speed) {
  let remaining = speed;
  const stages = [];
  while (remaining > 2.0) {
    stages.push(2.0);
    remaining /= 2.0;
  }
  while (remaining < 0.5) {
    stages.push(0.5);
    remaining /= 0.5;
  }
  stages.push(remaining);
  return stages.map((s) => `atempo=${s.toFixed(4)}`).join(",");
}

function run(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(stderr || `ffmpeg exited with code ${code}`))));
    proc.on("error", reject);
  });
}

let rubberbandSupport = null;
function hasRubberband() {
  if (rubberbandSupport !== null) return Promise.resolve(rubberbandSupport);
  return new Promise((resolve) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-filters"]);
    let stdout = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.on("close", () => {
      rubberbandSupport = /\brubberband\b/.test(stdout);
      resolve(rubberbandSupport);
    });
    proc.on("error", () => {
      rubberbandSupport = false;
      resolve(false);
    });
  });
}

/**
 * @param {string} inputPath
 * @param {object} opts
 * @param {number} opts.speed
 * @param {number} opts.amplifyDb
 * @param {number} opts.pitchSemitones  e.g. -12 to +12 (0 = no pitch change)
 * @param {"mp3"|"ogg"} opts.format
 */
async function processAudio(inputPath, { speed = 1.0, amplifyDb = 0, pitchSemitones = 0, format = "mp3" } = {}) {
  const id = uuid();
  const ext = format === "ogg" ? "ogg" : "mp3";
  const outPath = path.join(TMP_DIR, `${id}.out.${ext}`);

  const filters = [];
  const needsTempo = speed && speed !== 1.0;
  const needsPitch = pitchSemitones && pitchSemitones !== 0;
  let pitchApplied = false;

  if (needsTempo || needsPitch) {
    const useRubberband = await hasRubberband();
    if (useRubberband) {
      // rubberband handles tempo and pitch as independent parameters in one
      // pass — pitch is a frequency ratio, so convert semitones -> ratio.
      const parts = [];
      if (needsTempo) parts.push(`tempo=${speed.toFixed(4)}`);
      if (needsPitch) {
        const pitchRatio = Math.pow(2, pitchSemitones / 12);
        parts.push(`pitch=${pitchRatio.toFixed(6)}`);
        pitchApplied = true;
      }
      filters.push(`rubberband=${parts.join(":")}`);
    } else {
      // No rubberband available: fall back to atempo for tempo only.
      // There's no safe simple fallback for independent pitch-shifting
      // without rubberband, so pitch is skipped rather than risk a bad
      // (asetrate-based) hack that also messes with tempo.
      if (needsTempo) filters.push(buildAtempoChain(speed));
    }
  }
  if (amplifyDb && amplifyDb !== 0) filters.push(`volume=${amplifyDb}dB`);

  const args = ["-y", "-i", inputPath];
  if (filters.length) args.push("-af", filters.join(","));
  args.push("-c:a", format === "ogg" ? "libvorbis" : "libmp3lame");
  if (format === "ogg") args.push("-qscale:a", "5");
  else args.push("-b:a", "192k");
  args.push(outPath);

  await run(args);
  return { outPath, pitchApplied: needsPitch ? pitchApplied : true }; // true (no-op) when pitch wasn't requested
}

module.exports = { process: processAudio, buildAtempoChain, hasRubberband };
