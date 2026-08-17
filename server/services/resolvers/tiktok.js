const ytdlp = require("../ytdlp");

async function resolve(url) {
  const info = await ytdlp.getInfoGeneric(url);
  return { ...info, provider: "tiktok" };
}

module.exports = { resolve };
